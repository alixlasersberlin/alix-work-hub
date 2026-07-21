// ALIX CONNECT — Phase 29 Journey Orchestrator 2.0
// Executes journey flow graphs (nodes/edges) for enrolled contacts.
// Node kinds: trigger, action (email/sms/whatsapp/webhook/tag/notify), condition, wait, ab_split, end
// Cron: every 5 minutes.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Node = { id: string; kind: string; config?: any; label?: string };
type Edge = { from: string; to: string; branch?: string };
type Graph = { nodes: Node[]; edges: Edge[] };

function render(tpl: string, ctx: Record<string, any>) {
  return (tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => String(ctx[k] ?? ''));
}
function firstEdge(g: Graph, from: string, branch?: string) {
  const list = g.edges.filter(e => e.from === from);
  if (branch) return list.find(e => e.branch === branch) ?? list.find(e => !e.branch);
  return list.find(e => !e.branch) ?? list[0];
}
function nodeById(g: Graph, id: string) { return g.nodes.find(n => n.id === id); }

async function loadContact(contact_id: string) {
  const { data: c } = await sb.from('ac_contacts').select('id,name,email,phone,customer_id,tags,attributes').eq('id', contact_id).maybeSingle();
  return c ?? { id: contact_id };
}

function evalCondition(cfg: any, ctx: any): 'yes' | 'no' {
  try {
    const field = String(cfg?.field ?? '');
    const op = String(cfg?.op ?? 'eq');
    const val = cfg?.value;
    const cur = field.split('.').reduce((a: any, k) => a?.[k], ctx);
    if (op === 'eq') return cur == val ? 'yes' : 'no';
    if (op === 'neq') return cur != val ? 'yes' : 'no';
    if (op === 'gt') return Number(cur) > Number(val) ? 'yes' : 'no';
    if (op === 'lt') return Number(cur) < Number(val) ? 'yes' : 'no';
    if (op === 'contains') return String(cur ?? '').includes(String(val ?? '')) ? 'yes' : 'no';
    if (op === 'exists') return cur != null && cur !== '' ? 'yes' : 'no';
    return 'no';
  } catch { return 'no'; }
}

async function runAction(cfg: any, ctx: any) {
  const kind = cfg?.action ?? cfg?.kind;
  if (kind === 'email' && ctx.email) {
    const { error } = await sb.functions.invoke('send-transactional-email', {
      body: { to: ctx.email, subject: render(cfg.subject ?? 'Alix', ctx), html: render(cfg.body ?? '', ctx).replace(/\n/g, '<br/>') },
    });
    if (error) throw new Error(error.message);
    return { action: 'email', to: ctx.email };
  }
  if (kind === 'sms' && ctx.phone) {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const auth = Deno.env.get('TWILIO_AUTH_TOKEN');
    const from = Deno.env.get('TWILIO_FROM_NUMBER');
    if (!sid || !auth || !from) throw new Error('Twilio secrets missing');
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${sid}:${auth}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: ctx.phone, From: from, Body: render(cfg.body ?? '', ctx) }).toString(),
    });
    if (!r.ok) throw new Error(`Twilio ${r.status}`);
    return { action: 'sms', to: ctx.phone };
  }
  if (kind === 'whatsapp' && ctx.phone) {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) throw new Error('WhatsApp secrets missing');
    const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: ctx.phone, type: 'text', text: { body: render(cfg.body ?? '', ctx) } }),
    });
    if (!r.ok) throw new Error(`WhatsApp ${r.status}`);
    return { action: 'whatsapp', to: ctx.phone };
  }
  if (kind === 'webhook' && cfg.url) {
    const r = await fetch(cfg.url, {
      method: cfg.method ?? 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ctx, ...(cfg.payload ?? {}) }),
    });
    if (!r.ok) throw new Error(`Webhook ${r.status}`);
    return { action: 'webhook', url: cfg.url };
  }
  if (kind === 'notify_admin') {
    await sb.from('app_notifications').insert({
      title: render(cfg.title ?? 'Journey Alert', ctx),
      message: render(cfg.body ?? '', ctx),
      severity: cfg.severity ?? 'info',
      category: 'journey',
      link: cfg.link ?? '/connect/journey-orchestrator',
    });
    return { action: 'notify_admin' };
  }
  if (kind === 'tag' && ctx.id) {
    const { data: c } = await sb.from('ac_contacts').select('tags').eq('id', ctx.id).maybeSingle();
    const tags = Array.from(new Set([...(c?.tags ?? []), ...(Array.isArray(cfg.tags) ? cfg.tags : [cfg.tag].filter(Boolean))]));
    await sb.from('ac_contacts').update({ tags }).eq('id', ctx.id);
    return { action: 'tag', tags };
  }
  return { action: kind ?? 'noop', skipped: true };
}

async function stepRun(journey: any, run: any) {
  const g: Graph = journey.graph ?? { nodes: [], edges: [] };
  const contact = await loadContact(run.contact_id);
  const ctx = { ...contact, variant: run.variant, ...(run.context ?? {}) };
  const path: any[] = Array.isArray(run.path) ? [...run.path] : [];

  let nodeId: string | null = run.current_node_id;
  if (!nodeId) {
    const trigger = g.nodes.find(n => n.kind === 'trigger') ?? g.nodes[0];
    nodeId = trigger?.id ?? null;
  }
  if (!nodeId) throw new Error('No entry node');

  // Execute up to 20 nodes per tick; a `wait` node schedules next_action_at and exits.
  for (let i = 0; i < 20; i++) {
    const node = nodeById(g, nodeId!);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    path.push({ node: node.id, at: new Date().toISOString() });

    if (node.kind === 'end') {
      await sb.from('ac_journey_runs').update({
        status: 'completed', current_node_id: node.id, path, completed_at: new Date().toISOString(),
        next_action_at: null,
      }).eq('id', run.id);
      return;
    }
    if (node.kind === 'wait') {
      const mins = Number(node.config?.minutes ?? 60);
      const next = new Date(Date.now() + mins * 60_000).toISOString();
      const nextEdge = firstEdge(g, node.id);
      await sb.from('ac_journey_runs').update({
        status: 'waiting', current_node_id: nextEdge?.to ?? node.id, path, next_action_at: next,
      }).eq('id', run.id);
      return;
    }
    if (node.kind === 'condition') {
      const branch = evalCondition(node.config ?? {}, ctx);
      const edge = firstEdge(g, node.id, branch);
      if (!edge) { await sb.from('ac_journey_runs').update({ status: 'completed', current_node_id: node.id, path, completed_at: new Date().toISOString() }).eq('id', run.id); return; }
      nodeId = edge.to; continue;
    }
    if (node.kind === 'ab_split') {
      const variants: string[] = node.config?.variants ?? ['A', 'B'];
      const chosen = run.variant ?? variants[Math.floor(Math.random() * variants.length)];
      const edge = firstEdge(g, node.id, chosen) ?? firstEdge(g, node.id);
      ctx.variant = chosen;
      await sb.from('ac_journey_runs').update({ variant: chosen }).eq('id', run.id);
      if (!edge) return;
      nodeId = edge.to; continue;
    }
    if (node.kind === 'action') {
      await runAction(node.config ?? {}, ctx);
    }
    // trigger or action -> continue to next edge
    const nextEdge = firstEdge(g, node.id);
    if (!nextEdge) {
      await sb.from('ac_journey_runs').update({ status: 'completed', current_node_id: node.id, path, completed_at: new Date().toISOString() }).eq('id', run.id);
      return;
    }
    nodeId = nextEdge.to;
  }

  await sb.from('ac_journey_runs').update({ status: 'active', current_node_id: nodeId, path, next_action_at: new Date(Date.now() + 60_000).toISOString() }).eq('id', run.id);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    let dryRun = false, journeyIdFilter: string | null = null, enrollContactId: string | null = null;
    try {
      const body = await req.json();
      dryRun = !!body?.dry_run;
      journeyIdFilter = body?.journey_id ?? null;
      enrollContactId = body?.enroll_contact_id ?? null;
    } catch { /* no body */ }

    // Optional enrollment
    if (journeyIdFilter && enrollContactId) {
      await sb.from('ac_journey_runs').insert({
        journey_id: journeyIdFilter, contact_id: enrollContactId,
        status: 'active', next_action_at: new Date().toISOString(),
      });
    }

    let q = sb.from('ac_journey_runs').select('*')
      .in('status', ['active', 'waiting'])
      .lte('next_action_at', new Date().toISOString())
      .limit(200);
    if (journeyIdFilter) q = q.eq('journey_id', journeyIdFilter);
    const { data: runs } = await q;
    if (!runs?.length) return json({ ok: true, runs: 0 });

    const jids = Array.from(new Set(runs.map(r => r.journey_id)));
    const { data: journeys } = await sb.from('ac_journeys').select('*').in('id', jids);
    const jmap = new Map((journeys ?? []).map(j => [j.id, j]));

    let processed = 0, failed = 0;
    for (const run of runs) {
      const j = jmap.get(run.journey_id);
      if (!j || j.status !== 'active') continue;
      if (dryRun) { processed++; continue; }
      try { await stepRun(j, run); processed++; }
      catch (e: any) {
        failed++;
        await sb.from('ac_journey_runs').update({ status: 'failed', last_error: e?.message ?? String(e) }).eq('id', run.id);
      }
    }
    return json({ ok: true, processed, failed, dry_run: dryRun });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
