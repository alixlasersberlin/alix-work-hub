// ALIX CONNECT — Phase 26 Predictive CX
// Berechnet Churn/Eskalation/NBA-Predictions je Kontakt und schreibt sie nach ac_predictions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

function daysSince(iso: string | null): number {
  if (!iso) return 9999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit ?? 200), 1000);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch recent contacts with activity
    const { data: contacts } = await sb
      .from('ac_contacts')
      .select('id, customer_id, last_contacted_at, sentiment_score, churn_risk, lifetime_value, tags, created_at')
      .order('last_contacted_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (!contacts?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const inserts: any[] = [];
    for (const c of contacts) {
      const inactivity = daysSince(c.last_contacted_at as any);
      const sentiment = Number(c.sentiment_score ?? 0);
      const churnBase = Number(c.churn_risk ?? 0);

      // Heuristic churn score 0..1
      const churn = Math.min(1, Math.max(0,
        churnBase * 0.4 +
        (inactivity > 90 ? 0.35 : inactivity > 60 ? 0.2 : inactivity > 30 ? 0.1 : 0) +
        (sentiment < -0.2 ? 0.25 : sentiment < 0 ? 0.1 : 0)
      ));
      const churnLevel = churn >= 0.66 ? 'high' : churn >= 0.33 ? 'med' : 'low';

      // Escalation risk from negative sentiment + open tickets tag
      const hasOpen = Array.isArray(c.tags) && (c.tags as string[]).some(t => /ticket|beschwerde|escalation/i.test(t));
      const esc = Math.min(1, Math.max(0, (sentiment < 0 ? Math.abs(sentiment) : 0) + (hasOpen ? 0.3 : 0)));
      const escLevel = esc >= 0.66 ? 'high' : esc >= 0.33 ? 'med' : 'low';

      // Next-best-action suggestion
      let nba = 'Keine Aktion notwendig';
      if (churn >= 0.66) nba = 'Persönlicher Anruf innerhalb 48h + Retention-Angebot';
      else if (esc >= 0.5) nba = 'Case eskalieren, Team-Lead informieren';
      else if (inactivity > 60) nba = 'Reaktivierungs-Kampagne (Email/WhatsApp)';
      else if (sentiment > 0.4) nba = 'Cross-/Upsell-Angebot senden';

      inserts.push(
        { contact_id: c.id, customer_id: c.customer_id, kind: 'churn', score: churn, risk_level: churnLevel, reason: `Inaktiv ${inactivity}d, Sentiment ${sentiment.toFixed(2)}`, suggested_action: nba, payload: { inactivity, sentiment } },
        { contact_id: c.id, customer_id: c.customer_id, kind: 'escalation', score: esc, risk_level: escLevel, reason: hasOpen ? 'Offenes Ticket + negatives Sentiment' : 'Sentiment-basiert', suggested_action: escLevel === 'high' ? 'Sofort eskalieren' : 'Beobachten', payload: { sentiment, hasOpen } },
        { contact_id: c.id, customer_id: c.customer_id, kind: 'nba', score: Math.max(churn, esc), risk_level: churnLevel, reason: 'Empfohlene nächste Aktion', suggested_action: nba, payload: { churn, esc } },
        { contact_id: c.id, customer_id: c.customer_id, kind: 'sentiment', score: (sentiment + 1) / 2, risk_level: sentiment < -0.2 ? 'high' : sentiment < 0 ? 'med' : 'low', reason: `Sentiment ${sentiment.toFixed(2)}`, suggested_action: null, payload: { sentiment } },
      );
    }

    // Upsert-like: delete stale then insert fresh (per contact/kind)
    const contactIds = contacts.map(c => c.id);
    await sb.from('ac_predictions').delete().in('contact_id', contactIds);
    const { error } = await sb.from('ac_predictions').insert(inserts);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, processed: contacts.length, predictions: inserts.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
