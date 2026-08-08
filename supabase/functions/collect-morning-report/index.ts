// ALIX COLLECT – Morgenreport
// Erstellt täglich eine KI-Zusammenfassung der Forderungslage inkl. Empfehlungen.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const eur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: cases }, { data: tasks }, { data: forecast }, { data: promises }] = await Promise.all([
      admin.from('collect_cases').select('customer_name, open_amount, overdue_amount, max_days_overdue, risk_class, health_score, complaint_hold, playbook_code, status').neq('status', 'closed').limit(2000),
      admin.from('collect_tasks').select('task_type, title, status, due_date').eq('status', 'open').limit(1000),
      admin.from('collect_liquidity_forecast').select('*').eq('forecast_date', today),
      admin.from('collect_promises').select('amount, promised_date, status').eq('status', 'open').lte('promised_date', today).limit(500),
    ]);

    const list = cases ?? [];
    const openTotal = list.reduce((a, c) => a + Number(c.open_amount ?? 0), 0);
    const overdueTotal = list.reduce((a, c) => a + Number(c.overdue_amount ?? 0), 0);
    const highRisk = list.filter((c) => Number(c.health_score ?? 50) < 45 || Number(c.max_days_overdue ?? 0) >= 60);
    const holds = list.filter((c) => c.complaint_hold);
    const calls = (tasks ?? []).filter((t) => t.task_type === 'call');
    const expectedToday = (promises ?? []).reduce((a, p) => a + Number(p.amount ?? 0), 0);
    const f30 = (forecast ?? []).find((f: any) => f.horizon_days === 30);
    const cashflow30 = f30 ? Number(f30.secure_amount) + Number(f30.probable_amount) - Number(f30.expected_loss) : 0;
    const topDebtors = [...list].sort((a, b) => Number(b.overdue_amount ?? 0) - Number(a.overdue_amount ?? 0)).slice(0, 5);

    const kpis = {
      open_invoices: list.length,
      open_amount: Math.round(openTotal),
      overdue_amount: Math.round(overdueTotal),
      calls_today: calls.length,
      high_risk: highRisk.length,
      complaint_holds: holds.length,
      expected_today: Math.round(expectedToday),
      cashflow_30: Math.round(cashflow30),
      top_debtors: topDebtors.map((c) => ({ name: c.customer_name, amount: Math.round(Number(c.overdue_amount ?? 0)) })),
    };

    const recommendations: any[] = [];
    for (const c of highRisk.slice(0, 5)) {
      recommendations.push({ type: Number(c.overdue_amount ?? 0) > 20000 ? 'lieferstopp' : 'ratenzahlung', customer: c.customer_name, amount: Math.round(Number(c.overdue_amount ?? 0)), reason: `${c.max_days_overdue} Tage überfällig, Health-Score ${c.health_score ?? '—'}` });
    }

    let summary = `Guten Morgen. Heute sind ${kpis.open_invoices} Rechnungen offen (${eur(openTotal)}), davon ${eur(overdueTotal)} überfällig. ${kpis.calls_today} Kunden sollten angerufen werden, ${kpis.high_risk} Kunden haben ein hohes Ausfallrisiko. Voraussichtlicher Geldeingang heute: ${eur(expectedToday)}. Cashflow der nächsten 30 Tage: ${eur(cashflow30)}.`;

    if (LOVABLE_API_KEY) {
      try {
        const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Du bist der Finance-Assistent von Alix Lasers. Schreibe einen kurzen, sachlichen deutschen Morgenreport für die Geschäftsführung. Maximal 10 Sätze, keine Aufzählungszeichen-Orgie, konkrete Zahlen, konkrete Handlungsempfehlungen.' },
              { role: 'user', content: `Kennzahlen: ${JSON.stringify(kpis)}\nEmpfehlungen: ${JSON.stringify(recommendations)}\nMahnstopps wegen Reklamation: ${holds.length}` },
            ],
          }),
        });
        if (res.ok) {
          const dj = await res.json();
          const txt = dj?.choices?.[0]?.message?.content;
          if (txt) summary = txt;
        } else {
          console.warn('AI gateway', res.status, await res.text());
        }
      } catch (e) {
        console.warn('AI report failed', e);
      }
    }

    const { error } = await admin.from('collect_morning_reports').upsert({
      report_date: today, summary, kpis, recommendations, generated_at: new Date().toISOString(),
    }, { onConflict: 'report_date' });
    if (error) throw error;

    return json({ ok: true, report_date: today, kpis, summary });
  } catch (e: any) {
    console.error('collect-morning-report failed:', e?.message ?? e);
    return json({ ok: false, error: e?.message ?? 'internal' }, 500);
  }
});
