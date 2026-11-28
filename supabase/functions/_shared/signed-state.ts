// Generic server-signed, expiring state values (OAuth state, one-off capabilities).
const enc = new TextEncoder();
async function mac(label: string, data: string, secret: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(`${label}:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)))).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const secretOf = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export async function signState(label: string, subject: string, ttlSeconds: number, secret = secretOf(), now = Date.now()): Promise<string> {
  if (!secret || !/^[0-9a-zA-Z_-]{1,64}$/.test(subject)) throw new Error('invalid state');
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${subject}.${exp}.${await mac(label, `${subject}.${exp}`, secret)}`;
}

/** Returns the signed subject when the state is authentic and unexpired, otherwise null. */
export async function verifyState(label: string, state: unknown, secret = secretOf(), now = Date.now()): Promise<string | null> {
  if (typeof state !== 'string' || !secret) return null;
  const m = /^([0-9a-zA-Z_-]{1,64})\.(\d{10})\.([0-9a-f]{64})$/.exec(state);
  if (!m || Number(m[2]) * 1000 < now) return null;
  return (await mac(label, `${m[1]}.${m[2]}`, secret)) === m[3] ? m[1] : null;
}
