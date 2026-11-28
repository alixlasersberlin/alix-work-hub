import { createClient } from 'npm:@supabase/supabase-js@2';
import { RECEIVERS } from './ph-delivery.ts';
import { sign } from './ph-signal.ts';
import { evaluateConnectionTest } from './ph-connection-test.ts';
// Full connection test: content-free connection.test signal, never a product.changed event, never a product write.
async function probe(url: string, init: RequestInit) {
  const t = performance.now();
  try { const r = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(5000) }); await r.body?.cancel(); return { status: r.status, ms: Math.round(performance.now() - t) }; }
  catch { return { status: null, ms: Math.round(performance.now() - t) }; }
}
export async function fullTest(channel: 'de' | 'com', userId: string, replay = false) {
  const url = RECEIVERS[channel], notify = Deno.env.get(`PH_NOTIFY_SECRET_${channel.toUpperCase()}`);
  const sbUrl = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!notify || !Deno.env.get(`PH_STATUS_SECRET_${channel.toUpperCase()}`) || !key || !sbUrl) return { channel, result: 'error', message: 'Schlüssel nicht hinterlegt', signature: 'unknown', receipt: false, replay_verified: false, replay_status: null, response_ms: null };
  const sb = createClient(sbUrl, key);
  const test_id = crypto.randomUUID(), started = new Date().toISOString();
  const body = JSON.stringify({ event: 'connection.test', event_id: test_id, test_id, channel, issued_at: started, test: true });
  const get = await probe(url, { method: 'GET' });
  const unsigned = await probe(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  const ts = Math.floor(Date.now() / 1000);
  const signed = await probe(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-AlixWork-Timestamp': String(ts), 'X-AlixWork-Signature': await sign(notify, ts, body) } });
  let receipt = false;
  if (signed.status === 200 || signed.status === 202) {
    for (let i = 0; i < 8 && !receipt; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const { data } = await sb.from('ph_sync_log').select('id').eq('operation', 'ph2_connection_test_receipt').eq('channel_code', channel).eq('payload->>test_id', test_id).limit(1);
      receipt = !!data?.length;
    }
  }
  let replayStatus: number | null = null;
  let replayVerified = false;
  if (replay && receipt) {
    const repeated = await probe(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-AlixWork-Timestamp': String(ts), 'X-AlixWork-Signature': await sign(notify, ts, body) } });
    replayStatus = repeated.status;
    await new Promise(r => setTimeout(r, 1000));
    const { count, error } = await sb.from('ph_sync_log').select('id', { count: 'exact', head: true }).eq('operation', 'ph2_connection_test_receipt').eq('channel_code', channel).eq('payload->>test_id', test_id);
    // A repeated 200 alone proves nothing. Duplicate receipts fail closed.
    replayVerified = !error && count === 1 && repeated.status === 409;
  }
  const { data: context } = await sb.rpc('ph2_release_context', { _channel: channel });
  const outcome = evaluateConnectionTest(get, unsigned, signed, receipt);
  const row = { channel, test_id, checked_at: new Date().toISOString(), http_get: get.status, http_unsigned: unsigned.status, http_signed: signed.status, response_ms: signed.ms, context, replay_status: replayStatus, replay_verified: replayVerified, ...outcome };
  const { error: logError } = await sb.from('ph_sync_log').insert({ channel_code: channel, direction: 'outbound', operation: 'ph2_connection_test', status: outcome.result === 'accepted' ? 'ok' : 'error', message: outcome.message, payload: { ...row, requested_by: userId }, duration_ms: signed.ms });
  if (logError) throw new Error("Testprotokoll konnte nicht gespeichert werden");
  return row;
}
