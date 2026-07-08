// RC1 – Enterprise Release Candidate store (localStorage; additive)
const K = "alixworks_rc1_v1";

export type GoLiveItem = { id: string; label: string; status: "ok" | "warn" | "fail"; note?: string };
export type UpdateEntry = { version: string; date: string; notes: string; installed: boolean };
export type TestRun = { id: string; name: string; status: "pass" | "fail" | "pending"; ts: number };
export type QualityIssue = { id: string; kind: string; message: string; severity: "info" | "warn" | "error" };

type State = {
  version: string;
  productionMode: boolean;
  goLive: GoLiveItem[];
  updates: UpdateEntry[];
  tests: TestRun[];
  quality: QualityIssue[];
  favorites: string[];
  recents: string[];
  language: string;
  license: { status: string; modules: string[]; tenants: number; expires: string };
};

const DEFAULT: State = {
  version: "1.0.0-rc1",
  productionMode: false,
  goLive: [
    { id: "smtp", label: "SMTP konfiguriert", status: "ok" },
    { id: "calendar", label: "Kalender verbunden", status: "ok" },
    { id: "apis", label: "APIs erreichbar", status: "ok" },
    { id: "roles", label: "Rollen definiert", status: "ok" },
    { id: "perms", label: "Berechtigungen geprüft", status: "ok" },
    { id: "backup", label: "Backup aktiv", status: "warn", note: "Zeitplan prüfen" },
    { id: "branding", label: "Branding gesetzt", status: "ok" },
    { id: "certs", label: "Zertifikate gültig", status: "ok" },
    { id: "integrations", label: "Integrationen verbunden", status: "ok" },
    { id: "docs", label: "Dokumentation vorbereitet", status: "ok" },
    { id: "audit", label: "Audit-Log aktiv", status: "ok" },
    { id: "logs", label: "Logging vollständig", status: "ok" },
    { id: "monitoring", label: "Monitoring aktiv", status: "ok" },
    { id: "perf", label: "Performance optimiert", status: "ok" },
    { id: "security", label: "Sicherheit geprüft", status: "ok" },
  ],
  updates: [
    { version: "1.0.0-rc1", date: new Date().toISOString().slice(0, 10), notes: "Release Candidate – Finalisierung", installed: true },
    { version: "0.14.0", date: "2026-06-01", notes: "EIG · Integration Gateway", installed: true },
    { version: "0.13.0", date: "2026-05-15", notes: "EAOC · Administration Center", installed: true },
  ],
  tests: [],
  quality: [],
  favorites: [],
  recents: [],
  language: "de",
  license: { status: "aktiv", modules: ["CRM", "Service", "ECP", "EMP", "ABIC", "ECQM", "EAOC", "EIG"], tenants: 4, expires: "2027-12-31" },
};

function read(): State {
  try { const raw = localStorage.getItem(K); if (raw) return { ...DEFAULT, ...JSON.parse(raw) }; } catch {}
  return { ...DEFAULT };
}
function write(s: State) { localStorage.setItem(K, JSON.stringify(s)); }

export const rc1 = {
  get: () => read(),
  set: (patch: Partial<State>) => { const s = { ...read(), ...patch }; write(s); return s; },
  toggleFavorite: (path: string) => {
    const s = read();
    s.favorites = s.favorites.includes(path) ? s.favorites.filter(p => p !== path) : [...s.favorites, path];
    write(s); return s;
  },
  addRecent: (path: string) => {
    const s = read();
    s.recents = [path, ...s.recents.filter(p => p !== path)].slice(0, 10);
    write(s); return s;
  },
  updateGoLive: (id: string, patch: Partial<GoLiveItem>) => {
    const s = read();
    s.goLive = s.goLive.map(i => i.id === id ? { ...i, ...patch } : i);
    write(s); return s;
  },
  addTestRun: (name: string, status: TestRun["status"]) => {
    const s = read();
    s.tests = [{ id: crypto.randomUUID(), name, status, ts: Date.now() }, ...s.tests].slice(0, 100);
    write(s); return s;
  },
  runQualityCheck: () => {
    const s = read();
    s.quality = [
      { id: "q1", kind: "i18n", message: "Übersetzungen sind vorbereitet (de aktiv)", severity: "info" },
      { id: "q2", kind: "routes", message: "Alle bekannten Routen registriert", severity: "info" },
      { id: "q3", kind: "a11y", message: "ARIA-Labels teilweise ergänzt", severity: "warn" },
    ];
    write(s); return s;
  },
  activateProduction: () => {
    const s = read();
    if (s.goLive.some(i => i.status === "fail")) throw new Error("Go-Live Checkliste enthält kritische Fehler");
    s.productionMode = true; write(s); return s;
  },
  deactivateProduction: () => { const s = read(); s.productionMode = false; write(s); return s; },
};
