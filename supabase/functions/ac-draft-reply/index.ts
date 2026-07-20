// Edge Function: ac-draft-reply
// Erzeugt einen Antwort-Entwurf für eine ALIX CONNECT Konversation.
// Nutzt Lovable AI Gateway (Gemini) mit den letzten 8 Nachrichten als Kontext.
// Schreibt NICHT in die DB — das Frontend übernimmt den Text ins Antwortfeld.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return j({ error: 'LOVABLE_API_KEY missing' }, 500);

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supa.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!userRes?.user) return j({ error: 'unauthorized' }, 401);

    const { conversation_id, hint, tone = 'freundlich, professionell', locale = 'de' } = await req.json();
    if (!conversation_id) return j({ error: 'conversation_id required' }, 400);

    const { data: hist } = await supa
      .from('ac_messages')
      .select('body, direction, sender_name, is_internal_note, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(8);
    const history = (hist ?? [])
      .reverse()
      .filter((m: any) => !m.is_internal_note)
      .map((m: any) => `[${m.direction === 'inbound' ? 'Kunde' : 'Agent'}${m.sender_name ? ` · ${m.sender_name}` : ''}] ${m.body ?? ''}`)
      .join('\n');

    const system = `Du bist ein professioneller Kundenservice-Agent von Alix. Sprache: ${locale === 'de' ? 'Deutsch' : 'English'}. Ton: ${tone}. Schreibe eine kurze, konkrete Antwort (max. 6 Sätze) auf die letzte Kundennachricht. Keine erfundenen Fakten, keine Preise erfinden, keine Zusagen ohne Deckung. Wenn Info fehlt, stelle max. eine Rückfrage.`;
    const user = `Konversationsverlauf:\n${history || '(leer)'}${hint ? `\n\nHinweis vom Agent: ${hint}` : ''}\n\nErstelle nur den Antworttext, ohne Anrede-Vorlagen wie "Sehr geehrte/r ..." wenn kein Name bekannt ist.`;

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (res.status === 429) return j({ error: 'Rate limit' }, 429);
    if (res.status === 402) return j({ error: 'Credits erschöpft' }, 402);
    if (!res.ok) return j({ error: `AI ${res.status}` }, 500);
    const json = await res.json();
    const draft = String(json?.choices?.[0]?.message?.content ?? '').trim();
    if (!draft) return j({ error: 'AI leere Antwort' }, 500);
    return j({ draft });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
