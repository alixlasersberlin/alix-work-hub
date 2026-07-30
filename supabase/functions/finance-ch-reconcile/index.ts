// Phase 6 · Bank-Reconciliation CH
// 1) QR-Referenz Auto-Matching offener CH-Bankbuchungen gegen finance_qr_invoices
// 2) LSV+/BDD Status-Loop: finance_ch_dd_run_items anhand von CAMT.054-Entries fortschreiben
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function mod10Recursive(body: string): number {
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (const ch of body) {
    const d = Number(ch);
    if (isNaN(d)) continue;
    carry = table[(carry + d) % 10];
  }
  return (10 - carry) % 10;
}

function extractQrRefs(text: string): string[] {
  const out = new Set<string>();
  const compact = String(text ?? '').replace(/\s+/g, '');
  for (const m of compact.match(/\d{27}/g) ?? []) {
    if (mod10Recursive(m.slice(0, 26)) === Number(m[26])) out.add(m);
  }
  for (const m of (String(text ?? '').match(/\bRF\d{2}[A-Z0-9]{1,21}\b/gi) ?? [])) {
    out.add(m.toUpperCase().replace(/\s+/g, ''));
  }
  return [...out].slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let qrMatched = 0, ddUpdated = 0, runsClosed = 0;

    // ---------- 1) QR-Referenz Matching ----------
    const { data: lines } = await admin
      .from('finance_bank_lines')
      .select('id, amount, purpose, end_to_end_id')
      .eq('accounting_region', 'CH')
      .eq('status', 'offen')
      .limit(1000);

    for (const l of (lines ?? []) as any[]) {
      if (Number(l.amount) <= 0) continue;
      const refs = extractQrRefs(`${l.purpose ?? ''} ${l.end_to_end_id ?? ''}`);
      if (!refs.length) continue;
      const { data: invs } = await admin
        .from('finance_qr_invoices')
        .select('id, amount, customer_id, reference')
        .eq('accounting_region', 'CH')
        .in('reference', refs)
        .limit(10);
      const hit = (invs ?? []).find((c: any) => Math.abs(Number(c.amount) - Number(l.amount)) < 0.05);
      if (!hit) continue;
      await admin.from('finance_bank_lines').update({
        status: 'zugeordnet',
        matched_customer_id: hit.customer_id,
        match_confidence: 0.99,
        match_method: 'auto:qr-ref',
        matched_at: new Date().toISOString(),
      }).eq('id', l.id);
      await admin.from('finance_qr_invoices').update({
        status: 'bezahlt', paid_at: new Date().toISOString(),
      }).eq('id', hit.id);
      qrMatched++;
    }

    // ---------- 2) LSV+/BDD Status-Loop ----------
    const { data: items } = await admin
      .from('finance_ch_dd_run_items')
      .select('id, run_id, amount, end_to_end_id, reference, status')
      .eq('accounting_region', 'CH')
      .in('status', ['offen', 'exportiert', 'eingereicht'])
      .limit(1000);

    for (const it of (items ?? []) as any[]) {
      const keys = [it.end_to_end_id, it.reference].filter(Boolean);
      if (!keys.length) continue;
      const { data: entries } = await admin
        .from('finance_camt054_entries')
        .select('id, amount, end_to_end_id, reference')
        .or(keys.map((k: string) => `end_to_end_id.eq.${k},reference.eq.${k}`).join(','))
        .limit(5);
      const hit = (entries ?? [])[0] as any;
      if (!hit) continue;
      const paid = Math.abs(Number(hit.amount)) >= Math.abs(Number(it.amount)) - 0.05;
      await admin.from('finance_ch_dd_run_items').update({
        status: paid ? 'verbucht' : 'teilbelastet',
      }).eq('id', it.id);
      ddUpdated++;
    }

    // Runs schliessen, wenn alle Positionen verbucht sind
    const { data: runs } = await admin
      .from('finance_ch_dd_runs')
      .select('id, status')
      .eq('accounting_region', 'CH')
      .in('status', ['exportiert', 'eingereicht'])
      .limit(200);
    for (const r of (runs ?? []) as any[]) {
      const { data: open } = await admin
        .from('finance_ch_dd_run_items')
        .select('id')
        .eq('run_id', r.id)
        .neq('status', 'verbucht')
        .limit(1);
      if ((open ?? []).length === 0) {
        await admin.from('finance_ch_dd_runs').update({ status: 'verbucht' }).eq('id', r.id);
        runsClosed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, qrMatched, ddUpdated, runsClosed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
