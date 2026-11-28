// Customer Intelligence Hub — predictive churn, CLV score, next-best-offer per contact.
// Persists into ac_predictions and updates ac_customer_health.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireCallerAccess } from '../_shared/caller-access.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const access = await requireCallerAccess(req, corsHeaders);
  if ('response' in access) return access.response;
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const reader = access.caller;
    const { contact_id } = await req.json();
    if (typeof contact_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(contact_id)) return new Response('Invalid contact_id', { status: 400, headers: corsHeaders });
    const { data: contact, error: contactError } = await reader.from('ac_contacts').select('*').eq('id', contact_id).single();
    if (contactError || !contact?.tenant_id || !access.tenants.some((t: any) => t.id === contact.tenant_id)) return new Response('Forbidden contact', { status: 403, headers: corsHeaders });
    const [{ data: msgs, error: msgError }, { data: calls, error: callError }] = await Promise.all([
      reader.from('ac_messages').select('direction, created_at, body').eq('contact_id', contact_id).eq('tenant_id', contact.tenant_id).order('created_at', { ascending: false }).limit(50),
      reader.from('ac_calls').select('direction, sentiment, sentiment_score, duration_sec, created_at').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(30),
    ]);
    if (msgError || callError) throw msgError ?? callError;
    if (contact.customer_id) {
      const { data: customer, error } = await reader.from('customers').select('source_system').eq('id', contact.customer_id).maybeSingle();
      const tenant = access.tenants.find((t: any) => t.id === contact.tenant_id);
      if (error || !customer || customer.source_system !== tenant?.zoho_source_system) return new Response('Customer ownership unconfirmed', { status: 403, headers: corsHeaders });
    }

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist Customer-Intelligence-Analyst. Antworte NUR mit JSON: {"churn_risk":number(0-1),"clv_score":number(0-100),"segment":string,"next_best_offer":string,"cross_sell":[string],"reasoning":string,"auto_tags":[string]}' },
          { role: 'user', content: `Kontakt: ${JSON.stringify(contact)}\nRecent Messages (${msgs?.length ?? 0}): ${JSON.stringify((msgs ?? []).slice(0, 10))}\nRecent Calls (${calls?.length ?? 0}): ${JSON.stringify((calls ?? []).slice(0, 10))}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    const churn = Number(p.churn_risk ?? 0);
    const clv = Number(p.clv_score ?? 0);

    const { error: predictionError } = await sb.from('ac_predictions').insert({
      contact_id,
      kind: 'customer_intelligence',
      score: churn,
      risk_level: churn >= 0.7 ? 'high' : churn >= 0.4 ? 'medium' : 'low',
      suggested_action: p.next_best_offer ?? null,
      payload: { clv_score: clv, segment: p.segment, next_best_offer: p.next_best_offer, cross_sell: p.cross_sell, reasoning: p.reasoning, auto_tags: p.auto_tags, model: 'google/gemini-3-flash-preview' },
    });
    if (predictionError) throw predictionError;

    if ((contact as any).customer_id) {
      const { error: healthError } = await sb.from('ac_customer_health').upsert({
        customer_id: (contact as any).customer_id,
        score: Math.round((1 - churn) * 100),
        lifecycle_stage: p.segment ?? 'unknown',
        factors: { churn_risk: churn, clv_score: clv, segment: p.segment, source: 'customer-intel' },
        computed_at: new Date().toISOString(),
      }, { onConflict: 'customer_id' });
      if (healthError) throw healthError;
    }

    return new Response(JSON.stringify({ success: true, ...p }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
