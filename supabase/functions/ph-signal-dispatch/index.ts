import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { liveAllowed, prepareSignal, deliverSignal } from '../_shared/ph-delivery.ts';
import { operatingAllowed, revisionMatches } from '../_shared/ph-operating-mode.ts';
import { legacyDecision } from '../_shared/ph-publication.ts';
const Body = z.object({ limit: z.number().int().min(1).max(20).default(10) });
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };
const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), url = Deno.env.get('SUPABASE_URL'), cron = Deno.env.get('CRON_SECRET');
  if (!key || !url) return json(503, { error: 'configuration_missing' });
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${key}` && (!cron || auth !== `Bearer ${cron}`)) return json(401, { error: 'unauthorized' });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json(400, { error: parsed.error.flatten().fieldErrors });
  const sb = createClient(url, key);
  try {
    const { data: config, error: configError } = await sb.from('ph_settings').select('value').eq('key', 'ph2_activation').maybeSingle();
    if (configError) throw configError;
    const live = liveAllowed(Deno.env.get('PH_SIGNAL_LIVE_ENABLED'), config?.value as Record<string, unknown> | null);
    const { data: jobs, error } = await sb.rpc('ph2_claim', { _live: live, _limit: parsed.data.limit });
    if (error) throw error;
    let sent = 0, shadow = 0;
    for (const job of jobs ?? []) {
      const payload = job.payload as any;
      const { signal, decision } = prepareSignal(payload.signal, payload.snapshot, { hold: payload.hold });
      const { data: prepared, error: prepareError } = await sb.rpc('ph2_prepare', {
        _id: job.id, _lease: payload.lease_token, _signal: signal, _decision: decision,
      });
      if (prepareError) throw prepareError;
      if (!prepared) continue;
      let result: { ok: boolean; error: string | null; duration_ms: number } = { ok: true, error: null, duration_ms: 0 };
      if (live) {
        // Recheck gates and newest version immediately before the only external call.
        const [{ data: gate }, { data: latest }] = await Promise.all([
          sb.from('ph_settings').select('value').eq('key', 'ph2_activation').maybeSingle(),
          sb.from('ph_sync_log').select('id').eq('operation', 'ph2_signal').eq('product_id', job.product_id).eq('channel_code', job.channel_code).order('payload->signal->>version', { ascending: false }).limit(1).maybeSingle(),
        ]);
        const secret = Deno.env.get(`PH_NOTIFY_SECRET_${signal.channel.toUpperCase()}`);
        if (!revisionMatches(gate?.value as any, payload.operating_revision) || !operatingAllowed(Deno.env.get('PH_SIGNAL_LIVE_ENABLED'), gate?.value as any, signal.channel, job.product_id)) result = { ok: false, error: 'activation_blocked', duration_ms: 0 };
        else if (latest?.id !== job.id) result = { ok: false, error: 'superseded', duration_ms: 0 };
        else if (!secret) result = { ok: false, error: 'channel_not_connected', duration_ms: 0 };
        else {
          // Persist the attempt before transport; an immediate signed receipt may finish the row first.
          const attempted_at = new Date().toISOString();
          const { data: reserved, error: reserveError } = await sb.from('ph_sync_log').update({ payload: { ...payload, signal, decision, attempted_at,
            attempt_history: [...(payload.attempt_history ?? []), { attempted_at, version: signal.version, desired: signal.desired }] } }).eq('id', job.id).eq('status', 'sending').select('id');
          if (reserveError || !reserved?.length) result = { ok: false, error: 'transmission_reservation_lost', duration_ms: 0 };
          else {
            const { data: finalGate, error: finalGateError } = await sb.from('ph_settings').select('value').eq('key','ph2_activation').maybeSingle();
            if (finalGateError || !revisionMatches(finalGate?.value as any, payload.operating_revision) || !operatingAllowed(Deno.env.get('PH_SIGNAL_LIVE_ENABLED'), finalGate?.value as any, signal.channel, job.product_id)) result = { ok: false, error: 'activation_blocked', duration_ms: 0 };
            else { result = await deliverSignal(signal, secret); if (result.ok) sent++; }
          }
        }
      } else shadow++;
      const { error: finishError } = await sb.rpc('ph2_finish', { _id: job.id, _lease: payload.lease_token,
        _result: { ...result, attempted_at: new Date().toISOString(), signal, decision, legacy_decision: legacyDecision(payload.snapshot, signal.channel), shadow_mode: !live } });
      if (finishError) throw finishError;
    }
    // Short retries are event-driven. Long delays and interrupted workers use the dormant
    // recovery job, which must be activated separately after acceptance.
    if (live && cron && (jobs?.length ?? 0) > 0 && typeof EdgeRuntime !== 'undefined') {
      const { data: next } = await sb.from('ph_sync_log').select('payload').eq('operation', 'ph2_signal')
        .eq('direction', 'outbound').in('status', ['retry','awaiting_receipt'])
        .order('payload->>next_attempt_at').limit(1).maybeSingle();
      const delay = Date.parse((next?.payload as any)?.next_attempt_at ?? '') - Date.now();
      if (Number.isFinite(delay) && delay <= 30_000) EdgeRuntime.waitUntil((async () => {
        await new Promise(resolve => setTimeout(resolve, Math.max(0, delay)));
        const response = await fetch(`${url}/functions/v1/ph-signal-dispatch`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cron}` }, body: '{"limit":10}',
        });
        await response.body?.cancel();
      })().catch(() => { /* persisted events are recovered by the independent worker */ }));
    }
    return json(200, { live_enabled: live, sent, shadow, processed: jobs?.length ?? 0 });
  } catch { return json(500, { error: 'queue_processing_failed' }); }
});