// Shared helpers for the AlixWork CardDAV contact service.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
export const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type CustomerRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  external_customer_id: string | null;
  source_system: string;
  accounting_region: string | null;
  billing_address: Record<string, unknown> | null;
  shipping_address: Record<string, unknown> | null;
  updated_at: string;
};

const pick = (o: Record<string, unknown> | null | undefined, ...keys: string[]) => {
  for (const k of keys) {
    const v = o?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
};

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Split "Maria Mustermann" -> { first, last } */
function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return { first: '', last: name.trim() };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

export function uidFor(c: { id: string }) {
  return `alixwork_customer_${c.id}`;
}

export function etagFor(c: CustomerRow) {
  return `"${new Date(c.updated_at).getTime().toString(36)}"`;
}

/** Build an iOS-friendly vCard 3.0 from an AlixWork customer. */
export function toVCard(c: CustomerRow, opts?: { owner?: string | null }) {
  const addr = (c.billing_address ?? {}) as Record<string, unknown>;
  const ship = (c.shipping_address ?? {}) as Record<string, unknown>;
  const company = c.company_name?.trim() || '';
  const contact = c.contact_name?.trim() || '';
  const { first, last } = splitName(contact || company);

  const street = [pick(addr, 'street', 'address', 'address1', 'strasse'), pick(addr, 'street2', 'address2', 'house_number', 'hausnummer')]
    .filter(Boolean).join(' ') || pick(ship, 'street', 'address', 'address1');
  const zip = pick(addr, 'zip', 'zip_code', 'postal_code', 'plz') || pick(ship, 'zip', 'zip_code', 'postal_code');
  const city = pick(addr, 'city', 'ort') || pick(ship, 'city');
  const country = pick(addr, 'country', 'land') || pick(ship, 'country');
  const website = pick(addr, 'website', 'url');
  const phone2 = pick(addr, 'phone', 'telephone');
  const mobile = pick(addr, 'mobile', 'mobil', 'cell');
  const email2 = pick(addr, 'email');

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `PRODID:-//Alix Lasers//AlixWork CardDAV//DE`,
    `UID:${uidFor(c)}`,
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(company || contact || 'Kunde')}`,
  ];
  if (company) lines.push(`ORG:${esc(company)}`);
  if (contact && company) lines.push(`TITLE:${esc('Ansprechpartner: ' + contact)}`);
  if (mobile) lines.push(`TEL;TYPE=CELL,VOICE:${esc(mobile)}`);
  if (c.phone) lines.push(`TEL;TYPE=WORK,VOICE:${esc(c.phone)}`);
  if (phone2 && phone2 !== c.phone) lines.push(`TEL;TYPE=WORK,VOICE:${esc(phone2)}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${esc(c.email)}`);
  if (email2 && email2 !== c.email) lines.push(`EMAIL;TYPE=INTERNET,OTHER:${esc(email2)}`);
  if (street || zip || city || country) {
    lines.push(`ADR;TYPE=WORK:;;${esc(street)};${esc(city)};;${esc(zip)};${esc(country)}`);
  }
  if (website) lines.push(`URL:${esc(website)}`);
  if (c.external_customer_id) lines.push(`X-ALIXWORK-CUSTOMER-NO:${esc(c.external_customer_id)}`);
  lines.push(`X-ALIXWORK-ID:${esc(c.id)}`);
  if (opts?.owner) lines.push(`X-ALIXWORK-OWNER:${esc(opts.owner)}`);
  lines.push('CATEGORIES:ALIXWORK');
  lines.push(`REV:${new Date(c.updated_at).toISOString().replace(/\.\d+Z$/, 'Z')}`);
  lines.push('END:VCARD');
  return lines.join('\r\n') + '\r\n';
}

export const CUSTOMER_FIELDS =
  'id, company_name, contact_name, email, phone, external_customer_id, source_system, accounting_region, billing_address, shipping_address, updated_at';

/**
 * Resolve which customers a user may sync, honouring the configured scope.
 * Never returns payment, banking or internal note fields.
 */
export async function loadScopedCustomers(userId: string, scope: string, scopeValue: string | null) {
  const db = admin();
  if (!scope || scope === 'none') return [] as CustomerRow[];

  const out: CustomerRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = db.from('customers').select(CUSTOMER_FIELDS).order('updated_at', { ascending: false }).range(from, from + PAGE - 1);

    if (scope === 'own' || scope === 'sales' || scope === 'service' || scope === 'branch') {
      q = q.eq('user_id', userId);
    } else if (scope === 'region') {
      q = q.eq('accounting_region', (scopeValue || 'EU').toUpperCase());
    } else if (scope === 'tenant') {
      const code = (scopeValue || 'DE').toUpperCase();
      q = q.eq('source_system', code === 'AT' ? 'zoho_eu_2' : 'zoho_eu_1');
    }

    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as CustomerRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    if (out.length >= 20000) break;
  }
  return out;
}
