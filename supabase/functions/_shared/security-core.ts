// Central, dependency-free security helpers reused by edge functions.

/** HTML-escapes untrusted text before interpolation into email or document markup. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Masks an email address for logs so recipients are never written in clear text. */
export function maskEmail(value: unknown): string {
  const s = String(value ?? '');
  const at = s.indexOf('@');
  if (at < 1) return s ? '***' : '';
  return `${s[0]}***@${s.slice(at + 1).replace(/^[^.]*/, '***')}`;
}

/** Masks a phone number for logs, keeping only the last two digits. */
export function maskPhone(value: unknown): string {
  const d = String(value ?? '').replace(/\D/g, '');
  return d ? `***${d.slice(-2)}` : '';
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** True only when a caller-requested recipient equals one of the stored contact addresses. */
export function storedRecipient(requested: unknown, ...stored: unknown[]): boolean {
  const r = normalizeEmail(requested);
  return !!r && stored.some((s) => normalizeEmail(s) === r);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function jsonResponse(cors: Record<string, string>, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** Generic client-facing error: internal details stay in server logs only. */
export function safeError(cors: Record<string, string>, err: unknown, status = 500): Response {
  console.error('[edge-error]', err instanceof Error ? err.message : String(err));
  return jsonResponse(cors, { error: status === 500 ? 'Interner Fehler' : 'Anfrage abgelehnt' }, status);
}

/** Digits-only comparison key for phone numbers (handles +49 / 0049 / 0 national prefixes). */
export function phoneKey(value: unknown): string {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `49${d.slice(1)}`;
  return d.length >= 8 ? d : '';
}

/** True only when the requested number equals one of the stored contact numbers. */
export function storedPhone(requested: unknown, ...stored: unknown[]): boolean {
  const r = phoneKey(requested);
  return !!r && stored.some((s) => phoneKey(s) === r);
}
