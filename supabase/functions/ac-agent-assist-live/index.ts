// Agent Assist Live 2.0 — real-time next-best-action for an active conversation.
// Reads recent ac_messages + contact context, returns next reply, KB snippet, sentiment
// and persists into ac_copilot_suggestions.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { conversation_id, agent_user_id } = await req.json();
    if (!conversation_id) throw new Error('conversation_id required');

    const [{ data: conv }, { data: messages }] = await Promise.all([
      sb.from('ac_conversations').select('*').eq('id', conversation_id).single(),
      sb.from('ac_messages').select('sender_type, body, created_at').eq('conversation_id', conversation_id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (!conv) throw new Error('conversation not found');

    const history = (messages ?? []).reverse().map((m: any) => `[${m.sender_type}] ${m.body ?? ''}`).join('\n');

    // Simple KB retrieval via keywords from last customer message
    const lastCustomer = (messages ?? []).find((m: any) => m.sender_type === 'customer')?.body ?? '';
    const words = String(lastCustomer).split(/\s+/).filter((w) => w.length > 4).slice(0, 3);
    let kb: any[] = [];
    if (words.length) {
      const { data } = await sb.from('service_knowledge_base').select('title, content')
        .or(words.map((w) => `content.ilike.%${w}%`).join(',')).limit(3);
      kb = data ?? [];
    }

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Du bist Live-Copilot für einen Kundenservice-Agenten. Antworte NUR mit JSON: {"next_reply":string,"tone":"empathisch"|"neutral"|"deeskalierend","sentiment":"positiv"|"neutral"|"negativ","urgency":"low"|"medium"|"high","kb_snippet":string,"actions":[string]}' },
          { role: 'user', content: `Verlauf:\n${history}\n\nKB-Kontext:\n${kb.map((k: any) => `# ${k.title}\n${(k.content ?? '').slice(0, 500)}`).join('\n---\n') || '(leer)'}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const parsed = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    if (agent_user_id && parsed.next_reply) {
      await sb.from('ac_copilot_suggestions').insert({
        user_id: agent_user_id,
        context_type: 'chat',
        context_id: conversation_id,
        suggestion_type: 'next_reply',
        content: parsed.next_reply,
        model: 'google/gemini-3-flash-preview',
      });
    }

    return new Response(JSON.stringify({ success: true, ...parsed, kb_count: kb.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
