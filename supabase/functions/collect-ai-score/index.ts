// ALIX COLLECT – KI-Risikobewertung (Zahlungswahrscheinlichkeit & Empfehlung)
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** Deterministische Basisbewertung (0–100, hoch = riskant) */
function baseRisk(c: any, history: { paid: number; total: number; avgDelay: number }) {
  let r = 0;
  const d = Number(c.max_days_overdue ?? 0);
  if (d > 60) r += 45; else if (d > 30) r += 32; else if (d > 14) r += 20; else if (d > 0) r += 10;
  const amt = Number(c.overdue_amount ?? 0);
  if (amt > 20000) r += 20; else if (amt > 10000) r += 14; else if (amt > 3000) r += 8; else if (amt > 0) r += 4;
  const payRate = history.total > 0 ? history.paid / history.total : 1;
  r += Math.round((1 - payRate) * 25);
  if (history.avgDelay > 30) r += 10; else if (history.avgDelay > 14) r += 6; else if (history.avgDelay > 5) r += 3;
  if (['inkasso', 'anwalt', 'insolvenz'].includes(c.status)) r = Math.max(r, 90);
  return Math.max(0, Math.min(100, r));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const { case_id, limit = 100, use_ai = true } = body as { case_id?: string; limit?: number; use_ai?: boolean };

    let q = admin.from('collect_cases').select('*').neq('status', 'closed');
    if (case_id) q = q.eq('id', case_id);
    else q = q.order('overdue_amount', { ascending: false }).limit(Math.min(Number(limit) || 100, 500));
    const { data: cases, error } = await q;
    if (error) throw error;

    let scored = 0;
    for (const c of cases ?? []) {
      const { data: hist } = await admin
        .from('zoho_invoices')
        .select('total, balance, invoice_date, last_payment_date')
        .eq('customer_name', c.customer_name)
        .limit(400);
      const rows = hist ?? [];
      const paid = rows.filter((r: any) => Number(r.balance ?? 0) <= 0.009).length;
      const delays = rows
        .filter((r: any) => r.last_payment_date && r.invoice_date)
        .map((r: any) => (new Date(r.last_payment_date).getTime() - new Date(r.invoice_date).getTime()) / 86400000);
      const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
      const history = { paid, total: rows.length, avgDelay: Math.round(avgDelay) };

      const risk = baseRisk(c, history);
      const payProb = Math.max(2, Math.min(98, 100 - risk));
      const riskClass = risk >= 75 ? 'kritisch' : risk >= 50 ? 'hoch' : risk >= 25 ? 'mittel' : 'niedrig';

      let recommendation = riskClass === 'kritisch'
        ? 'Telefonat + Eskalation prüfen (Inkasso/Anwalt), Lieferungen sperren'
        : riskClass === 'hoch'
          ? 'Mahnung mit Frist + Anruf, Ratenplan anbieten'
          : riskClass === 'mittel'
            ? 'Freundliche Zahlungserinnerung, Zahlungslink senden'
            : 'Abwarten, ggf. Vorab-Erinnerung vor Fälligkeit';
      let reasoning = `Verzug ${c.max_days_overdue ?? 0} Tage · offen ${Number(c.overdue_amount ?? 0).toFixed(2)} ${c.currency ?? 'EUR'} · Zahlungsquote ${history.total ? Math.round((history.paid / history.total) * 100) : 100}% · Ø Zahlungsdauer ${history.avgDelay} Tage.`;

      if (use_ai && LOVABLE_API_KEY) {
        try {
          const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'Du bist Forderungsmanager bei einem Medizintechnik-Unternehmen. Antworte NUR mit kompaktem JSON: {"empfehlung":"...","begruendung":"..."} auf Deutsch, maximal 2 Sätze je Feld, konkret und umsetzbar.' },
                { role: 'user', content: JSON.stringify({ kunde: c.customer_name, offen: c.open_amount, ueberfaellig: c.overdue_amount, verzugstage: c.max_days_overdue, stufe: c.stage_code, status: c.status, risiko: risk, historie: history }) },
              ],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const txt = data?.choices?.[0]?.message?.content ?? '';
            const m = txt.match(/\{[\s\S]*\}/);
            if (m) {
              const parsed = JSON.parse(m[0]);
              if (parsed.empfehlung) recommendation = String(parsed.empfehlung);
              if (parsed.begruendung) reasoning = `${reasoning} ${parsed.begruendung}`;
            }
          } else {
            console.warn('AI gateway', res.status, await res.text());
          }
        } catch (aiErr) {
          console.warn('AI scoring skipped:', (aiErr as any)?.message);
        }
      }

      await admin.from('collect_cases').update({
        risk_score: risk,
        pay_probability_pct: payProb,
        risk_class: riskClass,
        ai_recommendation: recommendation,
        ai_reasoning: reasoning,
        ai_updated_at: new Date().toISOString(),
      }).eq('id', c.id);
      scored++;
    }

    return json({ ok: true, scored });
  } catch (e: any) {
    console.error('collect-ai-score failed:', e?.message ?? e);
    return json({ ok: false, error: e?.message ?? 'internal' }, 500);
  }
});
