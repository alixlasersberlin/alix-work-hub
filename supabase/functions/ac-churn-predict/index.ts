// ALIX CONNECT Phase 48 — Predictive Churn Detection (Frühwarnsystem)
// Berechnet Churn-Score pro Kontakt aus Message/Call/Sentiment-Signalen und speichert in ac_predictions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const { contact_id, batch = false, limit = 100 } = body;

    async function scoreOne(cid: string) {
      const [{ data: contact }, { data: msgs }, { data: calls }] = await Promise.all([
        sb.from('ac_contacts').select('*').eq('id', cid).maybeSingle(),
        sb.from('ac_messages').select('direction, sentiment, created_at').eq('contact_id', cid).order('created_at', { ascending: false }).limit(60),
        sb.from('ac_calls').select('direction, duration_sec, created_at, outcome').eq('contact_id', cid).order('created_at', { ascending: false }).limit(30),
      ]);
      if (!contact) return null;

      const now = Date.now();
      const lastMsgAt = msgs?.[0]?.created_at ? new Date(msgs[0].created_at).getTime() : 0;
      const lastCallAt = calls?.[0]?.created_at ? new Date(calls[0].created_at).getTime() : 0;
      const lastActivity = Math.max(lastMsgAt, lastCallAt);
      const daysSince = lastActivity ? (now - lastActivity) / 86400000 : 999;

      const negativeShare = (msgs ?? []).filter(m => (m.sentiment ?? 0) < -0.2).length / Math.max((msgs ?? []).length, 1);
      const inboundShare = (msgs ?? []).filter(m => m.direction === 'inbound').length / Math.max((msgs ?? []).length, 1);
      const missedCalls = (calls ?? []).filter(c => (c.outcome ?? '').toLowerCase().includes('miss')).length;

      // Heuristik 0..1
      const inactivityPart = Math.min(daysSince / 90, 1) * 0.45;
      const sentimentPart = Math.min(negativeShare, 1) * 0.30;
      const engagementPart = Math.max(0, 0.5 - inboundShare) * 0.15;
      const missedPart = Math.min(missedCalls / 5, 1) * 0.10;
      const churnScore = Math.round((inactivityPart + sentimentPart + engagementPart + missedPart) * 100) / 100;
      const risk_level = churnScore >= 0.66 ? 'high' : churnScore >= 0.35 ? 'medium' : 'low';

      const suggested_action = risk_level === 'high'
        ? 'reactivation_call'
        : risk_level === 'medium'
        ? 'personal_email'
        : 'monitor';

      const { error } = await sb.from('ac_predictions').insert({
        contact_id: cid,
        kind: 'churn_prediction',
        score: churnScore,
        risk_level,
        suggested_action,
        payload: {
          days_since_activity: Math.round(daysSince),
          negative_share: Math.round(negativeShare * 100) / 100,
          inbound_share: Math.round(inboundShare * 100) / 100,
          missed_calls: missedCalls,
          message_count: (msgs ?? []).length,
          call_count: (calls ?? []).length,
          engine: 'heuristic_v1',
        },
      });
      if (error) throw error;
      return { contact_id: cid, score: churnScore, risk_level, suggested_action };
    }

    if (batch) {
      const { data: contacts } = await sb.from('ac_contacts').select('id').order('updated_at', { ascending: false, nullsFirst: false }).limit(limit);
      const results: any[] = [];
      for (const c of contacts ?? []) {
        try { const r = await scoreOne(c.id); if (r) results.push(r); } catch (e) { console.warn('churn-score fail', c.id, (e as Error).message); }
      }
      return new Response(JSON.stringify({ success: true, scored: results.length, high_risk: results.filter(r => r.risk_level === 'high').length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!contact_id) throw new Error('contact_id required (or batch:true)');
    const r = await scoreOne(contact_id);
    return new Response(JSON.stringify({ success: true, ...r }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
