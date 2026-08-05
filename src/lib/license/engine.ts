import { supabase } from '@/integrations/supabase/client';

export interface LicenseProduct {
  id: string;
  sku: string | null;
  item_name: string;
  is_licensable: boolean;
  licensor_tenant_id: string | null;
  brand_id: string | null;
  license_model: string;
  rate_percent: number | null;
  rate_per_unit: number | null;
  min_amount: number | null;
  per_device: boolean;
  valid_from: string | null;
  valid_to: string | null;
}

const norm = (v: any) => String(v ?? '').trim().toLowerCase();

export function matchProduct(products: LicenseProduct[], sku: any, name: any, date?: string) {
  const s = norm(sku);
  const n = norm(name);
  return (
    products.find((p) => {
      if (!p.is_licensable) return false;
      if (date) {
        if (p.valid_from && date < p.valid_from) return false;
        if (p.valid_to && date > p.valid_to) return false;
      }
      const ps = norm(p.sku);
      const pn = norm(p.item_name);
      if (ps && s && ps === s) return true;
      if (pn && n && (pn === n || n.includes(pn))) return true;
      return false;
    }) || null
  );
}

export function computeRoyalty(p: LicenseProduct, net: number, qty: number) {
  let amount = 0;
  if (p.license_model === 'per_unit') amount = Number(p.rate_per_unit || 0) * (qty || 1);
  else if (p.license_model === 'fixed') amount = Number(p.rate_per_unit || 0);
  else amount = (net * Number(p.rate_percent || 0)) / 100;
  const min = Number(p.min_amount || 0);
  if (min > 0 && amount < min) amount = min;
  return Math.round(amount * 100) / 100;
}

export interface GenerateResult {
  scanned: number;
  matched: number;
  created: number;
  skipped: number;
  amount: number;
}

/**
 * Erzeugt Royalty-Buchungen aus abgeschlossenen Verkaufsrechnungen der Mandanten.
 * Bereits erfasste Positionen werden übersprungen (revisionssicher, keine Doppelbuchung).
 */
export async function generateRoyalties(opts: {
  from: string;
  to: string;
  licensorTenantId: string | null;
  tenantsBySource: Record<string, string>;
  statuses?: string[];
}): Promise<GenerateResult> {
  const statuses = opts.statuses ?? ['sent', 'paid', 'partially_paid', 'overdue'];
  const { data: prodData } = await supabase
    .from('license_products' as any)
    .select('*')
    .eq('is_licensable', true);
  const products = ((prodData as any[]) || []) as LicenseProduct[];

  const res: GenerateResult = { scanned: 0, matched: 0, created: 0, skipped: 0, amount: 0 };
  if (!products.length) return res;

  const { data: invData } = await supabase
    .from('zoho_invoices')
    .select('id,invoice_number,invoice_date,currency,source_system,status,raw_data')
    .gte('invoice_date', opts.from)
    .lte('invoice_date', opts.to)
    .in('status', statuses)
    .limit(5000);
  const invoices = ((invData as any[]) || []).filter((i) => i.raw_data);
  res.scanned = invoices.length;
  if (!invoices.length) return res;

  const numbers = invoices.map((i) => i.invoice_number).filter(Boolean);
  const existing = new Set<string>();
  for (let i = 0; i < numbers.length; i += 200) {
    const { data: ex } = await supabase
      .from('royalty_transactions' as any)
      .select('source_invoice_number,product_sku,product_name,serial_number')
      .in('source_invoice_number', numbers.slice(i, i + 200));
    ((ex as any[]) || []).forEach((r) =>
      existing.add(
        `${r.source_invoice_number}|${norm(r.product_sku || r.product_name)}|${r.serial_number || ''}`,
      ),
    );
  }

  const rows: any[] = [];
  for (const inv of invoices) {
    const raw = typeof inv.raw_data === 'string' ? safeParse(inv.raw_data) : inv.raw_data;
    const items: any[] = raw?.line_items || [];
    for (const li of items) {
      const p = matchProduct(products, li.sku, li.name, inv.invoice_date);
      if (!p) continue;
      res.matched++;
      const qty = Number(li.quantity || 1);
      const net = Number(li.item_total ?? (Number(li.rate || 0) * qty - Number(li.discount_amount || 0)));
      const serials: string[] = Array.isArray(li.serial_numbers)
        ? li.serial_numbers.map((s: any) => (typeof s === 'string' ? s : s?.serial_number)).filter(Boolean)
        : [];
      const serial = serials.join(', ') || null;
      const key = `${inv.invoice_number}|${norm(li.sku || li.name)}|${serial || ''}`;
      if (existing.has(key)) {
        res.skipped++;
        continue;
      }
      existing.add(key);
      const amount = computeRoyalty(p, net, qty);
      if (amount <= 0) continue;
      rows.push({
        licensor_tenant_id: p.licensor_tenant_id || opts.licensorTenantId,
        licensee_tenant_id: opts.tenantsBySource[inv.source_system] || null,
        license_product_id: p.id,
        brand_id: p.brand_id,
        source_system: inv.source_system,
        source_invoice_id: inv.id,
        source_invoice_number: inv.invoice_number,
        source_invoice_date: inv.invoice_date,
        product_sku: li.sku || null,
        product_name: li.name || p.item_name,
        serial_number: serial,
        quantity: qty,
        net_amount: net,
        currency: inv.currency || 'EUR',
        license_model: p.license_model,
        rate_percent: p.rate_percent || 0,
        rate_per_unit: p.rate_per_unit || 0,
        royalty_amount: amount,
        status: 'offen',
      });
      res.amount += amount;
    }
  }

  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from('royalty_transactions' as any).insert(chunk);
    if (error) throw error;
    res.created += chunk.length;
  }

  if (res.created > 0) {
    await supabase.from('license_audit_log' as any).insert({
      entity: 'royalty_transactions',
      action: 'generate',
      payload: { from: opts.from, to: opts.to, created: res.created, amount: res.amount },
    });
  }
  return res;
}

function safeParse(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/**
 * Fasst offene Royalty-Buchungen zu Lizenzrechnungen (Intercompany) zusammen.
 * mode = 'single' → je Verkaufsrechnung eine Lizenzrechnung, 'monthly' → Sammelrechnung je Mandant/Monat.
 */
export async function createLicenseInvoices(opts: {
  from: string;
  to: string;
  mode: 'single' | 'monthly';
  licensorTenantId: string | null;
  paymentTermsDays: number;
  licenseeTenantId?: string | null;
}) {
  let q = supabase
    .from('royalty_transactions' as any)
    .select('*')
    .eq('status', 'offen')
    .gte('source_invoice_date', opts.from)
    .lte('source_invoice_date', opts.to)
    .limit(5000);
  if (opts.licenseeTenantId) q = q.eq('licensee_tenant_id', opts.licenseeTenantId);
  const { data } = await q;
  const tx = ((data as any[]) || []).filter((r) => r.licensee_tenant_id);
  if (!tx.length) return { invoices: 0, amount: 0 };

  const groups = new Map<string, any[]>();
  tx.forEach((r) => {
    const key =
      opts.mode === 'single'
        ? `${r.licensee_tenant_id}|${r.source_invoice_number}`
        : `${r.licensee_tenant_id}|${String(r.source_invoice_date).slice(0, 7)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  let created = 0;
  let total = 0;
  for (const rows of groups.values()) {
    const amount = rows.reduce((s, r) => s + Number(r.royalty_amount || 0), 0);
    if (amount <= 0) continue;
    const dates = rows.map((r) => r.source_invoice_date).sort();
    const due = new Date();
    due.setDate(due.getDate() + (opts.paymentTermsDays || 14));

    const { data: inv, error } = await supabase
      .from('license_invoices' as any)
      .insert({
        licensor_tenant_id: opts.licensorTenantId,
        licensee_tenant_id: rows[0].licensee_tenant_id,
        period_start: dates[0],
        period_end: dates[dates.length - 1],
        due_date: due.toISOString().slice(0, 10),
        amount_net: Math.round(amount * 100) / 100,
        currency: rows[0].currency || 'EUR',
        status: 'offen',
        notes: 'Lizenzgebühr gemäß Markenlizenzvertrag',
      })
      .select('id,invoice_number')
      .single();
    if (error) throw error;

    await supabase.from('license_invoice_items' as any).insert(
      rows.map((r) => ({
        invoice_id: (inv as any).id,
        royalty_transaction_id: r.id,
        description: `Royalty für ${r.product_name}${r.serial_number ? ` (SN ${r.serial_number})` : ''} – Verkaufsrechnung ${r.source_invoice_number}`,
        product_name: r.product_name,
        serial_number: r.serial_number,
        source_invoice_number: r.source_invoice_number,
        base_amount: r.net_amount,
        rate_percent: r.rate_percent,
        amount: r.royalty_amount,
      })),
    );

    await supabase
      .from('royalty_transactions' as any)
      .update({ status: 'abgerechnet', license_invoice_id: (inv as any).id })
      .in(
        'id',
        rows.map((r) => r.id),
      );

    await supabase.from('intercompany_invoices' as any).insert({
      from_tenant_id: opts.licensorTenantId,
      to_tenant_id: rows[0].licensee_tenant_id,
      license_invoice_id: (inv as any).id,
      category: 'lizenz',
      due_date: due.toISOString().slice(0, 10),
      amount_net: Math.round(amount * 100) / 100,
      currency: rows[0].currency || 'EUR',
      status: 'offen',
      reference: (inv as any).invoice_number,
      notes: 'Lizenzgebühr gemäß Markenlizenzvertrag',
    });

    await supabase.from('license_audit_log' as any).insert({
      entity: 'license_invoices',
      entity_id: (inv as any).id,
      action: 'create',
      payload: { amount, positions: rows.length, mode: opts.mode },
    });

    created++;
    total += amount;
  }
  return { invoices: created, amount: total };
}
