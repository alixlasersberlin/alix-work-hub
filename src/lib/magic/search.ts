import { supabase } from '@/integrations/supabase/client';

export type MagicKind =
  | 'auftrag' | 'kunde' | 'geraet' | 'bestellung' | 'lieferantenbestellung'
  | 'seriennummer' | 'rechnung' | 'ticket';

export const MAGIC_KIND_LABEL: Record<MagicKind, string> = {
  auftrag: 'AUFTRÄGE',
  kunde: 'KUNDEN',
  geraet: 'GERÄTE',
  bestellung: 'BESTELLUNGEN',
  lieferantenbestellung: 'LIEFERANTENBESTELLUNGEN',
  seriennummer: 'SERIENNUMMERN',
  rechnung: 'RECHNUNGEN',
  ticket: 'TICKETS',
};

export interface MagicHit {
  kind: MagicKind;
  id: string;
  /** verknüpfter Auftrag (falls vorhanden) – Basis der Magic-Akte */
  orderId?: string | null;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  matched?: string | null;
}

const esc = (s: string) => s.replace(/[,()]/g, ' ').trim();

export async function magicSearch(term: string, limit = 12): Promise<MagicHit[]> {
  const q = esc(term);
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [orders, customers, prod, devices, invoices, tickets] = await Promise.all([
    supabase.from('orders')
      .select('id, order_number, internal_number, case_number, source_system, order_status, magic_status, total_amount, currency, customer_id, customers(company_name, contact_name)')
      .or([
        `order_number.ilike.${like}`,
        `internal_number.ilike.${like}`,
        `case_number.ilike.${like}`,
        `external_order_id.ilike.${like}`,
      ].join(','))
      .limit(limit),
    supabase.from('customers')
      .select('id, company_name, contact_name, email, phone, external_customer_id')
      .or([
        `company_name.ilike.${like}`,
        `contact_name.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `external_customer_id.ilike.${like}`,
      ].join(','))
      .limit(limit),
    supabase.from('production_orders')
      .select('id, order_number, production_order_number, seriennummer, modellname, status, order_id, customer_name_snapshot')
      .or([
        `order_number.ilike.${like}`,
        `production_order_number.ilike.${like}`,
        `seriennummer.ilike.${like}`,
        `modellname.ilike.${like}`,
      ].join(','))
      .limit(limit),
    supabase.from('lager_devices')
      .select('id, serial_number, model_name, device_status, customer_name, customer_email, reserved_order_id, delivered_order_id')
      .or([
        `serial_number.ilike.${like}`,
        `model_name.ilike.${like}`,
        `customer_name.ilike.${like}`,
        `customer_email.ilike.${like}`,
      ].join(','))
      .limit(limit),
    supabase.from('zoho_invoices')
      .select('id, invoice_number, customer_name, status, balance, total, currency')
      .or([`invoice_number.ilike.${like}`, `customer_name.ilike.${like}`, `reference_number.ilike.${like}`].join(','))
      .limit(limit),
    supabase.from('tickets')
      .select('id, ticket_number, case_number, subject, title, status, customer_name, serial_number, order_id')
      .or([
        `ticket_number.ilike.${like}`,
        `case_number.ilike.${like}`,
        `subject.ilike.${like}`,
        `serial_number.ilike.${like}`,
        `customer_name.ilike.${like}`,
      ].join(','))
      .limit(limit),
  ]);

  const hits: MagicHit[] = [];

  for (const o of (orders.data ?? []) as any[]) {
    const c = o.customers as any;
    hits.push({
      kind: 'auftrag', id: o.id, orderId: o.id,
      title: `${o.order_number}${o.source_system === 'zoho_eu_2' ? '-AT' : ''}`,
      subtitle: c?.company_name || c?.contact_name || null,
      meta: [o.magic_status ?? o.order_status, o.total_amount != null ? `${Number(o.total_amount).toLocaleString('de-DE')} ${o.currency ?? 'EUR'}` : null].filter(Boolean).join(' · '),
    });
  }
  for (const c of (customers.data ?? []) as any[]) {
    hits.push({
      kind: 'kunde', id: c.id,
      title: c.company_name || c.contact_name || 'Kunde',
      subtitle: [c.contact_name, c.email, c.phone].filter(Boolean).join(' · '),
      meta: c.external_customer_id,
    });
  }
  for (const p of (prod.data ?? []) as any[]) {
    const isSerial = p.seriennummer && p.seriennummer.toLowerCase().includes(q.toLowerCase());
    hits.push({
      kind: isSerial ? 'seriennummer' : 'lieferantenbestellung',
      id: p.id, orderId: p.order_id,
      title: p.production_order_number ? `${p.production_order_number}-${p.order_number}` : p.order_number,
      subtitle: [p.modellname, p.customer_name_snapshot].filter(Boolean).join(' · '),
      meta: [p.status, p.seriennummer ? `SN ${p.seriennummer}` : 'SN offen'].filter(Boolean).join(' · '),
    });
  }
  for (const d of (devices.data ?? []) as any[]) {
    hits.push({
      kind: d.serial_number && d.serial_number.toLowerCase().includes(q.toLowerCase()) ? 'seriennummer' : 'geraet',
      id: d.id, orderId: d.delivered_order_id || d.reserved_order_id,
      title: d.serial_number || d.model_name || 'Gerät',
      subtitle: [d.model_name, d.customer_name].filter(Boolean).join(' · '),
      meta: d.device_status,
    });
  }
  for (const i of (invoices.data ?? []) as any[]) {
    hits.push({
      kind: 'rechnung', id: i.id,
      title: i.invoice_number,
      subtitle: i.customer_name,
      meta: [i.status, i.balance != null ? `offen ${Number(i.balance).toLocaleString('de-DE')} ${i.currency ?? 'EUR'}` : null].filter(Boolean).join(' · '),
    });
  }
  for (const t of (tickets.data ?? []) as any[]) {
    hits.push({
      kind: 'ticket', id: t.id, orderId: t.order_id,
      title: t.ticket_number || t.case_number || 'Ticket',
      subtitle: t.subject || t.title,
      meta: [t.status, t.customer_name].filter(Boolean).join(' · '),
    });
  }

  return hits;
}

export function groupHits(hits: MagicHit[]) {
  const order: MagicKind[] = ['auftrag', 'kunde', 'geraet', 'bestellung', 'lieferantenbestellung', 'seriennummer', 'rechnung', 'ticket'];
  return order
    .map((k) => [k, hits.filter((h) => h.kind === k)] as const)
    .filter(([, arr]) => arr.length > 0);
}
