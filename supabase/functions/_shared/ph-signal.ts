// PRODUCT HUB 2.0 – signed change signal + status receipt helpers (pure except WebCrypto).
export const MAX_SKEW_SECONDS = 300;

export type ChangeSignal = {
  event: "product.changed"; event_id: string; channel: string; product_id: string;
  version: string; desired: "ONLINE" | "OFFLINE"; issued_at: string;
};
export type StatusReceipt = {
  event_id: string; channel: string; product_id: string; version: string;
  state: "ONLINE" | "OFFLINE" | "ERROR"; public_url: string | null;
  error_code: string | null; error: string | null; observed_at: string;
};

const enc = new TextEncoder();
async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg))), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sign(secret: string, timestamp: number, body: string): Promise<string> {
  return `sha256=${await hmacHex(secret, `${timestamp}.${body}`)}`;
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export type VerifyResult = { ok: true } | { ok: false; reason: "missing" | "expired" | "bad_signature" };
export async function verify(secret: string, tsHeader: string | null, sigHeader: string | null, body: string, nowSec = Math.floor(Date.now() / 1000)): Promise<VerifyResult> {
  if (!tsHeader || !sigHeader || !/^\d{9,11}$/.test(tsHeader)) return { ok: false, reason: "missing" };
  if (Math.abs(nowSec - Number(tsHeader)) > MAX_SKEW_SECONDS) return { ok: false, reason: "expired" };
  return safeEqual(await sign(secret, Number(tsHeader), body), sigHeader) ? { ok: true } : { ok: false, reason: "bad_signature" };
}

/** Deterministic key: one event per product/channel/version/desired → duplicates collapse. */
export async function dedupKey(s: Pick<ChangeSignal, "channel" | "product_id" | "version" | "desired">) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(`${s.channel}|${s.product_id}|${s.version}|${s.desired}`));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
/** Versions are ISO timestamps; an older version never overrides a newer one. */
export function isStale(incoming: string, latest: string | null | undefined): boolean {
  if (!latest) return false;
  const a = Date.parse(incoming), b = Date.parse(latest);
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  if (a !== b) return a < b;
  // PostgreSQL event versions retain microseconds; Date.parse truncates them.
  const micros = (v: string) => Number((v.match(/\.(\d+)(?:Z|[+-])/i)?.[1] ?? '').padEnd(6, '0').slice(0, 6));
  return micros(incoming) < micros(latest);
}
/** Retry backoff for the durable queue: 2 s, 10 s, 30 s, 2 min, 10 min, then give up. */
export const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 120_000, 600_000];
export function nextRetryDelay(attempt: number): number | null {
  return attempt >= 0 && attempt < RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[attempt] : null;
}
/** A delivered signal is NOT publication proof: only a receipt matching the version confirms it. */
export function confirms(signal: Pick<ChangeSignal, "version" | "desired">, r: Pick<StatusReceipt, "version" | "state">): boolean {
  return r.version === signal.version && r.state === signal.desired;
}
