// KI-Bewertung für Angebote (Vertriebs-Cockpit / Angebotsanalyse).
// Berechnet Kaufwahrscheinlichkeit, Begründung und Sofortmaßnahmen je Angebot.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { ORDER_CONFIRMATION_ROLES } from '../_shared/security-v42-mail.ts';
import { z } from 'npm:zod@3';
const ScoreBody = z.object({ offer_ids: z.array(z.string().uuid()).min(1).max(25) });

const AI_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const MODEL = 'google/gemini-3-flash-preview';

const SYSTEM = `Du bist ein Vertriebsanalyst für medizinische Laser- und Beautygeräte.
Bewerte jedes Angebot nüchtern anhand von Wert, Alter, Kontakthistorie, Rabatt, Finanzierung und Lead-Quelle.
Antworte AUSSCHLIESSLICH mit JSON: {"results":[{"id":"...","probability":0.0-1.0,"reason":"kurz, max 200 Zeichen","actions":["konkrete Maßnahme", "..."]}]}`;

function j(v: unknown, status = 200) {
  return new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return j({ error: 'Method not allowed' }, 405);
  try {
    const access = await requireCallerAccess(req, corsHeaders, ORDER_CONFIRMATION_ROLES);
    if ('response' in access) return access.response;
    const sb = access.caller;
    const parsed = ScoreBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return j({ error: parsed.error.flatten().fieldErrors }, 400);
    const ids = [...new Set(parsed.data.offer_ids)];

    const { data: offers, error } = await sb
      .from('offers')
      .select('id, offer_number, customer_name, offer_date, total_gross, total_net, status, stage, discount_percent, financing_type, lead_source, competitor, last_contact_at, next_followup_at, loss_reason')
      .in('id', ids).in('tenant_id', access.tenants.map((tenant: { id: string }) => tenant.id));
    if (error) return j({ error: error.message }, 500);
    if (!offers?.length) return j({ scored: 0 });

    const compact = offers.map((o: any) => ({
      id: o.id,
      wert: Number(o.total_gross ?? o.total_net ?? 0),
      alter_tage: o.offer_date ? Math.floor((Date.now() - new Date(o.offer_date).getTime()) / 86400000) : null,
      phase: o.stage, rabatt: o.discount_percent, finanzierung: o.financing_type,
      lead: o.lead_source, wettbewerber: o.competitor,
      letzter_kontakt: o.last_contact_at, wiedervorlage: o.next_followup_at,
    }));

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

    if (!aiRes.ok) {
      const details = await aiRes.text();
      console.error(`AI gateway failed [${aiRes.status}]: ${details}`);
      return j({ error: 'AI request failed', status: aiRes.status, details }, aiRes.status);
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? '';
    const match = String(raw).match(/\{[\s\S]*\}/);
    let results: any[] = [];
    try { results = JSON.parse(match?.[0] ?? '{}')?.results ?? []; } catch { results = []; }

    let scored = 0;
    const authorizedIds = new Set(offers.map((offer: { id: string }) => offer.id));
    for (const r of results) {
      if (!r?.id || !authorizedIds.has(r.id)) continue;
      const probability = Math.max(0, Math.min(1, Number(r.probability ?? 0)));
      const { error: upErr } = await sb.from('offers').update({
        ai_probability: probability,
        ai_reason: String(r.reason ?? '').slice(0, 500),
        ai_actions: Array.isArray(r.actions) ? r.actions.slice(0, 5) : [],
        ai_scored_at: new Date().toISOString(),
      }).eq('id', r.id).in('tenant_id', access.tenants.map((tenant: { id: string }) => tenant.id));
      if (!upErr) scored++;
    }

    return j({ scored, total: offers.length });
  } catch (e) {
    console.error('offers-ai-score error', e);
    return j({ error: (e as Error).message ?? 'error' }, 500);
  }
});
