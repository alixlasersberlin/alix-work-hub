// Erzeugt KB-Artikel-Entwürfe aus kürzlich abgeschlossenen Konversationen.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { limit = 5, days_back = 7 } = await req.json().catch(() => ({}));
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Kandidaten: geschlossene Konversationen mit ≥3 Messages, nicht schon als KB verwertet
    const since = new Date(Date.now() - days_back * 86400_000).toISOString();
    const { data: convos } = await sb
      .from('ac_conversations')
      .select('id, subject, ai_summary, closed_at, csat_score')
      .not('closed_at', 'is', null)
      .gte('closed_at', since)
      .order('closed_at', { ascending: false })
      .limit(limit * 3);

    const drafts: any[] = [];
    for (const c of (convos ?? []).slice(0, limit)) {
      const { data: msgs } = await sb.from('ac_messages').select('sender_type, body').eq('conversation_id', c.id).order('created_at').limit(40);
      const transcript = (msgs ?? []).map((m: any) => `[${m.sender_type}] ${(m.body ?? '').slice(0, 500)}`).join('\n');
      if (transcript.length < 200) continue;

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Extrahiere aus der Konversation einen wiederverwendbaren KB-Artikel. Antworte STRIKT als JSON mit {title, category, tags:[], content}. Content in Markdown, max 500 Wörter, auf Deutsch, neutral, ohne Kundendaten/PII.' },
            { role: 'user', content: `Konversation (${c.subject ?? 'ohne Betreff'}):\n${transcript}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!aiRes.ok) continue;
      const j = await aiRes.json();
      let parsed: any = {};
      try { parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}'); } catch (_) { continue; }
      if (!parsed.title || !parsed.content) continue;

      const { data: inserted } = await sb.from('ac_kb_articles').insert({
        title: parsed.title,
        content: parsed.content,
        category: parsed.category ?? null,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        status: 'review',
        public_visible: false,
        submitted_for_review_at: new Date().toISOString(),
      }).select('id, title').single();
      if (inserted) drafts.push(inserted);
    }

    return new Response(JSON.stringify({ ok: true, drafts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
