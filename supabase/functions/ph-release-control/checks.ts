// Pure release-control checks (no I/O) so they stay testable.
export const PH_RESTORE_TABLES = ['ph_products', 'ph_media', 'ph_documents', 'ph_product_channels', 'ph_channels', 'ph_settings'] as const;

/** Stable identity for media/documents: never their array position. */
export function assetKey(a: Record<string, unknown>): string {
  return [a.url ?? '', a.kind ?? a.doc_type ?? '', a.language ?? '', a.version ?? ''].map(String).join('|');
}
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map(k => [k, canon((v as any)[k])]));
  return v;
}
function productDigest(p: Record<string, any>): string {
  const { media = [], documents = [], ...rest } = p;
  const sortBy = (xs: any[]) => [...xs].map(canon).sort((a: any, b: any) => assetKey(a).localeCompare(assetKey(b)) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return JSON.stringify(canon({ ...rest, media: sortBy(media), documents: sortBy(documents) }));
}
const ignored = (p: Record<string, any>) => { const { generated_at: _g, ...r } = p; return r; };

export type BundleSummary = {
  contract: string | null; online: number; offline: number; not_released: number;
  duplicates: string[]; overlap: string[]; missing_ids: number; compatible_v12: boolean; compat_issues: string[];
  pilot: { slug: string; found: 'online' | 'offline' | 'not_released' | 'missing'; sync_allowed: boolean | null };
};

export function summarizeBundle(v13: any, v12: any, pilotSlug: string): BundleSummary {
  const online: any[] = v13?.products ?? [], off: any[] = v13?.offline_products ?? [];
  const ids = [...online, ...off].map(p => p.alix_product_id);
  const seen = new Set<string>(), dup = new Set<string>();
  for (const id of ids) { if (!id) continue; if (seen.has(id)) dup.add(id); seen.add(id); }
  const onIds = new Set(online.map(p => p.alix_product_id));
  const overlap = off.filter(p => onIds.has(p.alix_product_id)).map(p => p.alix_product_id);
  const issues: string[] = [];
  if (v12?.contract !== '1.2') issues.push(`Altformat meldet Vertrag ${v12?.contract ?? 'keinen'} statt 1.2`);
  if (v12 && 'offline_products' in v12) issues.push('Altformat enthält Offline-Liste');
  const old = new Map<string, string>((v12?.products ?? []).map((p: any) => [p.alix_product_id, productDigest(ignored(p))]));
  if (old.size !== online.length) issues.push(`Geräteanzahl weicht ab (${old.size} statt ${online.length})`);
  for (const p of online) {
    const o = old.get(p.alix_product_id);
    if (o === undefined) issues.push(`${p.slug ?? p.alix_product_id}: fehlt im Altformat`);
    else if (o !== productDigest(ignored(p))) issues.push(`${p.slug ?? p.alix_product_id}: Inhalt weicht ab`);
  }
  const po = online.find(p => p.slug === pilotSlug), pf = off.find(p => p.slug === pilotSlug);
  return {
    contract: v13?.contract ?? null, online: online.length,
    offline: off.filter(p => p.state !== 'not_released').length, not_released: off.filter(p => p.state === 'not_released').length,
    duplicates: [...dup], overlap, missing_ids: ids.filter(i => !i).length,
    compatible_v12: issues.length === 0, compat_issues: issues.slice(0, 20),
    pilot: { slug: pilotSlug, found: po ? 'online' : pf ? (pf.state === 'not_released' ? 'not_released' : 'offline') : 'missing', sync_allowed: (po ?? pf)?.sync_allowed ?? null },
  };
}
export const bundlePassed = (s: BundleSummary) => s.contract === '1.3' && s.duplicates.length === 0 && s.overlap.length === 0 && s.missing_ids === 0 && s.compatible_v12;

export type RestoreInput = {
  backupCreatedAt: string;
  restored: Record<string, any[]>;
  live: Record<string, any[]>;
  hashFailures: string[];
};
export type RestoreResult = { passed: boolean; checks: { name: string; passed: boolean; detail: string }[] };

/** Compares an in-memory restored copy with live rows; rows edited after the backup are reported, not failed. */
export function evaluateRestore(i: RestoreInput): RestoreResult {
  const checks: RestoreResult['checks'] = [];
  const t0 = Date.parse(i.backupCreatedAt);
  checks.push({ name: 'SHA-256 der Sicherungsteile', passed: i.hashFailures.length === 0, detail: i.hashFailures.length ? `Abweichend: ${i.hashFailures.join(', ')}` : 'alle Prüfsummen stimmen' });
  for (const t of PH_RESTORE_TABLES) {
    const r = i.restored[t], l = i.live[t] ?? [];
    if (!r) { checks.push({ name: t, passed: false, detail: 'nicht in der Sicherung enthalten' }); continue; }
    const rm = new Map(r.map(x => [x.id ?? x.key, x]));
    const created = (x: any) => Date.parse(x.created_at ?? x.updated_at ?? '1970-01-01');
    const changed = (x: any) => Date.parse(x.updated_at ?? x.created_at ?? '1970-01-01') > t0;
    let missing = 0, diff = 0, later = 0;
    for (const x of l) {
      const b = rm.get(x.id ?? x.key);
      if (!b) { if (created(x) <= t0) missing++; else later++; continue; }
      if (changed(x)) { later++; continue; }
      if (JSON.stringify(canon(b)) !== JSON.stringify(canon(x))) diff++;
    }
    const ok = missing === 0 && diff === 0 && (t !== 'ph_products' || r.length > 0);
    checks.push({ name: t, passed: ok, detail: `${r.length} wiederhergestellt · ${missing} fehlen · ${diff} inhaltlich abweichend · ${later} nach der Sicherung geändert` });
  }
  const pids = new Set((i.restored.ph_products ?? []).map(p => p.id));
  for (const t of ['ph_media', 'ph_documents', 'ph_product_channels']) {
    const orphans = (i.restored[t] ?? []).filter(x => x.product_id && !pids.has(x.product_id)).length;
    checks.push({ name: `${t}: Gerätezuordnung`, passed: orphans === 0, detail: orphans ? `${orphans} ohne Gerät` : 'alle Zuordnungen auflösbar' });
  }
  return { passed: checks.every(c => c.passed), checks };
}
