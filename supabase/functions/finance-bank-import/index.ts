// Phase 4: Bankimport (CAMT.053 XML + MT940). Parst, speichert finance_bank_statements + lines,
// versucht Auto-Matching gegen offene finance_transactions (Verwendungszweck = Referenz oder
// Belegnummer; Betrag exakt). Bei Treffer: line.status=zugeordnet, matched_transaction_id gesetzt.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ParsedLine {
  booking_date: string | null;
  value_date: string | null;
  amount: number;
  currency: string;
  purpose: string;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  end_to_end_id: string | null;
}
interface Parsed {
  iban: string | null;
  account_name: string | null;
  period_from: string | null;
  period_to: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  currency: string;
  lines: ParsedLine[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const { filename, content } = await req.json();
    if (!content || typeof content !== 'string') {
      return new Response(JSON.stringify({ error: 'content (string) erforderlich' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // File hash for dedupe
    const buf = new TextEncoder().encode(content);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const file_hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: existing } = await admin.from('finance_bank_statements').select('id, line_count, matched_count').eq('file_hash', file_hash).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ ok: true, duplicate: true, statement_id: existing.id, lines: existing.line_count, matched: existing.matched_count }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const format = detectFormat(content);
    const parsed = format === 'CAMT.053' ? parseCamt053(content) : parseMt940(content);

    // Get caller user_id (best effort)
    let uploaded_by: string | null = null;
    try {
      const a = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data } = await a.auth.getUser(authHeader.replace('Bearer ', ''));
      uploaded_by = data?.user?.id ?? null;
    } catch { /* ignore */ }

    const { data: stmt, error: sErr } = await admin.from('finance_bank_statements').insert({
      iban: parsed.iban, account_name: parsed.account_name, format, filename: filename ?? null,
      period_from: parsed.period_from, period_to: parsed.period_to,
      opening_balance: parsed.opening_balance, closing_balance: parsed.closing_balance,
      currency: parsed.currency, line_count: parsed.lines.length, file_hash, uploaded_by,
    }).select('id').single();
    if (sErr || !stmt) throw new Error(sErr?.message ?? 'Statement insert failed');

    // Insert lines
    const lineRows = parsed.lines.map((l) => ({
      statement_id: stmt.id,
      booking_date: l.booking_date, value_date: l.value_date,
      amount: l.amount, currency: l.currency,
      purpose: l.purpose, counterparty_name: l.counterparty_name, counterparty_iban: l.counterparty_iban,
      end_to_end_id: l.end_to_end_id,
      status: 'offen',
      line_hash: hashLine(l),
    }));
    if (lineRows.length) await admin.from('finance_bank_lines').insert(lineRows);

    // Auto-match: positive amounts vs. open finance_transactions
    const { data: lines } = await admin.from('finance_bank_lines').select('id, amount, purpose').eq('statement_id', stmt.id).eq('status', 'offen');
    let matched = 0;
    for (const l of (lines ?? []) as any[]) {
      if (Number(l.amount) <= 0) continue;
      const refs = extractRefs(String(l.purpose ?? ''));
      if (refs.length === 0) continue;
      const { data: candidates } = await admin
        .from('finance_transactions')
        .select('id, amount, customer_id, reference, notes')
        .eq('transaction_type', 'Rechnung')
        .or(refs.map(r => `notes.ilike.%${r}%,reference.ilike.%${r}%`).join(','))
        .limit(20);
      const hit = (candidates ?? []).find((c: any) => Math.abs(Number(c.amount) - Number(l.amount)) < 0.01);
      if (hit) {
        await admin.from('finance_bank_lines').update({
          status: 'zugeordnet',
          matched_transaction_id: hit.id,
          matched_customer_id: hit.customer_id,
          match_confidence: 0.95, match_method: 'auto:ref+amount',
          matched_at: new Date().toISOString(),
        }).eq('id', l.id);
        matched++;
      }
    }
    if (matched > 0) {
      await admin.from('finance_bank_statements').update({ matched_count: matched }).eq('id', stmt.id);
    }

    return new Response(JSON.stringify({ ok: true, statement_id: stmt.id, format, lines: parsed.lines.length, matched }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function detectFormat(c: string): 'CAMT.053' | 'MT940' {
  if (c.trimStart().startsWith('<') || c.includes('camt.053')) return 'CAMT.053';
  return 'MT940';
}

function hashLine(l: ParsedLine): string {
  return [l.booking_date, l.amount.toFixed(2), (l.purpose ?? '').slice(0, 80), l.counterparty_iban ?? ''].join('|');
}

function extractRefs(text: string): string[] {
  const refs = new Set<string>();
  // Match common invoice patterns like INV-2024-1234, RG12345, 2024/123, AT-2024-...
  const patterns = [/[A-Z]{2,5}-?\d{2,4}-?\d{3,8}/g, /\bRG\s?\d{3,10}/gi, /\b\d{4}\/\d{3,8}/g, /\b\d{6,12}\b/g];
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) for (const m of matches) refs.add(m.replace(/\s+/g, ''));
  }
  return [...refs].slice(0, 10);
}

// ============== CAMT.053 (very forgiving regex parser; works for typical Bundesbank format) ==============
function parseCamt053(xml: string): Parsed {
  const iban = pick(xml, /<IBAN>([^<]+)<\/IBAN>/);
  const account_name = pick(xml, /<Nm>([^<]+)<\/Nm>/);
  const period_from = isoDate(pick(xml, /<FrDtTm>([^<]+)<\/FrDtTm>/));
  const period_to = isoDate(pick(xml, /<ToDtTm>([^<]+)<\/ToDtTm>/));
  const lines: ParsedLine[] = [];

  // Each Ntry is one booking entry
  const entryRe = /<Ntry>([\s\S]*?)<\/Ntry>/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1];
    const amtMatch = e.match(/<Amt[^>]*Ccy="([^"]+)"[^>]*>([\d.]+)<\/Amt>/);
    if (!amtMatch) continue;
    const currency = amtMatch[1];
    let amount = Number(amtMatch[2]);
    const cdt = pick(e, /<CdtDbtInd>([^<]+)<\/CdtDbtInd>/);
    if (cdt === 'DBIT') amount = -amount;
    const booking_date = isoDate(pick(e, /<BookgDt>[\s\S]*?<Dt>([^<]+)<\/Dt>/)) ?? isoDate(pick(e, /<BookgDt>[\s\S]*?<DtTm>([^<]+)<\/DtTm>/));
    const value_date = isoDate(pick(e, /<ValDt>[\s\S]*?<Dt>([^<]+)<\/Dt>/));
    const purpose = (pick(e, /<Ustrd>([^<]+)<\/Ustrd>/) ?? pick(e, /<AddtlNtryInf>([^<]+)<\/AddtlNtryInf>/) ?? '').trim();
    const counterparty_name = pick(e, /<RltdPties>[\s\S]*?<Nm>([^<]+)<\/Nm>/);
    const counterparty_iban = pick(e, /<RltdPties>[\s\S]*?<IBAN>([^<]+)<\/IBAN>/);
    const end_to_end_id = pick(e, /<EndToEndId>([^<]+)<\/EndToEndId>/);
    lines.push({ booking_date, value_date, amount, currency, purpose, counterparty_name, counterparty_iban, end_to_end_id });
  }
  const opening = Number(pick(xml, /<Bal>[\s\S]*?<Cd>OPBD<\/Cd>[\s\S]*?<Amt[^>]*>([\d.]+)<\/Amt>/) ?? 'NaN');
  const closing = Number(pick(xml, /<Bal>[\s\S]*?<Cd>CLBD<\/Cd>[\s\S]*?<Amt[^>]*>([\d.]+)<\/Amt>/) ?? 'NaN');
  return {
    iban, account_name, period_from, period_to,
    opening_balance: isNaN(opening) ? null : opening,
    closing_balance: isNaN(closing) ? null : closing,
    currency: 'EUR', lines,
  };
}

function pick(s: string, re: RegExp): string | null {
  const m = s.match(re);
  return m ? m[1] : null;
}
function isoDate(v: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

// ============== MT940 (simple swift parser) ==============
function parseMt940(text: string): Parsed {
  const lines = text.split(/\r?\n/);
  let iban: string | null = null;
  let opening: number | null = null, closing: number | null = null;
  let period_from: string | null = null, period_to: string | null = null;
  const out: ParsedLine[] = [];
  let cur: Partial<ParsedLine> | null = null;
  let purposeBuf = '';
  const flush = () => {
    if (cur && cur.amount !== undefined) {
      out.push({
        booking_date: cur.booking_date ?? null,
        value_date: cur.value_date ?? null,
        amount: cur.amount as number,
        currency: cur.currency ?? 'EUR',
        purpose: purposeBuf.trim(),
        counterparty_name: cur.counterparty_name ?? null,
        counterparty_iban: cur.counterparty_iban ?? null,
        end_to_end_id: cur.end_to_end_id ?? null,
      });
    }
    cur = null; purposeBuf = '';
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith(':25:')) iban = line.slice(4).trim();
    else if (line.startsWith(':60F:') || line.startsWith(':60M:')) {
      const m = line.match(/:60[FM]:([CD])(\d{6})(\w{3})([\d,]+)/);
      if (m) { opening = (m[1] === 'D' ? -1 : 1) * Number(m[4].replace(',', '.')); period_from = mt940Date(m[2]); }
    } else if (line.startsWith(':62F:') || line.startsWith(':62M:')) {
      const m = line.match(/:62[FM]:([CD])(\d{6})(\w{3})([\d,]+)/);
      if (m) { closing = (m[1] === 'D' ? -1 : 1) * Number(m[4].replace(',', '.')); period_to = mt940Date(m[2]); }
    } else if (line.startsWith(':61:')) {
      flush();
      const m = line.match(/:61:(\d{6})(\d{4})?([CD])R?([\d,]+)/);
      if (m) {
        cur = {
          value_date: mt940Date(m[1]),
          booking_date: m[2] ? mt940Date(m[1].slice(0, 2) + m[2]) : mt940Date(m[1]),
          amount: (m[3] === 'D' ? -1 : 1) * Number(m[4].replace(',', '.')),
          currency: 'EUR',
        };
      }
    } else if (line.startsWith(':86:')) {
      purposeBuf += ' ' + line.slice(4);
    } else if (cur && line.startsWith('?')) {
      purposeBuf += ' ' + line;
    }
  }
  flush();
  return { iban, account_name: null, period_from, period_to, opening_balance: opening, closing_balance: closing, currency: 'EUR', lines: out };
}
function mt940Date(s: string): string | null {
  if (!/^\d{6}$/.test(s)) return null;
  const yy = Number(s.slice(0, 2));
  const year = yy < 70 ? 2000 + yy : 1900 + yy;
  return `${year}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
}
