// Agent Assist Live 2.0 — real-time next-best-action for an active conversation.
// Reads recent ac_messages + contact context, returns next reply, KB snippet, sentiment
// and persists into ac_copilot_suggestions.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { maySendConversation } from '../_shared/message-access.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  const access = await requireCallerAccess(req, corsHeaders);
  if ('response' in access) return access.response;
  try {
    const sb = access.caller;
    const { conversation_id, agent_user_id } = await req.json();
    if (typeof conversation_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(conversation_id)) return new Response('Invalid conversation_id', { status: 400, headers: corsHeaders });
    if (agent_user_id && agent_user_id !== access.user.id) return new Response('Forbidden agent identity', { status: 403, headers: corsHeaders });
    const { data: conv, error: convError } = await sb.from('ac_conversations').select('*').eq('id', conversation_id).single();
    if (convError || !conv || !conv.tenant_id || !access.tenants.some((t: any) => t.id === conv.tenant_id) || !(await maySendConversation(sb, access.user.id, conv))) {
      return new Response('Forbidden conversation', { status: 403, headers: corsHeaders });
    }
    const { data: messages, error: messageError } = await sb.from('ac_messages').select('direction, body, created_at').eq('conversation_id', conversation_id).order('created_at', { ascending: false }).limit(20);
    if (messageError) throw messageError;

    const history = (messages ?? []).reverse().map((m: any) => `[${m.direction}] ${m.body ?? ''}`).join('\n');

    // Simple KB retrieval via keywords from last inbound message
    const lastCustomer = (messages ?? []).find((m: any) => m.direction === 'inbound')?.body ?? '';
    const words = String(lastCustomer).split(/\s+/).filter((w) => /^[\p{L}\p{N}]{5,40}$/u.test(w)).slice(0, 3);
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

    if (parsed.next_reply) {
      const { error: writeError } = await sb.from('ac_copilot_suggestions').insert({
        user_id: access.user.id,
        context_type: 'chat',
        context_id: conversation_id,
        suggestion_type: 'next_reply',
        content: parsed.next_reply,
        model: 'google/gemini-3-flash-preview',
      });
      if (writeError) throw writeError;
    }

    return new Response(JSON.stringify({ success: true, ...parsed, kb_count: kb.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
