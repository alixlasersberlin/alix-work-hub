import { decidePublication, type ProductInput, type ChannelInput } from './ph-publication.ts';
import { sign, verify, isStale, nextRetryDelay, confirms, type ChangeSignal, type StatusReceipt } from './ph-signal.ts';

export const RECEIVERS: Record<string, string> = {
  de: 'https://alix-lasers.de/api/public/product-hub/notify',
  com: 'https://www.alix-lasers.com/api/public/product-hub/notify',
  dubai: 'https://alix-lasers.ae/api/public/product-hub/notify',
};
export function liveAllowed(flag: string | undefined, approval: Record<string, unknown> | null): boolean {
  return flag === 'true' && approval?.enabled === true && approval.backup_verified === true
    && approval.restore_verified === true && approval.communication_verified === true
    && typeof approval.approved_by === 'string' && approval.approved_by.length > 0;
}
export function prepareSignal(event: ChangeSignal, product: ProductInput, hold: ChannelInput) {
  const decision = decidePublication(product, event.channel, hold);
  return { signal: { ...event, desired: decision.desired }, decision };
}
export async function deliverSignal(signal: ChangeSignal, secret: string, transport: typeof fetch = fetch) {
  const url = RECEIVERS[signal.channel];
  if (!url) return { ok: false, error: 'unknown_receiver', duration_ms: 0 };
  const body = JSON.stringify(signal), timestamp = Math.floor(Date.now() / 1000), start = performance.now();
  try {
    const response = await transport(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5_000),
      headers: { 'Content-Type': 'application/json', 'X-AlixWork-Timestamp': String(timestamp),
        'X-AlixWork-Signature': await sign(secret, timestamp, body) }, body,
    });
    // Only accepted/duplicate acknowledgement; never mark a device online from this response.
    await response.body?.cancel();
    return { ok: response.status === 202 || response.status === 200,
      error: response.status === 202 || response.status === 200 ? null : `receiver_http_${response.status}`,
      duration_ms: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, error: 'connection_failed_or_timeout', duration_ms: Math.round(performance.now() - start) };
  }
}
export function receiptResult(signal: ChangeSignal, receipt: StatusReceipt, newest: string, attempted: boolean) {
  if (signal.event_id !== receipt.event_id || signal.channel !== receipt.channel || signal.product_id !== receipt.product_id)
    return 'identity_mismatch';
  if (isStale(receipt.version, newest)) return 'stale';
  if (!attempted) return 'not_transmitted';
  if (receipt.state === 'ONLINE' && !receipt.public_url) return 'missing_public_url';
  return confirms(signal, receipt) ? 'website_confirmed' : receipt.state === 'ERROR' ? 'website_error' : 'website_mismatch';
}
export function retryAt(attempts: number, now: number): number | null {
  const delay = nextRetryDelay(attempts - 1);
  return delay === null ? null : now + delay;
}

/** Isolated receiver used by integration tests only: no production adapters or persisted product data. */
export async function isolatedReceiver(raw: string, headers: Headers, secret: string,
  readProduct: (id: string) => Promise<{ state: 'ONLINE' | 'OFFLINE'; url: string | null }>,
  callback: (raw: string, headers: Headers) => Promise<void>) {
  const validated = await verify(secret, headers.get('x-alixwork-timestamp'), headers.get('x-alixwork-signature'), raw);
  if (!validated.ok) return new Response(null, { status: 401 });
  const signal = JSON.parse(raw) as ChangeSignal;
  const state = await readProduct(signal.product_id);
  const receipt: StatusReceipt = { event_id: signal.event_id, channel: signal.channel, product_id: signal.product_id,
    version: signal.version, state: state.state, public_url: state.url, error_code: null, error: null,
    observed_at: new Date().toISOString() };
  const body = JSON.stringify(receipt), timestamp = Math.floor(Date.now() / 1000);
  await callback(body, new Headers({ 'x-alixwork-timestamp': String(timestamp), 'x-alixwork-signature': await sign(secret, timestamp, body) }));
  return new Response(null, { status: 202 });
}