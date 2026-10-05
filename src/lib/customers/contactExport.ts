import { supabase } from '@/integrations/supabase/client';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HEADER = ['Kontakt-E-Mail', 'Vorname', 'Nachname', 'Mobil', 'Opt-in', 'Bestätigungszeit', 'Datenschutzbestimmungen und Bedingungen zugestimmt', 'Opt-In-Typ'];

function splitName(raw: string): [string, string] {
  const n = raw.replace(/^(Frau|Herr|Mrs\.?|Mr\.?)\s+/i, '').trim();
  if (!n) return ['', ''];
  if (n.includes(',')) { const [l, f] = n.split(',').map(s => s.trim()); return [f || '', l || '']; }
  const parts = n.split(/\s+/);
  if (parts.length === 1) return ['', parts[0]];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Exportiert alle Kunden mit gültiger E-Mail im Format der Kontakt-Vorlage (Test2.csv). */
export async function exportCustomerContactsCsv(): Promise<number> {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('customers')
      .select('email, contact_name, company_name, phone')
      .not('email', 'is', null).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const seen = new Set<string>();
  const out: string[] = [HEADER.join(',')];
  for (const r of rows) {
    const email = String(r.email ?? '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    const [first, last] = splitName(String(r.contact_name || r.company_name || ''));
    const phone = String(r.phone ?? '').trim();
    out.push([email, first, last, phone, 'false', '', 'false', 'Keine'].map(esc).join(','));
  }
  const blob = new Blob([out.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Kundenkontakte_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  return seen.size;
}
