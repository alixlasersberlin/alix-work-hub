import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

function safeParse(v: string) {
  try { return JSON.parse(v); } catch { return null; }
}

function computeRoyalty(p: any, net: number, qty: number) {
  let amount = 0;
  if (p.license_model === 'per_unit') amount = Number(p.rate_per_unit || 0) * (qty || 1);
  else if (p.license_model === 'fixed') amount = Number(p.rate_per_unit || 0);
  else amount = (net * Number(p.rate_percent || 0)) / 100;
  const min = Number(p.min_amount || 0);
  if (min > 0 && amount < min) amount = min;
  return Math.round(amount * 100) / 100;
}

function matchProduct(products: any[], sku: unknown, name: unknown, date?: string) {
  const s = norm(sku);
  const n = norm(name);
  return products.find((p) => {
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
  }) || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const now = new Date();
    // Standard: Vormonat abrechnen
    const start = body.from
      ? new Date(body.from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = body.to
      ? new Date(body.to)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const { data: licTenant } = await supabase
      .from('tenants').select('id').eq('code', 'LIC').maybeSingle();
    const licensorTenantId = licTenant?.id ?? null;

    const { data: settings } = await supabase
      .from('license_settings').select('*').eq('tenant_id', licensorTenantId).maybeSingle();

    if (!body.force && settings && settings.auto_generate === false) {
      return json({ skipped: true, reason: 'auto_generate deaktiviert' });
    }

    const { data: tenantRows } = await supabase
      .from('tenants').select('id,zoho_source_system').not('zoho_source_system', 'is', null);
    const tenantsBySource: Record<string, string> = {};
    (tenantRows || []).forEach((t: any) => { tenantsBySource[t.zoho_source_system] = t.id; });

    const { data: prodData } = await supabase
      .from('license_products').select('*').eq('is_licensable', true);
    const products = prodData || [];
    if (!products.length) return json({ from, to, created: 0, invoices: 0, note: 'keine lizenzpflichtigen Produkte' });

    const { data: invData } = await supabase
      .from('zoho_invoices')
      .select('id,invoice_number,invoice_date,currency,source_system,status,raw_data')
      .gte('invoice_date', from).lte('invoice_date', to)
      .in('status', ['sent', 'paid', 'partially_paid', 'overdue'])
      .limit(5000);
    const invoices = (invData || []).filter((i: any) => i.raw_data);

    const numbers = invoices.map((i: any) => i.invoice_number).filter(Boolean);
    const existing = new Set<string>();
    for (let i = 0; i < numbers.length; i += 200) {
      const { data: ex } = await supabase
        .from('royalty_transactions')
        .select('source_invoice_number,product_sku,product_name,serial_number')
        .in('source_invoice_number', numbers.slice(i, i + 200));
      (ex || []).forEach((r: any) =>
        existing.add(`${r.source_invoice_number}|${norm(r.product_sku || r.product_name)}|${r.serial_number || ''}`));
    }

    const rows: any[] = [];
    let amountTotal = 0;
    for (const inv of invoices as any[]) {
      const raw = typeof inv.raw_data === 'string' ? safeParse(inv.raw_data) : inv.raw_data;
      const items: any[] = raw?.line_items || [];
      for (const li of items) {
        const p = matchProduct(products, li.sku, li.name, inv.invoice_date);
        if (!p) continue;
        const qty = Number(li.quantity || 1);
        const net = Number(li.item_total ?? (Number(li.rate || 0) * qty - Number(li.discount_amount || 0)));
        const serials: string[] = Array.isArray(li.serial_numbers)
          ? li.serial_numbers.map((s: any) => (typeof s === 'string' ? s : s?.serial_number)).filter(Boolean)
          : [];
        const serial = serials.join(', ') || null;
        const key = `${inv.invoice_number}|${norm(li.sku || li.name)}|${serial || ''}`;
        if (existing.has(key)) continue;
        existing.add(key);
        const amount = computeRoyalty(p, net, qty);
        if (amount <= 0) continue;
        amountTotal += amount;
        rows.push({
          licensor_tenant_id: p.licensor_tenant_id || licensorTenantId,
          licensee_tenant_id: tenantsBySource[inv.source_system] || null,
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
      }
    }

    let created = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabase.from('royalty_transactions').insert(chunk);
      if (error) throw error;
      created += chunk.length;
    }

    // Lizenzrechnungen (Sammelrechnung je Mandant/Monat bzw. je Verkaufsrechnung)
    const mode = body.mode || settings?.billing_mode || 'monthly';
    const terms = Number(settings?.payment_terms_days || 14);
    const { data: openTx } = await supabase
      .from('royalty_transactions').select('*')
      .eq('status', 'offen')
      .gte('source_invoice_date', from).lte('source_invoice_date', to)
      .limit(5000);
    const tx = (openTx || []).filter((r: any) => r.licensee_tenant_id);

    const groups = new Map<string, any[]>();
    tx.forEach((r: any) => {
      const key = mode === 'single'
        ? `${r.licensee_tenant_id}|${r.source_invoice_number}`
        : `${r.licensee_tenant_id}|${String(r.source_invoice_date).slice(0, 7)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    let invoicesCreated = 0;
    let invoicedAmount = 0;
    for (const group of groups.values()) {
      const amount = group.reduce((s, r) => s + Number(r.royalty_amount || 0), 0);
      if (amount <= 0) continue;
      const dates = group.map((r) => r.source_invoice_date).sort();
      const due = new Date();
      due.setDate(due.getDate() + terms);

      const { data: inv, error } = await supabase.from('license_invoices').insert({
        licensor_tenant_id: licensorTenantId,
        licensee_tenant_id: group[0].licensee_tenant_id,
        period_start: dates[0],
        period_end: dates[dates.length - 1],
        due_date: due.toISOString().slice(0, 10),
        amount_net: Math.round(amount * 100) / 100,
        currency: group[0].currency || 'EUR',
        status: 'offen',
        notes: 'Lizenzgebühr gemäß Markenlizenzvertrag (automatischer Lauf)',
      }).select('id,invoice_number').single();
      if (error) throw error;

      await supabase.from('license_invoice_items').insert(group.map((r: any) => ({
        invoice_id: inv.id,
        royalty_transaction_id: r.id,
        description: `Royalty für ${r.product_name}${r.serial_number ? ` (SN ${r.serial_number})` : ''} – Verkaufsrechnung ${r.source_invoice_number}`,
        product_name: r.product_name,
        serial_number: r.serial_number,
        source_invoice_number: r.source_invoice_number,
        base_amount: r.net_amount,
        rate_percent: r.rate_percent,
        amount: r.royalty_amount,
      })));

      await supabase.from('royalty_transactions')
        .update({ status: 'abgerechnet', license_invoice_id: inv.id })
        .in('id', group.map((r: any) => r.id));

      await supabase.from('intercompany_invoices').insert({
        from_tenant_id: licensorTenantId,
        to_tenant_id: group[0].licensee_tenant_id,
        license_invoice_id: inv.id,
        category: 'lizenz',
        due_date: due.toISOString().slice(0, 10),
        amount_net: Math.round(amount * 100) / 100,
        currency: group[0].currency || 'EUR',
        status: 'offen',
        reference: inv.invoice_number,
        notes: 'Lizenzgebühr gemäß Markenlizenzvertrag (automatischer Lauf)',
      });

      invoicesCreated++;
      invoicedAmount += amount;
    }

    await supabase.from('license_audit_log').insert({
      entity: 'royalty_run',
      action: 'auto_run',
      payload: { from, to, created, amount: amountTotal, invoices: invoicesCreated, invoicedAmount, mode },
    });

    return json({ from, to, scanned: invoices.length, created, amount: amountTotal, invoices: invoicesCreated, invoicedAmount, mode });
  } catch (e) {
    console.error('license-royalty-run error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
