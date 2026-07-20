import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Payload = {
  event: 'message.received' | 'conversation.created' | 'sla.breached' | 'keyword.matched';
  message_id?: string;
  conversation_id?: string;
  body?: string;
  channel_id?: string;
  tenant_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const payload = (await req.json()) as Payload;
    const { event, body, conversation_id, message_id, tenant_id } = payload;
    if (!event) {
      return new Response(JSON.stringify({ error: 'event required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load conversation for channel_type
    let channelType: string | null = null;
    if (conversation_id) {
      const { data: conv } = await admin
        .from('ac_conversations')
        .select('channel_type')
        .eq('id', conversation_id)
        .maybeSingle();
      channelType = (conv?.channel_type as string) ?? null;
    }

    // Match rules
    const evtCandidates = [event];
    if (event === 'message.received' && body) evtCandidates.push('keyword.matched');

    const { data: rules } = await admin
      .from('ac_automation_rules')
      .select('*')
      .in('trigger', evtCandidates)
      .eq('active', true);

    const executed: any[] = [];
    for (const r of rules ?? []) {
      // channel filter
      if (r.channel && r.channel !== 'any' && channelType && r.channel !== channelType) continue;
      // keyword filter
      if (r.trigger === 'keyword.matched') {
        const kw = (r.keyword ?? '').toLowerCase().trim();
        if (!kw || !body?.toLowerCase().includes(kw)) continue;
      }

      let status = 'ok';
      const details: Record<string, unknown> = {};
      try {
        if (r.action === 'auto_reply' && conversation_id) {
          const { error } = await admin.from('ac_messages').insert({
            tenant_id,
            conversation_id,
            direction: 'outbound',
            sender_type: 'bot',
            sender_name: 'Auto-Reply',
            body: r.action_value,
            metadata: { automation_rule_id: r.id },
          });
          if (error) throw error;
        } else if (r.action === 'ai_reply' && conversation_id) {
          // Kontext: letzte 6 Nachrichten laden
          const { data: hist } = await admin
            .from('ac_messages')
            .select('body, direction, sender_name, created_at')
            .eq('conversation_id', conversation_id)
            .order('created_at', { ascending: false })
            .limit(6);
          const historyText = (hist ?? [])
            .reverse()
            .map((m: any) => `[${m.direction === 'inbound' ? 'Kunde' : 'Agent'}] ${m.body ?? ''}`)
            .join('\n');
          const systemPrompt = (r.action_value && r.action_value.trim().length > 0)
            ? r.action_value
            : 'Du bist ein professioneller Kundenservice-Agent von Alix. Antworte kurz, freundlich und konkret auf Deutsch. Keine erfundenen Fakten.';

          const key = Deno.env.get('LOVABLE_API_KEY');
          if (!key) throw new Error('LOVABLE_API_KEY missing');
          const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Konversationsverlauf:\n${historyText}\n\nAntworte als Agent auf die letzte Kundennachricht.` },
              ],
            }),
          });
          if (aiRes.status === 429) throw new Error('AI Rate limit');
          if (aiRes.status === 402) throw new Error('AI Credits erschöpft');
          if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);
          const aiJson = await aiRes.json();
          const replyText = aiJson?.choices?.[0]?.message?.content ?? '';
          if (!replyText) throw new Error('AI leere Antwort');
          const { error } = await admin.from('ac_messages').insert({
            tenant_id,
            conversation_id,
            direction: 'outbound',
            sender_type: 'bot',
            sender_name: 'KI-Assistent',
            body: replyText,
            metadata: { automation_rule_id: r.id, ai_generated: true },
          });
          if (error) throw error;
          details.reply_length = replyText.length;
        } else if (r.action === 'tag' && conversation_id) {
          const { data: conv } = await admin
            .from('ac_conversations')
            .select('tags')
            .eq('id', conversation_id)
            .maybeSingle();
          const tags = new Set([...(conv?.tags ?? []), r.action_value]);
          await admin.from('ac_conversations').update({ tags: Array.from(tags) }).eq('id', conversation_id);
        } else if (r.action === 'assign' && conversation_id) {
          const { data: user } = await admin
            .from('user_profiles')
            .select('id')
            .eq('email', r.action_value)
            .maybeSingle();
          if (user?.id) {
            await admin.from('ac_conversations').update({ assigned_to: user.id }).eq('id', conversation_id);
            details.assigned_to = user.id;
          } else {
            status = 'skipped_no_user';
          }
        } else if (r.action === 'escalate' && conversation_id) {
          await admin.from('ac_conversations').update({ priority: 'high' }).eq('id', conversation_id);
        } else if (r.action === 'webhook') {
          const res = await fetch(r.action_value, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, message_id, conversation_id, body }),
          });
          details.webhook_status = res.status;
          await res.text();
        } else {
          status = 'noop';
        }
      } catch (e) {
        status = 'error';
        details.error = e instanceof Error ? e.message : String(e);
      }

      await admin.from('ac_automation_runs').insert({
        rule_id: r.id, conversation_id, message_id, action: r.action, status, details,
      });
      await admin
        .from('ac_automation_rules')
        .update({ run_count: (r.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
        .eq('id', r.id);

      executed.push({ rule_id: r.id, action: r.action, status });
    }

    return new Response(JSON.stringify({ ok: true, executed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
