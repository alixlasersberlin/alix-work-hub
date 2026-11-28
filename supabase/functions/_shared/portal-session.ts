// Short-lived, server-signed portal capability issued only after a verified customer-portal lookup.
// Bound to one order id; derived from a server-only key so browsers cannot forge it.
const enc = new TextEncoder();

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(`portal-session-v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function serverSecret(): string {
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

export async function issuePortalToken(orderId: string, ttlSeconds = 2 * 3600, secret = serverSecret(), now = Date.now()): Promise<string> {
  if (!secret) throw new Error('portal secret missing');
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const sig = hex(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(`${orderId}.${exp}`)));
  return `${exp}.${sig}`;
}

export async function verifyPortalToken(token: unknown, orderId: string, secret = serverSecret(), now = Date.now()): Promise<boolean> {
  if (typeof token !== 'string' || !secret) return false;
  const m = /^(\d{10})\.([0-9a-f]{64})$/.exec(token);
  if (!m) return false;
  if (Number(m[1]) * 1000 < now) return false;
  const expected = hex(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(`${orderId}.${m[1]}`)));
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0;
}
