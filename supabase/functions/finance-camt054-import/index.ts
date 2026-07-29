// CAMT.054 (Bank-to-Customer Debit/Credit Notification) parser + auto-match against finance_qr_invoices
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function tag(x: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = x.match(re); return m ? m[1].trim() : '';
}
function tagAll(x: string, name: string): string[] {
  const re = new RegExp(`<${name}[^>]*>[\\s\\S]*?</${name}>`, 'gi');
  return x.match(re) ?? [];
}
function amtOf(x: string, name = 'Amt'): number {
  const re = new RegExp(`<${name}[^>]*>([\\d.,-]+)</${name}>`, 'i');
  const m = x.match(re); return m ? Number(m[1].replace(',', '.')) : 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const { filename, content } = await req.json();
    if (!content) throw new Error('content erforderlich');
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    const file_hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: existing } = await admin.from('finance_camt054_notifications').select('id, entry_count, matched_count').eq('file_hash', file_hash).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ notification_id: existing.id, duplicate: true, ...existing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageId = tag(content, 'MsgId');
    const acctIban = tag(content, 'IBAN');
    const currency = (content.match(/Ccy="([A-Z]{3})"/)?.[1]) || 'CHF';
    const bookingDate = (tag(content, 'CreDtTm') || '').slice(0, 10) || null;

    // Notification insert
    const { data: notif, error: nErr } = await admin.from('finance_camt054_notifications').insert({
      filename: filename ?? 'camt054.xml',
      file_hash,
      message_id: messageId || null,
      account_iban: acctIban || null,
      currency,
      booking_date: bookingDate,
      raw_xml: content,
      status: 'importiert',
    }).select().single();
    if (nErr) throw nErr;

    // Parse entries (Ntry blocks); many CH bank flavors nest TxDtls under NtryDtls
    const entries = tagAll(content, 'Ntry');
    let total = 0, matched = 0;
    for (const ntry of entries) {
      const bookDate = tag(ntry, 'BookgDt').match(/<Dt>([^<]+)<\/Dt>/)?.[1] || bookingDate;
      const valDate = tag(ntry, 'ValDt').match(/<Dt>([^<]+)<\/Dt>/)?.[1] || null;
      const cdtDbt = tag(ntry, 'CdtDbtInd') || 'CRDT';
      const raw = amtOf(ntry, 'Amt');
      const amount = cdtDbt === 'CRDT' ? raw : -raw;
      total += amount;

      const txs = tagAll(ntry, 'TxDtls');
      const targets = txs.length ? txs : [ntry];
      for (const tx of targets) {
        const ref = tag(tx, 'Ref') || tag(tx, 'EndToEndId') || tag(tx, 'InstrId') || null;
        const eteId = tag(tx, 'EndToEndId') || null;
        const debtorName = tag(tx, 'Dbtr').match(/<Nm>([^<]+)<\/Nm>/)?.[1] || null;
        const debtorIban = tag(tx, 'DbtrAcct').match(/<IBAN>([^<]+)<\/IBAN>/)?.[1] || null;
        const remit = tag(tx, 'RmtInf').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
        const txAmt = txs.length ? amtOf(tx, 'Amt') : Math.abs(amount);

        const { data: ins } = await admin.from('finance_camt054_entries').insert({
          notification_id: notif.id,
          booking_date: bookDate,
          value_date: valDate,
          amount: cdtDbt === 'CRDT' ? txAmt : -txAmt,
          currency,
          reference: ref,
          end_to_end_id: eteId,
          debtor_name: debtorName,
          debtor_iban: debtorIban,
          remittance_info: remit,
        }).select('match_status').single();
        if (ins?.match_status === 'zugeordnet') matched += 1;
      }
    }

    await admin.from('finance_camt054_notifications').update({
      total_amount: total,
      entry_count: entries.length,
      matched_count: matched,
      status: 'verarbeitet',
    }).eq('id', notif.id);

    return new Response(JSON.stringify({
      notification_id: notif.id,
      entry_count: entries.length,
      matched_count: matched,
      total_amount: total,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
