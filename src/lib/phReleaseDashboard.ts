// Pure derivation of the PRODUCT HUB release dashboard from recorded evidence only. Missing evidence = "Nicht geprüft".
export type Cell = { state: 'ok' | 'fail' | 'none' | 'info'; text: string };
export type Log = { operation: string; channel_code: string | null; status?: string; payload: any; created_at: string };
const NONE: Cell = { state: 'none', text: 'Nicht geprüft' };
const fmt = (s?: string) => (s ? new Date(s).toLocaleString('de-DE') : '');
const latest = (logs: Log[], f: (l: Log) => boolean) => logs.filter(f).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

export const RELEASE_ROWS = ['API-Version', 'Letzter erfolgreicher API-Abruf', 'Anzahl Online-Geräte', 'Anzahl Offline-Geräte', 'Dublettenprüfung', 'Kompatibilitätsprüfung v1.2', 'Verbindungstest', 'Signaturprüfung', 'Kommunikationsnachweis', 'Apex Pilot Dry Run', 'Sicherheitsprüfung', 'Vollsicherung', 'Wiederherstellungstest', 'Notstopp', 'Pilotgerät', 'Pilotfreigabe', 'Produktivfreigabe'] as const;

export function releaseDashboard(channel: 'de' | 'com', gate: any, logs: Log[], pilotName?: string, now = Date.now()): Record<(typeof RELEASE_ROWS)[number], Cell> {
  const stale = (date?: string) => !date || !Number.isFinite(Date.parse(date)) || now - Date.parse(date) > 24 * 3600e3;
  const bundle = latest(logs, l => l.operation === 'ph2_release_proof' && l.payload?.kind === 'bundle' && l.channel_code === channel);
  const bundleOk = latest(logs, l => l.operation === 'ph2_release_proof' && l.payload?.kind === 'bundle' && l.channel_code === channel && l.payload?.passed === true);
  const conn = latest(logs, l => l.operation === 'ph2_connection_test' && l.channel_code === channel);
  const proof = (k: 'backup' | 'restore'): Cell => {
    const p = gate?.[`${k}_proof`];
    if (!p) return k === 'restore' ? { state: 'fail', text: 'Nicht vollständig geprüft · isolierte Testumgebung fehlt' } : NONE;
    if (k === 'restore' && p.isolated !== true) return { state: 'fail', text: 'Nicht vollständig geprüft · isolierte Testumgebung fehlt' };
    if (stale(p.at)) return { state: 'fail', text: 'Nachweis fehlt oder ist älter als 24 Stunden' };
    return gate?.[`${k}_verified`] === true ? { state: 'ok', text: `Bestanden · ${fmt(p.at)}` } : { state: 'fail', text: `Nicht bestanden · ${fmt(p.at)}` };
  };
  const b = bundle?.payload;
  const mode = gate?.channels?.[channel]?.mode ?? 'blocked';
  const extraProof = (kind: string): Cell => {
    const l = latest(logs, l => l.operation === 'ph2_release_proof' && l.payload?.kind === kind && l.channel_code === (kind === 'security' ? null : channel));
    if (!l) return NONE;
    if (l.payload?.passed === true && stale(l.created_at)) return { state: 'fail', text: 'Nachweis älter als 24 Stunden' };
    return { state: l.payload?.passed === true ? 'ok' : 'fail', text: l.payload?.result ?? (l.payload?.passed ? 'Bestanden' : 'Nicht vollständig geprüft') };
  };
  return {
    'API-Version': b ? { state: b.contract === '1.3' ? 'ok' : 'fail', text: b.contract ? `v${b.contract}` : `HTTP ${b.http_v13 ?? '—'}` } : NONE,
    'Letzter erfolgreicher API-Abruf': bundleOk ? { state: 'ok', text: fmt(bundleOk.payload.checked_at ?? bundleOk.created_at) } : NONE,
    'Anzahl Online-Geräte': b?.online != null ? { state: 'info', text: String(b.online) } : NONE,
    'Anzahl Offline-Geräte': b?.offline != null ? { state: 'info', text: `${b.offline} offline · ${b.not_released ?? 0} nicht freigegeben` } : NONE,
    'Dublettenprüfung': b?.duplicates ? (b.duplicates.length || b.overlap?.length ? { state: 'fail', text: `${b.duplicates.length} Dubletten · ${b.overlap?.length ?? 0} doppelt online/offline` } : { state: 'ok', text: 'Keine Dubletten' }) : NONE,
    'Kompatibilitätsprüfung v1.2': b?.compatible_v12 != null ? (b.compatible_v12 ? { state: 'ok', text: 'Kompatibel (Vergleich über stabile Kennungen)' } : { state: 'fail', text: (b.compat_issues ?? []).slice(0, 2).join('; ') || 'Abweichung' }) : NONE,
    'Verbindungstest': conn ? (stale(conn.created_at) ? { state: 'fail', text: 'Verbindungstest älter als 24 Stunden' } : conn.payload?.result === 'accepted' ? { state: 'ok', text: `Bestanden · ${fmt(conn.payload?.checked_at ?? conn.created_at)}` } : { state: 'fail', text: conn.payload?.message ?? 'Nicht bestanden' }) : NONE,
    'Signaturprüfung': conn ? (conn.payload?.signature === 'verified' && String(conn.payload?.receipt) === 'true' ? { state: 'ok', text: 'Signatur und Rückmeldung geprüft' } : { state: 'fail', text: `Signatur: ${conn.payload?.signature ?? 'fehlt'}` }) : NONE,
    'Kommunikationsnachweis': extraProof('communication'),
    'Apex Pilot Dry Run': extraProof('pilot_dry_run'),
    'Sicherheitsprüfung': extraProof('security'),
    'Vollsicherung': proof('backup'),
    'Wiederherstellungstest': proof('restore'),
    'Notstopp': gate?.emergency_stopped === false ? { state: 'ok', text: 'Manuell aufgehoben' } : { state: 'fail', text: 'Aktiv' },
    'Pilotgerät': gate?.channels?.[channel]?.pilot_product_id ? { state: 'info', text: pilotName ?? 'gewählt' } : { state: 'none', text: 'Nicht gewählt (vorgesehen: Apex · alix-apex)' },
    'Pilotfreigabe': mode === 'pilot' ? { state: 'ok', text: 'Freigegeben' } : { state: 'none', text: 'Nicht freigegeben' },
    'Produktivfreigabe': mode === 'full' ? { state: 'ok', text: 'Freigegeben' } : { state: 'none', text: 'Gesperrt' },
  };
}
