import { requireProcessAccess } from '../_shared/process-access.ts';
import { z } from 'npm:zod@3.25.76';
// ALIX CONNECT — Phase 28 Playbook Automation Engine
// Cron: hourly. For each customer in ac_customer_health, execute enabled playbooks
// for their current lifecycle_stage (respecting throttle + min/max score).
// Actions supported: send_email, send_sms, send_whatsapp, create_ticket, notify_admin, wait
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


function render(tpl: string, ctx: Record<string, any>) {
  return (tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => String(ctx[k] ?? ''));
}

async function runAction(sb: any, action: any, ctx: any) {
  const kind = action?.kind ?? action?.type;
  const cfg = action?.config ?? action ?? {};
  const to = ctx.email ?? cfg.to;
  const phone = ctx.phone ?? cfg.to;

  if (kind === 'send_email' && to) {
    const { error } = await sb.functions.invoke('send-transactional-email', {
      body: { to, subject: render(cfg.subject ?? 'Alix', ctx), html: render(cfg.body ?? '', ctx).replace(/\n/g, '<br/>') },
    });
    if (error) throw new Error(error.message);
    return { kind, to };
  }
  if (kind === 'send_sms' && phone) {
    const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const auth = Deno.env.get('TWILIO_AUTH_TOKEN');
    const from = Deno.env.get('TWILIO_FROM_NUMBER');
    if (!sid || !auth || !from) throw new Error('Twilio secrets missing');
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(`${sid}:${auth}`), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: phone, From: from, Body: render(cfg.body ?? '', ctx) }).toString(),
    });
    if (!r.ok) throw new Error(`Twilio ${r.status}`);
    return { kind, to: phone };
  }
  if (kind === 'send_whatsapp' && phone) {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) throw new Error('WhatsApp secrets missing');
    const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: render(cfg.body ?? '', ctx) } }),
    });
    if (!r.ok) throw new Error(`WhatsApp ${r.status}`);
    return { kind, to: phone };
  }
  if (kind === 'create_ticket') {
    const { data, error } = await sb.from('tickets').insert({
      subject: render(cfg.subject ?? 'Lifecycle: {{stage}}', ctx),
      description: render(cfg.body ?? '', ctx),
      priority: cfg.priority ?? 'normal',
      status: 'open',
      customer_id: ctx.customer_id,
      source: 'lifecycle_playbook',
    }).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    return { kind, ticket_id: data?.id };
  }
  if (kind === 'notify_admin') {
    await sb.from('app_notifications').insert({
      title: render(cfg.title ?? 'Lifecycle Alert', ctx),
      message: render(cfg.body ?? '', ctx),
      severity: cfg.severity ?? 'info',
      category: 'lifecycle',
      link: cfg.link ?? '/connect/customer-health',
    });
    return { kind };
  }
  return { kind, skipped: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const access = await requireProcessAccess(req, corsHeaders, ['Admin', 'Super Admin']);
    if ('response' in access) return access.response;
    const sb = access.client;
    const parsed = z.object({ dry_run: z.boolean().default(false), playbook_id: z.string().uuid().nullish(), customer_id: z.string().uuid().nullish() }).strict().safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: 'Invalid playbook identifiers' }, 400);
    const dryRun = parsed.data.dry_run, playbookIdFilter = parsed.data.playbook_id ?? null, customerIdFilter = parsed.data.customer_id ?? null;

    const { data: playbooks } = await sb
      .from('ac_lifecycle_playbooks')
      .select('*')
      .eq('enabled', true);
    if (!playbooks?.length) return json({ ok: true, playbooks: 0 });

    const activePlaybooks = playbookIdFilter ? playbooks.filter(p => p.id === playbookIdFilter) : playbooks;

    let executed = 0, throttled = 0, failed = 0;
    const now = Date.now();

    for (const pb of activePlaybooks) {
      let q = sb.from('ac_customer_health').select('*').eq('lifecycle_stage', pb.stage).limit(500);
      if (pb.min_score != null) q = q.gte('score', pb.min_score);
      if (pb.max_score != null) q = q.lte('score', pb.max_score);
      if (customerIdFilter) q = q.eq('customer_id', customerIdFilter);
      const { data: health } = await q;
      if (!health?.length) continue;

      const throttleDays = Number(pb.throttle_days ?? 14);
      const cutoff = new Date(now - throttleDays * 86_400_000).toISOString();

      for (const h of health as any[]) {
        const { data: recent } = await sb.from('ac_lifecycle_runs')
          .select('id').eq('playbook_id', pb.id).eq('customer_id', h.customer_id)
          .gte('created_at', cutoff).limit(1);
        if (recent?.length) { throttled++; continue; }

        const { data: cust } = await sb.from('customers')
          .select('customer_name,email,phone,contact_tenant_id').eq('id', h.customer_id).maybeSingle();
        if (!cust || (!access.machine && !access.tenantIds.includes(cust.contact_tenant_id))) { throttled++; continue; }
        const ctx = {
          customer_id: h.customer_id,
          name: cust?.customer_name ?? '',
          email: cust?.email ?? '',
          phone: cust?.phone ?? '',
          score: h.score,
          stage: h.lifecycle_stage,
        };

        if (dryRun) { executed++; continue; }

        const actions = Array.isArray(pb.actions) ? pb.actions : [];
        const results: any[] = [];
        let status: 'completed' | 'failed' = 'completed';
        try {
          for (const a of actions) results.push(await runAction(sb, a, ctx));
        } catch (e: any) {
          status = 'failed';
          results.push({ error: e?.message ?? String(e) });
          failed++;
        }
        await sb.from('ac_lifecycle_runs').insert({
          playbook_id: pb.id, customer_id: h.customer_id,
          stage: pb.stage, status,
          result: { actions: results, score: h.score },
          completed_at: new Date().toISOString(),
        });
        executed++;
      }
    }

    return json({ ok: true, playbooks: activePlaybooks.length, executed, throttled, failed, dry_run: dryRun });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
