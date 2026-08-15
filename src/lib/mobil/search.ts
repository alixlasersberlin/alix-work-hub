import { supabase } from '@/integrations/supabase/client';
import { escapeOr, formatAddress } from './utils';

export interface MobilHit {
  kind: 'kunde' | 'auftrag' | 'geraet' | 'reparatur' | 'tour';
  id: string;
  title: string;
  subtitle?: string;
  address?: string;
  phone?: string | null;
  customerId?: string | null;
  orderNumber?: string | null;
  serial?: string | null;
}

/** Zentrale Suche – nutzt ausschließlich bestehende Tabellen (RLS greift wie im Desktop). */
export async function mobilSearch(rawTerm: string): Promise<MobilHit[]> {
  const term = escapeOr(rawTerm);
  if (term.length < 2) return [];
  const like = `%${term}%`;

  const [customers, orders, appts, repairs, tours] = await Promise.all([
    supabase
      .from('customers')
      .select('id, company_name, contact_name, email, phone, external_customer_id, billing_address, shipping_address')
      .or(
        [
          `company_name.ilike.${like}`,
          `contact_name.ilike.${like}`,
          `email.ilike.${like}`,
          `phone.ilike.${like}`,
          `external_customer_id.ilike.${like}`,
        ].join(','),
      )
      .limit(25),
    supabase
      .from('orders')
      .select('id, order_number, order_status, customer_id, shipping_address, billing_address, customers:customer_id(company_name, contact_name, phone)')
      .ilike('order_number', like)
      .limit(25),
    supabase
      .from('delivery_appointments')
      .select(
        'id, customer_name, company_name, order_number, device_name, serial_number, delivery_street, delivery_zip, delivery_city, contact_phone, contact_mobile',
      )
      .or(
        [
          `customer_name.ilike.${like}`,
          `company_name.ilike.${like}`,
          `order_number.ilike.${like}`,
          `serial_number.ilike.${like}`,
          `device_name.ilike.${like}`,
          `delivery_street.ilike.${like}`,
          `delivery_zip.ilike.${like}`,
          `delivery_city.ilike.${like}`,
          `contact_phone.ilike.${like}`,
          `contact_mobile.ilike.${like}`,
        ].join(','),
      )
      .limit(30),
    (supabase as any)
      .from('repair_orders')
      .select('id, repair_number, customer_name, device_brand, device_model, device_serial_number, repair_status')
      .or(
        [
          `repair_number.ilike.${like}`,
          `customer_name.ilike.${like}`,
          `device_serial_number.ilike.${like}`,
        ].join(','),
      )
      .limit(15),


    supabase
      .from('delivery_tours')
      .select('id, tour_number, title, tour_date, status')
      .or([`tour_number.ilike.${like}`, `title.ilike.${like}`].join(','))
      .limit(10),
  ]);

  const hits: MobilHit[] = [];

  for (const c of (customers.data ?? []) as any[]) {
    hits.push({
      kind: 'kunde',
      id: c.id,
      title: c.company_name || c.contact_name || 'Kunde',
      subtitle: [c.contact_name, c.external_customer_id].filter(Boolean).join(' · '),
      address: formatAddress(c.shipping_address) || formatAddress(c.billing_address),
      phone: c.phone,
      customerId: c.id,
    });
  }

  for (const o of (orders.data ?? []) as any[]) {
    hits.push({
      kind: 'auftrag',
      id: o.id,
      title: o.order_number,
      subtitle: [o.customers?.company_name || o.customers?.contact_name, o.order_status].filter(Boolean).join(' · '),
      address: formatAddress(o.shipping_address) || formatAddress(o.billing_address),
      phone: o.customers?.phone ?? null,
      customerId: o.customer_id,
      orderNumber: o.order_number,
    });
  }

  for (const a of (appts.data ?? []) as any[]) {
    const address = [a.delivery_street, [a.delivery_zip, a.delivery_city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    hits.push({
      kind: a.serial_number ? 'geraet' : 'auftrag',
      id: a.id,
      title: a.company_name || a.customer_name || a.device_name || 'Termin',
      subtitle: [a.device_name, a.serial_number ? `SN: ${a.serial_number}` : null, a.order_number]
        .filter(Boolean)
        .join(' · '),
      address,
      phone: a.contact_mobile || a.contact_phone,
      orderNumber: a.order_number,
      serial: a.serial_number,
    });
  }

  for (const r of (repairs.data ?? []) as any[]) {
    hits.push({
      kind: 'reparatur',
      id: r.id,
      title: r.repair_number,
      subtitle: [r.customer_name, [r.device_brand, r.device_model].filter(Boolean).join(' '), r.status]
        .filter(Boolean)
        .join(' · '),
      serial: r.device_serial_number,
    });
  }

  for (const t of (tours.data ?? []) as any[]) {
    hits.push({
      kind: 'tour',
      id: t.id,
      title: t.tour_number,
      subtitle: [t.title, t.tour_date].filter(Boolean).join(' · '),
    });
  }

  return hits;
}

export const KIND_LABEL: Record<MobilHit['kind'], string> = {
  kunde: 'KUNDEN',
  auftrag: 'AUFTRÄGE',
  geraet: 'GERÄTE',
  reparatur: 'REPARATUREN',
  tour: 'TOUREN',
};
