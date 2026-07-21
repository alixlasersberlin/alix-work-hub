// Autonomous Service Agents — proposes/executes resolution for a simple ticket.
// Actions are stored in ac_copilot_actions and (optionally, when approved) applied.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { ticket_id, mode = 'propose', executor_user_id } = await req.json();
    if (!ticket_id) throw new Error('ticket_id required');

    const { data: ticket, error: tErr } = await sb.from('tickets').select('*').eq('id', ticket_id).single();
    if (tErr || !ticket) throw new Error('ticket not found');

    const { data: history } = await sb.from('ticket_messages').select('sender, body, created_at').eq('ticket_id', ticket_id).order('created_at', { ascending: true }).limit(30);

    const key = Deno.env.get('LOVABLE_API_KEY')!;
    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: `Du bist ein autonomer Service-Agent. Prüfe, ob der Fall vollautomatisch lösbar ist. Antworte NUR mit JSON:\n{"resolvable":boolean,"confidence":number(0-1),"category":"status_query"|"refund_check"|"appointment"|"info"|"complex","proposed_reply":string,"proposed_actions":[{"kind":"close_ticket"|"send_reply"|"set_status"|"assign","payload":object}],"reasoning":string}\nSetze resolvable=false und category=complex, wenn Unsicherheit besteht.` },
          { role: 'user', content: `Ticket: ${JSON.stringify({ subject: ticket.subject, description: ticket.description, status: ticket.status, priority: ticket.priority })}\nVerlauf: ${JSON.stringify(history ?? [])}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
    const j = await r.json();
    const p = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();

    const executed: any[] = [];
    const needsApproval = mode !== 'execute' || !p.resolvable || Number(p.confidence ?? 0) < 0.85;

    // Record the AI-proposed action set for audit
    await sb.from('ac_copilot_actions').insert({
      user_id: executor_user_id ?? null,
      action_type: 'autonomous_resolve',
      context_type: 'ticket',
      context_id: ticket_id,
      status: needsApproval ? 'proposed' : 'executed',
      payload: p,
    });

    if (!needsApproval) {
      for (const a of (p.proposed_actions ?? [])) {
        try {
          if (a.kind === 'send_reply' && p.proposed_reply) {
            await sb.from('ticket_messages').insert({
              ticket_id, sender: 'agent', body: p.proposed_reply, is_internal: false,
              user_id: executor_user_id ?? null,
            });
            executed.push({ kind: 'send_reply', ok: true });
          } else if (a.kind === 'set_status') {
            await sb.from('tickets').update({ status: a.payload?.status ?? 'in_progress' }).eq('id', ticket_id);
            executed.push({ kind: 'set_status', ok: true });
          } else if (a.kind === 'close_ticket') {
            await sb.from('tickets').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', ticket_id);
            executed.push({ kind: 'close_ticket', ok: true });
          } else if (a.kind === 'assign' && a.payload?.user_id) {
            await sb.from('tickets').update({ assigned_to: a.payload.user_id }).eq('id', ticket_id);
            executed.push({ kind: 'assign', ok: true });
          }
        } catch (err) {
          executed.push({ kind: a.kind, ok: false, error: (err as Error).message });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, proposal: p, needs_approval: needsApproval, executed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
