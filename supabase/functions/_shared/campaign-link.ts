// Server-signed campaign tracking links: recipient id and redirect target are bound by HMAC.
const enc = new TextEncoder();
async function mac(data: string, secret: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(`campaign-track-v1:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)))).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const secretOf = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
export async function signCampaignLink(recipientId: string, target = '', secret = secretOf()): Promise<string> {
  return mac(`${recipientId}|${target}`, secret);
}
export async function verifyCampaignLink(recipientId: string, target: string, sig: unknown, secret = secretOf()): Promise<boolean> {
  if (!secret || typeof sig !== 'string' || !/^[0-9a-f]{64}$/.test(sig)) return false;
  return (await mac(`${recipientId}|${target}`, secret)) === sig;
}
export function safeRedirectTarget(value: string): string | null {
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null; } catch { return null; }
}
