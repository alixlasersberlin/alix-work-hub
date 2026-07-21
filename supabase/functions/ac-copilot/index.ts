// AI Copilot for agents — next-reply, KB snippet, autocomplete, translation, summary.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const MODEL = 'google/gemini-3-flash-preview';

const SYSTEM: Record<string, string> = {
  next_reply: 'Du bist ein Support-Copilot. Formuliere eine kurze, freundliche, professionelle nächste Antwort auf Deutsch. Nutze den bereitgestellten Kontext und die KB-Snippets. Antworte NUR mit dem Antworttext, keine Erklärungen.',
  autocomplete: 'Vervollständige den begonnenen Satz des Agenten in professionellem Ton. Antworte NUR mit dem Vervollständigungstext (ohne Wiederholung des Anfangs).',
  kb_snippet: 'Fasse aus den KB-Snippets 1–3 kompakte, kopierbereite Bausteine (Bullet Points) zusammen, die zur Anfrage passen.',
  translate: 'Übersetze den Text präzise. Antworte NUR mit dem übersetzten Text.',
  summary: 'Fasse den Verlauf in max. 4 Sätzen auf Deutsch zusammen und benenne offene Punkte.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '');
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await sb.auth.getUser(jwt);
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { suggestion_type, context_type = 'chat', context_id, input, target_language, conversation_history } = await req.json();
    if (!suggestion_type || !SYSTEM[suggestion_type]) {
      return new Response(JSON.stringify({ error: 'invalid suggestion_type', allowed: Object.keys(SYSTEM) }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Optional KB retrieval (simple keyword search)
    let kb: string[] = [];
    if (input && ['next_reply','kb_snippet'].includes(suggestion_type)) {
      const words = String(input).split(/\s+/).filter((w) => w.length > 4).slice(0, 3);
      if (words.length) {
        const { data: kbRows } = await sb.from('service_knowledge_base')
          .select('title, content').or(words.map((w) => `content.ilike.%${w}%`).join(',')).limit(3);
        kb = (kbRows ?? []).map((r: any) => `# ${r.title}\n${(r.content ?? '').slice(0, 800)}`);
      }
    }

    const userMsg = [
      input ? `Aktuelle Anfrage / Text:\n${input}` : '',
      target_language ? `Zielsprache: ${target_language}` : '',
      conversation_history ? `Verlauf:\n${conversation_history}` : '',
      kb.length ? `KB-Kontext:\n${kb.join('\n---\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const t0 = Date.now();
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM[suggestion_type] },
          { role: 'user', content: userMsg || 'Kein Kontext' },
        ],
      }),
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
    const j = await aiRes.json();
    const content = j.choices?.[0]?.message?.content?.trim() ?? '';
    const latency = Date.now() - t0;

    const { data: saved } = await sb.from('ac_copilot_suggestions').insert({
      user_id: userId,
      context_type,
      context_id: context_id ?? null,
      input_snippet: input ? String(input).slice(0, 500) : null,
      suggestion_type,
      content,
      kb_source: kb.length ? 'service_knowledge_base' : null,
      model: MODEL,
      latency_ms: latency,
    }).select().single();

    return new Response(JSON.stringify({ ok: true, id: saved?.id, content, latency_ms: latency, kb_count: kb.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
