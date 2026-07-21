import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { contact_id } = await req.json();
    if (!contact_id) return json({ error: 'contact_id required' }, 400);

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const [contact, msgs, calls, tickets] = await Promise.all([
      sb.from('ac_contacts').select('display_name,phone,email,lifetime_value,last_interaction_at,created_at').eq('id', contact_id).maybeSingle(),
      sb.from('ac_messages').select('created_at,direction,channel').eq('contact_id', contact_id).order('created_at', { ascending: false }).limit(200),
      sb.from('ac_calls' as any).select('started_at,status,duration_seconds').eq('contact_id', contact_id).order('started_at', { ascending: false }).limit(100),
      sb.from('tickets' as any).select('created_at,status').eq('customer_email', '___').limit(0),
    ]);

    if (!contact.data) return json({ error: 'not found' }, 404);

    const msgList = msgs.data ?? [];
    const callList = calls.data ?? [];
    const now = Date.now();
    const daysSinceLast = contact.data.last_interaction_at
      ? Math.max(0, (now - new Date(contact.data.last_interaction_at).getTime()) / 86400000)
      : 999;

    // Heuristik-Fallback
    const engagement = Math.min(100, msgList.length * 2 + callList.length * 3);
    const churn = Math.min(100, Math.max(0, daysSinceLast > 90 ? 80 + (daysSinceLast - 90) / 10 : 100 - engagement));
    let segment = churn > 60 ? 'At Risk' : engagement > 40 ? 'Champion' : engagement > 15 ? 'Active' : 'Dormant';
    let next = churn > 60 ? 'Re-Engagement Kampagne senden' : engagement > 40 ? 'Cross-Sell Angebot' : 'Freundliches Follow-up';
    let reasoning = `${msgList.length} Nachrichten, ${callList.length} Anrufe, letzte Interaktion vor ${Math.round(daysSinceLast)} Tagen.`;

    // Optional Gemini via Lovable AI Gateway
    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    if (aiKey) {
      try {
        const prompt = `Kunde: ${contact.data.display_name}. LTV: ${contact.data.lifetime_value ?? 0} EUR. ${reasoning} Antworte NUR mit JSON: {"segment":"...","next_best_action":"...","reasoning":"kurz begründen"}`;
        const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }] }),
        });
        if (r.ok) {
          const d = await r.json();
          const raw = d.choices?.[0]?.message?.content ?? '';
          const m = raw.match(/\{[\s\S]*\}/);
          if (m) {
            const parsed = JSON.parse(m[0]);
            segment = parsed.segment ?? segment;
            next = parsed.next_best_action ?? next;
            reasoning = parsed.reasoning ?? reasoning;
          }
        }
      } catch (_) { /* fallback used */ }
    }

    const payload = {
      contact_id, churn_score: churn, engagement_score: engagement,
      segment, next_best_action: next, reasoning, computed_at: new Date().toISOString(),
    };
    await sb.from('ac_customer_scores' as any).upsert(payload, { onConflict: 'contact_id' });
    return json({ score: payload });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
