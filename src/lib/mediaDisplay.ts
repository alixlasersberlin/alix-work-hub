// Anzeige-Maskierung für Medien-URLs.
// Regel (Projektvorgabe): In der Oberfläche wird NIE eine Supabase-Domain gezeigt –
// Links werden immer als alixwork.de-Pfad dargestellt. Der gespeicherte Wert
// bleibt unverändert; dies ist reine Präsentation.

const PUBLIC_BASE = 'https://alixwork.de';

/** true, wenn die URL auf einen Supabase-Storage/Projekt-Host zeigt. */
export function isInternalStorageUrl(url?: string | null): boolean {
  if (!url) return false;
  return /supabase\.(co|in)\b/i.test(url);
}

/** Erzeugt eine anzeigefreundliche alixwork.de-Adresse für Storage-URLs. */
export function displayMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (!isInternalStorageUrl(url)) return url;
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/(.+)$/);
    const path = m ? m[1] : u.pathname.replace(/^\/+/, '');
    return `${PUBLIC_BASE}/media/${path}`;
  } catch {
    return `${PUBLIC_BASE}/media`;
  }
}

/** Kurzform (nur Dateiname) für enge Spalten. */
export function displayMediaFileName(url?: string | null): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.split('/').pop() || '');
  } catch {
    return url.split('/').pop() || '';
  }
}
