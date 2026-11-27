// Pure helpers for external product file backup (no I/O).
export const ALLOWED_HOSTS = new Set([
  "dxbrovbbwrtdsimdnrpy.supabase.co",
  "alix-lasers.de",
  "www.alix-lasers.de",
  "framerusercontent.com",
]);
export const OWN_HOST = "xmrmkgfgpoundfwhnxfs.supabase.co";
export const MAX_BYTES = 50 * 1024 * 1024;

export function externalHost(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^https:\/\//i.test(raw.trim())) return null;
  try {
    const h = new URL(raw.trim()).hostname.toLowerCase();
    return ALLOWED_HOSTS.has(h) ? h : null;
  } catch { return null; }
}

export type Ref = { table: string; id: string; field: string; url: string };

/** Groups references by URL so each external file is fetched and stored once. */
export function groupByUrl(refs: Ref[]): Map<string, Ref[]> {
  const m = new Map<string, Ref[]>();
  for (const r of refs) {
    if (!externalHost(r.url)) continue;
    const u = r.url.trim();
    const list = m.get(u) ?? [];
    list.push(r);
    m.set(u, list);
  }
  return m;
}

export function objectKey(sha256: string): string {
  return `external-media/objects/${sha256.slice(0, 2)}/${sha256}`;
}
