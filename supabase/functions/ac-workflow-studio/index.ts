// Workflow Automation Studio — no-code cross-channel workflow validation & AI-generation.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Node = { id: string; type: 'trigger' | 'condition' | 'action'; kind: string; params?: Record<string, unknown>; next?: string | null; next_true?: string | null; next_false?: string | null };

function validate(flow: { name?: string; nodes?: Node[] }): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes = flow.nodes ?? [];
  if (!flow.name) errors.push('name required');
  if (nodes.length === 0) errors.push('at least one node required');
  const ids = new Set(nodes.map((n) => n.id));
  const triggers = nodes.filter((n) => n.type === 'trigger');
  if (triggers.length === 0) errors.push('at least one trigger required');
  if (triggers.length > 1) warnings.push('multiple triggers detected');
  for (const n of nodes) {
    if (!n.id || !n.type || !n.kind) { errors.push(`node missing id/type/kind`); continue; }
    const refs = [n.next, n.next_true, n.next_false].filter(Boolean) as string[];
    for (const r of refs) if (!ids.has(r)) errors.push(`node ${n.id} references unknown ${r}`);
    if (n.type === 'condition' && !n.next_true && !n.next_false) warnings.push(`condition ${n.id} has no branches`);
    if (n.type === 'action' && !n.next) warnings.push(`action ${n.id} is terminal`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const { op = 'validate' } = body;

    if (op === 'validate') {
      return new Response(JSON.stringify({ success: true, ...validate(body.flow ?? {}) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (op === 'generate') {
      const key = Deno.env.get('LOVABLE_API_KEY')!;
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: 'Erzeuge einen ausführbaren Cross-Channel-Workflow (Trigger→Condition→Action). Antworte NUR mit JSON: {"name":string,"description":string,"nodes":[{"id":string,"type":"trigger|condition|action","kind":string,"params":object,"next":string|null,"next_true":string|null,"next_false":string|null}]}. Kinds: trigger=message_received,ticket_created,call_ended,form_submitted,tag_added; condition=sentiment,keyword,channel,tag,time_window; action=send_email,send_whatsapp,send_sms,assign_agent,create_ticket,add_tag,wait_minutes.' },
            { role: 'user', content: String(body.prompt ?? '') },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (r.status === 429) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (r.status === 402) return new Response(JSON.stringify({ error: 'credits_exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
      const j = await r.json();
      const flow = (() => { try { return JSON.parse(j.choices?.[0]?.message?.content || '{}'); } catch { return {}; } })();
      const v = validate(flow);
      return new Response(JSON.stringify({ success: true, flow, validation: v }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (op === 'save') {
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const v = validate(body.flow ?? {});
      if (!v.ok) return new Response(JSON.stringify({ error: 'invalid_flow', ...v }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const rule = {
        name: body.flow.name,
        description: body.flow.description ?? null,
        trigger_type: body.flow.nodes.find((n: Node) => n.type === 'trigger')?.kind ?? 'manual',
        conditions: body.flow.nodes.filter((n: Node) => n.type === 'condition'),
        actions: body.flow.nodes.filter((n: Node) => n.type === 'action'),
        is_active: body.is_active ?? false,
        metadata: { studio_version: 'phase36', full_flow: body.flow, validation: v },
      };
      const { data, error } = await sb.from('ac_automation_rules').insert(rule).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, rule: data, validation: v }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'unknown_op' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
