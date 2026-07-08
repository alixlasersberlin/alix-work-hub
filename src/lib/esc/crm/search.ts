import { supabase } from '@/integrations/supabase/client';
import type { CrmSearchHit, CrmCustomerSummary, DuplicateCandidate } from './types';

export async function searchCustomers(term: string, limit = 12): Promise<CrmSearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const hits = new Map<string, CrmSearchHit>();
  const add = (h: CrmSearchHit) => { if (!hits.has(h.customerId)) hits.set(h.customerId, h); };

  const { data: cust } = await supabase
    .from('customers')
    .select('id, external_customer_id, company_name, contact_name, email, phone')
    .or([
      `company_name.ilike.%${q}%`,
      `external_customer_id.ilike.%${q}%`,
      `email.ilike.%${q}%`,
      `phone.ilike.%${q}%`,
      `contact_name.ilike.%${q}%`,
    ].join(','))
    .limit(limit);
  (cust || []).forEach((c: any) => add({
    customerId: c.id,
    companyName: c.company_name || c.contact_name || 'Unbekannt',
    customerNumber: c.external_customer_id,
    matched: c.company_name || c.email || c.phone || '',
    matchField: 'name',
  }));

  // Serial → customer (lager_devices only has customer_email/name — resolve back)
  const { data: dev } = await supabase
    .from('lager_devices')
    .select('id, serial_number, model_name, customer_email, customer_name')
    .ilike('serial_number', `%${q}%`)
    .limit(limit);
  for (const d of (dev || []) as any[]) {
    const email = d.customer_email;
    if (!email) continue;
    const { data: c } = await supabase.from('customers').select('id, company_name, external_customer_id').ilike('email', email).limit(1).maybeSingle();
    if (c) add({
      customerId: (c as any).id,
      companyName: (c as any).company_name || d.customer_name || 'Kunde',
      customerNumber: (c as any).external_customer_id,
      matched: `${d.model_name || 'Gerät'} · SN ${d.serial_number}`,
      matchField: 'serial',
    });
  }

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
  const billing = (d.billing_address || {}) as Record<string, string>;
  return {
    id: d.id,
    customerNumber: d.external_customer_id,
    companyName: d.company_name || d.contact_name || 'Kunde',
    contactPerson: d.contact_name,
    email: d.email,
    phone: d.phone,
    mobile: null,
    address: billing.street || billing.address || null,
    city: billing.city || null,
    postalCode: billing.postal_code || billing.zip || null,
    country: billing.country || null,
    group: null,
    salesRep: null,
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
  if (input.customerNumber) filters.push(`external_customer_id.eq.${input.customerNumber}`);
  if (!filters.length) return [];
  const { data } = await supabase
    .from('customers')
    .select('id, company_name, email, phone, external_customer_id')
    .or(filters.join(','))
    .limit(10);
  return (data || []).map((c: any) => {
    let reason: DuplicateCandidate['reason'] = 'name';
    let score = 0.5;
    if (input.customerNumber && c.external_customer_id === input.customerNumber) { reason = 'number'; score = 1; }
    else if (input.email && c.email && c.email.toLowerCase() === input.email.toLowerCase()) { reason = 'email'; score = 0.95; }
    else if (input.phone && c.phone === input.phone) { reason = 'phone'; score = 0.9; }
    return { customerId: c.id, companyName: c.company_name || 'Kunde', reason, score };
  });
}
