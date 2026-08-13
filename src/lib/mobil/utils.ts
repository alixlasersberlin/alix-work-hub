// Helfer für die mobile Mitarbeiteransicht (rein Frontend, keine neuen Datenstrukturen).

export interface AddrLike {
  address?: string | null;
  street?: string | null;
  street2?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
}

export function formatAddress(a: unknown): string {
  const o = (a ?? {}) as AddrLike;
  const street = o.address ?? o.street ?? '';
  const line2 = [o.zip, o.city].filter(Boolean).join(' ');
  return [street, line2].filter((s) => s && String(s).trim()).join(', ');
}

/** Öffnet die Karten-App des Geräts (Apple Maps auf iOS, sonst Google Maps). */
export function mapsHref(address: string): string {
  const q = encodeURIComponent(address);
  const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  return isApple ? `maps://?daddr=${q}` : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

export function telHref(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const clean = String(phone).replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : undefined;
}

export function isPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

/** Einfacher Offline-Cache (localStorage) für bereits geladene Listen. */
export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`mobil:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(`mobil:${key}`, JSON.stringify(value));
  } catch {
    /* Quota – ignorieren */
  }
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function escapeOr(term: string) {
  // PostgREST-`or`-Filter: Kommas und Klammern maskieren
  return term.replace(/[,()]/g, ' ').trim();
}
