import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Dispatcher für ac_event_bus.
 * Modi:
 *   { emit: { event_type, payload } } - erzeugt Events für alle passenden aktiven Subscriptions.
 *   {} (leer)                          - verarbeitet Pending/Retry (Cron).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    // Emit-Modus
    if (body?.emit?.event_type) {
      const { event_type, payload } = body.emit;
      const { data: subs } = await sb.from('ac_webhook_subscriptions' as any)
        .select('id,events').eq('is_active', true);
      const targets = (subs ?? []).filter((s: any) => (s.events ?? []).includes(event_type));
      for (const t of targets) {
        await sb.from('ac_event_bus' as any).insert({
          event_type, payload: payload ?? {}, subscription_id: t.id, status: 'pending',
        });
      }
      return json({ queued: targets.length });
    }

    // Dispatch-Modus
    const nowIso = new Date().toISOString();
    const { data: pending } = await sb.from('ac_event_bus' as any)
      .select('id,event_type,payload,subscription_id,attempts')
      .in('status', ['pending', 'retry'])
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order('created_at', { ascending: true })
      .limit(50);

    let delivered = 0, failed = 0;
    for (const ev of pending ?? []) {
      const { data: sub } = await sb.from('ac_webhook_subscriptions' as any)
        .select('id,target_url,secret,is_active').eq('id', (ev as any).subscription_id).maybeSingle();
      if (!sub || !(sub as any).is_active) {
        await sb.from('ac_event_bus' as any).update({ status: 'skipped', completed_at: nowIso }).eq('id', (ev as any).id);
        continue;
      }
      const attempts = ((ev as any).attempts ?? 0) + 1;
      try {
        const r = await fetch((sub as any).target_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Alix-Event': (ev as any).event_type,
            'X-Alix-Signature': (sub as any).secret ?? '',
          },
          body: JSON.stringify({ event: (ev as any).event_type, data: (ev as any).payload }),
        });
        const text = await r.text().catch(() => '');
        if (r.ok) {
          delivered++;
          await sb.from('ac_event_bus' as any).update({
            status: 'delivered', attempts, last_response_code: r.status,
            last_response_body: text.slice(0, 500), completed_at: nowIso,
          }).eq('id', (ev as any).id);
          await sb.from('ac_webhook_subscriptions' as any).update({ last_success_at: nowIso, last_error: null }).eq('id', (sub as any).id);
        } else {
          failed++;
          const nextRetry = attempts >= 5 ? null : new Date(Date.now() + Math.pow(2, attempts) * 60000).toISOString();
          await sb.from('ac_event_bus' as any).update({
            status: nextRetry ? 'retry' : 'failed', attempts, last_response_code: r.status,
            last_response_body: text.slice(0, 500), next_retry_at: nextRetry,
          }).eq('id', (ev as any).id);
          await sb.from('ac_webhook_subscriptions' as any).update({ last_error: `HTTP ${r.status}` }).eq('id', (sub as any).id);
        }
      } catch (e: any) {
        failed++;
        const nextRetry = attempts >= 5 ? null : new Date(Date.now() + Math.pow(2, attempts) * 60000).toISOString();
        await sb.from('ac_event_bus' as any).update({
          status: nextRetry ? 'retry' : 'failed', attempts, last_response_body: String(e?.message).slice(0, 500), next_retry_at: nextRetry,
        }).eq('id', (ev as any).id);
        await sb.from('ac_webhook_subscriptions' as any).update({ last_error: String(e?.message).slice(0, 200) }).eq('id', (sub as any).id);
      }
    }
    return json({ processed: pending?.length ?? 0, delivered, failed });
  } catch (e: any) {
    return json({ error: e?.message ?? 'internal' }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
