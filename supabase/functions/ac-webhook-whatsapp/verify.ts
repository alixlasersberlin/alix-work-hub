/**
 * Kryptografische Webhook-Verifikation (P0-1).
 *
 * - Meta Cloud API: HMAC-SHA256 über den RAW-Body, Header `x-hub-signature-256`
 *   im Format `sha256=<hex>`, Secret `WHATSAPP_APP_SECRET`.
 * - Twilio: HMAC-SHA1 über URL + sortierte Formfelder, Header `x-twilio-signature`,
 *   Secret `TWILIO_AUTH_TOKEN`.
 *
 * WICHTIG: Es werden niemals Secrets oder berechnete Signaturen geloggt.
 */

const enc = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/** Timing-sichere Konstantzeit-Prüfung (gleiche Länge vorausgesetzt). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function hmac(secret: string, data: string, hash: 'SHA-256' | 'SHA-1'): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(data));
}

export type VerifyResult = { ok: boolean; provider: 'META' | 'TWILIO' | null; reason?: string };

/** Meta: HMAC-SHA256 über den unveränderten RAW-Body. */
export async function verifyMetaSignature(rawBody: string, header: string | null): Promise<VerifyResult> {
  const secret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!secret) return { ok: false, provider: 'META', reason: 'APP_SECRET_NOT_CONFIGURED' };
  if (!header) return { ok: false, provider: 'META', reason: 'SIGNATURE_MISSING' };
  const received = header.startsWith('sha256=') ? header.slice(7).toLowerCase() : header.toLowerCase();
  const expected = hex(await hmac(secret, rawBody, 'SHA-256'));
  return timingSafeEqual(received, expected)
    ? { ok: true, provider: 'META' }
    : { ok: false, provider: 'META', reason: 'SIGNATURE_INVALID' };
}

/**
 * Twilio: HMAC-SHA1 über die vollständige Request-URL plus alle Formfelder
 * (nach Schlüssel sortiert, key+value konkateniert), Base64-kodiert.
 */
export async function verifyTwilioSignature(
  url: string,
  form: Record<string, string>,
  header: string | null,
): Promise<VerifyResult> {
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!token) return { ok: false, provider: 'TWILIO', reason: 'AUTH_TOKEN_NOT_CONFIGURED' };
  if (!header) return { ok: false, provider: 'TWILIO', reason: 'SIGNATURE_MISSING' };
  let data = url;
  for (const k of Object.keys(form).sort()) data += k + form[k];
  const expected = b64(await hmac(token, data, 'SHA-1'));
  return timingSafeEqual(header, expected)
    ? { ok: true, provider: 'TWILIO' }
    : { ok: false, provider: 'TWILIO', reason: 'SIGNATURE_INVALID' };
}

/**
 * Provider-Erkennung ausschliesslich über Transport-Merkmale (Header /
 * Content-Type), nicht über frei wählbare Payload-Felder.
 */
export function detectProvider(req: Request, contentType: string): 'META' | 'TWILIO' | null {
  if (req.headers.get('x-hub-signature-256')) return 'META';
  if (req.headers.get('x-twilio-signature')) return 'TWILIO';
  if (contentType.includes('application/x-www-form-urlencoded')) return 'TWILIO';
  if (contentType.includes('application/json')) return 'META';
  return null;
}
