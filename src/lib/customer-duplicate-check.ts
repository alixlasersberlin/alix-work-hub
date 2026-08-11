import { supabase } from '@/integrations/supabase/client';

export interface DuplicateInput {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
}

export interface DuplicateHit {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  external_customer_id: string | null;
  address: string;
  matches: string[];
}

const esc = (v: string) => v.replace(/[,()%]/g, ' ').trim();
const digits = (v: string) => v.replace(/\D/g, '');

/**
 * Sucht potenzielle Dubletten anhand E-Mail, Name, Telefon und Anschrift.
 * Trifft EIN Parameter zu, wird der Kandidat gemeldet – die Entscheidung
 * (trotzdem anlegen oder abbrechen) trifft der Anwender.
 */
export async function findPotentialDuplicates(input: DuplicateInput): Promise<DuplicateHit[]> {
  const filters: string[] = [];
  const email = input.email?.trim().toLowerCase();
  const company = input.company_name?.trim();
  const contact = input.contact_name?.trim();
  const phone = digits(input.phone ?? '');
  const street = input.street?.trim();
  const zip = input.zip?.trim();

  if (email && email.length > 3) filters.push(`email.ilike.${esc(email)}`);
  if (company && company.length >= 3) filters.push(`company_name.ilike.%${esc(company)}%`);
  if (contact && contact.length >= 3) filters.push(`contact_name.ilike.%${esc(contact)}%`);
  if (phone.length >= 6) filters.push(`phone.ilike.%${phone.slice(-7)}%`);
  if (!filters.length && !(street && zip)) return [];

  const rows: any[] = [];

  if (filters.length) {
    const { data } = await supabase
      .from('customers')
      .select('id, company_name, contact_name, email, phone, external_customer_id, billing_address')
      .or(filters.join(','))
      .limit(25);
    rows.push(...(data ?? []));
  }

  // Adress-Treffer separat (JSONB-Felder lassen sich nicht sauber in .or() mischen)
  if (street && street.length >= 4 && zip) {
    const { data } = await supabase
      .from('customers')
      .select('id, company_name, contact_name, email, phone, external_customer_id, billing_address')
      .filter('billing_address->>zip', 'eq', zip)
      .limit(50);
    for (const r of data ?? []) {
      const s = String((r as any).billing_address?.address ?? (r as any).billing_address?.street ?? '').toLowerCase();
      if (s && s.includes(street.toLowerCase().slice(0, 6))) rows.push(r);
    }
  }

  const byId = new Map<string, DuplicateHit>();
  for (const r of rows) {
    if (byId.has(r.id)) continue;
    const ba = r.billing_address ?? {};
    const matches: string[] = [];
    if (email && r.email && String(r.email).toLowerCase() === email) matches.push('E-Mail');
    if (company && r.company_name && String(r.company_name).toLowerCase().includes(company.toLowerCase())) matches.push('Firma');
    if (contact && r.contact_name && String(r.contact_name).toLowerCase().includes(contact.toLowerCase())) matches.push('Kontakt');
    if (phone.length >= 6 && r.phone && digits(String(r.phone)).endsWith(phone.slice(-7))) matches.push('Telefon');
    const s = String(ba.address ?? ba.street ?? '').toLowerCase();
    if (street && zip && String(ba.zip ?? '') === zip && s.includes(street.toLowerCase().slice(0, 6))) matches.push('Anschrift');
    if (!matches.length) continue;
    byId.set(r.id, {
      id: r.id,
      company_name: r.company_name,
      contact_name: r.contact_name,
      email: r.email,
      phone: r.phone,
      external_customer_id: r.external_customer_id,
      address: [ba.address ?? ba.street, ba.zip, ba.city].filter(Boolean).join(', '),
      matches,
    });
  }

  return Array.from(byId.values()).sort((a, b) => b.matches.length - a.matches.length).slice(0, 10);
}
