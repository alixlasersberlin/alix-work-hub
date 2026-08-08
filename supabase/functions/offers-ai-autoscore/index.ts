// Automatisches KI-Scoring für offene Angebote (Cron, täglich).
// Wählt offene, ungescorte oder veraltete Angebote und bewertet sie in Batches.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const MODEL = 'google/gemini-3-flash-preview';

const SYSTEM = `Du bist ein Vertriebsanalyst für medizinische Laser- und Beautygeräte.
Bewerte jedes Angebot nüchtern anhand von Wert, Alter, Kontakthistorie, Rabatt, Finanzierung und Lead-Quelle.
Antworte AUSSCHLIESSLICH mit JSON: {"results":[{"id":"...","probability":0.0-1.0,"reason":"kurz, max 200 Zeichen","actions":["konkrete Maßnahme"]}]}`;

const j = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function scoreBatch(admin: any, offers: any[]) {
  const compact = offers.map((o) => ({
    id: o.id,
    wert: Number(o.total_gross ?? o.total_net ?? 0),
    alter_tage: o.offer_date ? Math.floor((Date.now() - new Date(o.offer_date).getTime()) / 86_400_000) : null,
    phase: o.stage, rabatt: o.discount_percent, finanzierung: o.financing_type,
    lead: o.lead_source, wettbewerber: o.competitor,
    letzter_kontakt: o.last_contact_at, wiedervorlage: o.next_followup_at,
  }));

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Bewerte diese Angebote (JSON):\n${JSON.stringify(compact)}` },
      ],
    }),
  });
  if (!res.ok) {
    console.error('AI gateway failed', res.status, await res.text());
    return { scored: 0, status: res.status };
  }
  const raw = (await res.json())?.choices?.[0]?.message?.content ?? '';
  const match = String(raw).match(/\{[\s\S]*\}/);
  let results: any[] = [];
  try { results = JSON.parse(match?.[0] ?? '{}')?.results ?? []; } catch { results = []; }

  let scored = 0;
  for (const r of results) {
    if (!r?.id) continue;
    const probability = Math.max(0, Math.min(1, Number(r.probability ?? 0)));
    const { error } = await admin.from('offers').update({
      ai_probability: probability,
      offer_score: Math.round(probability * 100),
      ai_reason: String(r.reason ?? '').slice(0, 500),
      ai_actions: Array.isArray(r.actions) ? r.actions.slice(0, 5) : [],
      ai_scored_at: new Date().toISOString(),
    }).eq('id', r.id);
    if (!error) scored++;
  }
  return { scored, status: 200 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const body = await req.json().catch(() => ({} as any));
    const maxOffers = Math.min(Number(body?.limit ?? 100), 200);
    const staleDays = Number(body?.stale_days ?? 7);
    const staleISO = new Date(Date.now() - staleDays * 86_400_000).toISOString();

    const { data: offers, error } = await admin
      .from('offers')
      .select('id, offer_date, total_gross, total_net, status, stage, discount_percent, financing_type, lead_source, competitor, last_contact_at, next_followup_at, ai_scored_at')
      .in('status', ['draft', 'sent', 'open'])
      .or(`ai_scored_at.is.null,ai_scored_at.lt.${staleISO}`)
      .order('offer_date', { ascending: false })
      .limit(maxOffers);
    if (error) return j({ ok: false, error: error.message }, 500);
    if (!offers?.length) return j({ ok: true, scored: 0, candidates: 0 });

    let scored = 0;
    for (let i = 0; i < offers.length; i += 20) {
      const res = await scoreBatch(admin, offers.slice(i, i + 20));
      scored += res.scored;
      if (res.status === 429 || res.status === 402) break;
    }

    return j({ ok: true, candidates: offers.length, scored });
  } catch (e) {
    console.error('offers-ai-autoscore error', e);
    return j({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
