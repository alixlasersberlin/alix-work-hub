import { supabase } from '@/integrations/supabase/client';
import type { CrmSearchHit, CrmCustomerSummary, DuplicateCandidate } from './types';

// Live customer search across name/number/email/phone/serial/offer.
// Read-only – uses existing tables without modifying them.
export async function searchCustomers(term: string, limit = 12): Promise<CrmSearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const hits = new Map<string, CrmSearchHit>();
  const add = (h: CrmSearchHit) => { if (!hits.has(h.customerId)) hits.set(h.customerId, h); };

  // 1) customers by name/number/email/phone
  const { data: cust } = await supabase
    .from('customers')
    .select('id, customer_number, company_name, contact_name, email, phone, mobile')
    .or([
      `company_name.ilike.%${q}%`,
      `customer_number.ilike.%${q}%`,
      `email.ilike.%${q}%`,
      `phone.ilike.%${q}%`,
      `mobile.ilike.%${q}%`,
      `contact_name.ilike.%${q}%`,
    ].join(','))
    .limit(limit);
  (cust || []).forEach((c: any) => add({
    customerId: c.id,
    companyName: c.company_name || c.contact_name || 'Unbekannt',
    customerNumber: c.customer_number,
    matched: c.company_name || c.email || c.phone || '',
    matchField: 'name',
  }));

  // 2) device serial → customer
  const { data: dev } = await supabase
    .from('lager_devices')
    .select('id, serial_number, customer_id, model, customer_name')
    .ilike('serial_number', `%${q}%`)
    .limit(limit);
  (dev || []).forEach((d: any) => {
    if (!d.customer_id) return;
    add({
      customerId: d.customer_id,
      companyName: d.customer_name || 'Kunde',
      customerNumber: null,
      matched: `${d.model || 'Gerät'} · SN ${d.serial_number}`,
      matchField: 'serial',
    });
  });

  // 3) offer number → customer
  const { data: off } = await supabase
    .from('offers')
    .select('id, offer_number, customer_id, customer_name')
    .ilike('offer_number', `%${q}%`)
    .limit(limit);
  (off || []).forEach((o: any) => {
    if (!o.customer_id) return;
    add({
      customerId: o.customer_id,
      companyName: o.customer_name || 'Kunde',
      customerNumber: null,
      matched: `Angebot ${o.offer_number}`,
      matchField: 'offer',
    });
  });

  return Array.from(hits.values()).slice(0, limit);
}

export async function getCustomerSummary(id: string): Promise<CrmCustomerSummary | null> {
  const { data } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  const d = data as any;
  return {
    id: d.id,
    customerNumber: d.customer_number,
    companyName: d.company_name || d.contact_name || 'Kunde',
    contactPerson: d.contact_name,
    email: d.email,
    phone: d.phone,
    mobile: d.mobile,
    address: d.street || d.address,
    city: d.city,
    postalCode: d.postal_code,
    country: d.country,
    group: d.customer_group,
    salesRep: d.sales_rep,
    sourceSystem: d.source_system,
  };
}

export async function findDuplicates(input: {
  companyName?: string; email?: string; phone?: string; customerNumber?: string;
}): Promise<DuplicateCandidate[]> {
  const filters: string[] = [];
  if (input.companyName && input.companyName.length > 2) filters.push(`company_name.ilike.%${input.companyName}%`);
  if (input.email) filters.push(`email.ilike.%${input.email}%`);
  if (input.phone) filters.push(`phone.ilike.%${input.phone}%`);
  if (input.customerNumber) filters.push(`customer_number.eq.${input.customerNumber}`);
  if (!filters.length) return [];
  const { data } = await supabase
    .from('customers')
    .select('id, company_name, email, phone, customer_number')
    .or(filters.join(','))
    .limit(10);
  return (data || []).map((c: any) => {
    let reason: DuplicateCandidate['reason'] = 'name';
    let score = 0.5;
    if (input.customerNumber && c.customer_number === input.customerNumber) { reason = 'number'; score = 1; }
    else if (input.email && c.email && c.email.toLowerCase() === input.email.toLowerCase()) { reason = 'email'; score = 0.95; }
    else if (input.phone && c.phone === input.phone) { reason = 'phone'; score = 0.9; }
    return { customerId: c.id, companyName: c.company_name || 'Kunde', reason, score };
  });
}
