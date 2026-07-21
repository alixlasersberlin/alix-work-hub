// ALIX CONNECT — Phase 27 Voice Analytics
// Analysiert ac_calls Transcripts: Keywords, Topics, Compliance-Phrasen, Talk-Ratio, Emotion.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit ?? 100), 500);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: rules } = await sb.from('ac_voice_compliance_rules').select('*').eq('enabled', true);
    const required = new Set<string>(); const forbidden = new Set<string>();
    (rules ?? []).forEach((r: any) => {
      (r.required_phrases ?? []).forEach((p: string) => required.add(p.toLowerCase()));
      (r.forbidden_phrases ?? []).forEach((p: string) => forbidden.add(p.toLowerCase()));
    });

    // Only calls with transcript that don't already have insights
    const { data: existing } = await sb.from('ac_voice_insights').select('call_id').limit(5000);
    const seen = new Set((existing ?? []).map((e: any) => e.call_id));

    const { data: calls } = await sb
      .from('ac_calls')
      .select('id, agent_user_id, transcript, transcript_language, duration_seconds, sentiment, sentiment_score')
      .not('transcript', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    const inserts: any[] = [];
    for (const c of (calls ?? [])) {
      if (seen.has(c.id)) continue;
      const t = String(c.transcript ?? '').toLowerCase();
      if (!t) continue;

      // Keywords: top nouns/words (simple frequency, min length 4, exclude stopwords)
      const stop = new Set(['und','oder','aber','dass','wenn','dann','doch','noch','auch','einen','einer','eine','ist','war','das','die','der','den','für','mit','sich','sind','wird','werden','hat','habe','haben','nicht','sein','wie','was','wer','warum','wieso','also','beim','beim','bitte','danke','okay','ja','nein','ich','sie','wir','ihnen','mir','mich','uns','sagen','sagte','also']);
      const freq: Record<string, number> = {};
      t.split(/[^a-zäöüß]+/i).forEach(w => { if (w.length >= 4 && !stop.has(w)) freq[w] = (freq[w] || 0) + 1; });
      const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);

      // Topics (naive tags)
      const topics: string[] = [];
      if (/rechnung|invoice|bezahl/i.test(t)) topics.push('Rechnung');
      if (/wartung|service|reparatur/i.test(t)) topics.push('Service');
      if (/lieferung|versand|termin/i.test(t)) topics.push('Lieferung');
      if (/reklamation|beschwerde|problem/i.test(t)) topics.push('Reklamation');
      if (/angebot|preis|kauf/i.test(t)) topics.push('Vertrieb');

      const found: string[] = [];
      const missing: string[] = [];
      required.forEach(p => { if (t.includes(p)) found.push(p); else missing.push(p); });
      const foundForbidden: string[] = [];
      forbidden.forEach(p => { if (t.includes(p)) foundForbidden.push(p); });

      // Heuristic talk ratio from turn markers (Agent:/Kunde: / Speaker 1/2)
      const agentTurns = (t.match(/agent:|speaker\s*1|mitarbeiter:/g) || []).length || 1;
      const custTurns = (t.match(/kunde:|speaker\s*2|customer:/g) || []).length || 1;
      const total = agentTurns + custTurns;
      const talkAgent = agentTurns / total;
      const talkCust = custTurns / total;

      const emotion = c.sentiment === 'negative' ? 'frustrated' : c.sentiment === 'positive' ? 'happy' : 'neutral';

      inserts.push({
        call_id: c.id,
        agent_user_id: c.agent_user_id,
        keywords, topics,
        compliance_phrases_found: found,
        compliance_phrases_missing: missing,
        talk_ratio_agent: +talkAgent.toFixed(2),
        talk_ratio_customer: +talkCust.toFixed(2),
        silence_ratio: 0,
        emotion_agent: emotion,
        emotion_customer: emotion,
        speaker_turns: agentTurns + custTurns,
        language: c.transcript_language ?? 'de',
        duration_seconds: c.duration_seconds ?? 0,
        raw_payload: { foundForbidden },
      });
    }

    for (let i = 0; i < inserts.length; i += 200) {
      const { error } = await sb.from('ac_voice_insights').insert(inserts.slice(i, i + 200));
      if (error) throw error;
    }

    return new Response(JSON.stringify({ ok: true, processed: inserts.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
