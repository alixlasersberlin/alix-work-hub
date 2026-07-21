// Self-Service Portal Chatbot – Gemini + KB semantic search + optional WhatsApp handoff.
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
    const body = await req.json();
    const { session_token, message, contact_email, request_handoff } = body ?? {};
    if (!session_token || !message) return new Response(JSON.stringify({ error: 'session_token + message required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Load/create session
    let { data: session } = await sb.from('ac_portal_chat_sessions').select('*').eq('session_token', session_token).maybeSingle();
    if (!session) {
      const { data: created, error } = await sb.from('ac_portal_chat_sessions').insert({ session_token, contact_email: contact_email ?? null, messages: [] }).select().single();
      if (error) throw error;
      session = created;
    }

    // Semantic KB search on user message (only public articles)
    let kbContext = '';
    try {
      const eRes = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: message, dimensions: 1536 }),
      });
      if (eRes.ok) {
        const ej = await eRes.json();
        const qEmb = ej.data?.[0]?.embedding;
        if (qEmb) {
          const { data: matches } = await sb.rpc('ac_kb_search', { query_embedding: qEmb as any, match_count: 3, only_public: true });
          if (matches?.length) {
            kbContext = matches.map((m: any) => `# ${m.title}\n${(m.content ?? '').slice(0, 800)}`).join('\n---\n');
          }
        }
      }
    } catch (_) {}

    const history = Array.isArray(session.messages) ? session.messages : [];
    const messages = [
      { role: 'system', content: `Du bist der ALIX Self-Service-Assistent. Antworte kurz, freundlich, präzise auf Deutsch. Nutze die KB-Auszüge falls hilfreich. Wenn du unsicher bist oder der Kunde einen Menschen möchte, biete Handoff (WhatsApp/E-Mail) an.\n\nKB-Auszüge:\n${kbContext || '(keine passenden Artikel)'} ` },
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages }),
    });
    if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!aiRes.ok) throw new Error(`AI ${aiRes.status}: ${await aiRes.text()}`);
    const j = await aiRes.json();
    const reply = j.choices?.[0]?.message?.content?.trim() ?? '';

    const newMessages = [...history, { role: 'user', content: message, at: new Date().toISOString() }, { role: 'assistant', content: reply, at: new Date().toISOString() }];
    await sb.from('ac_portal_chat_sessions').update({
      messages: newMessages,
      handoff_requested: !!request_handoff || session.handoff_requested,
      handoff_channel: request_handoff ? (body.handoff_channel ?? 'whatsapp') : session.handoff_channel,
      contact_email: contact_email ?? session.contact_email,
    }).eq('session_token', session_token);

    return new Response(JSON.stringify({ ok: true, reply, kb_matches: !!kbContext }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
