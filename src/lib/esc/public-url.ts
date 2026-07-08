// All public-facing links MUST use https://alixworks.de.
// Never leak preview or Supabase URLs into e-mails, tokens, or public pages.
export const ALIXWORKS_PUBLIC_BASE = 'https://alixworks.de';

export function publicUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${ALIXWORKS_PUBLIC_BASE}${clean}`;
}

export function confirmUrl(token: string): string {
  return publicUrl(`/termin-bestaetigen/${encodeURIComponent(token)}`);
}

export function bookingUrl(): string {
  return publicUrl('/book');
}
