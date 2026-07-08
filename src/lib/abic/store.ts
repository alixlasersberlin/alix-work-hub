// LocalStorage-backed store for ABIC user-defined artifacts (dashboards, reports, KPIs, goals, audit).
// No DB writes. Additive to existing modules.

import type { AbicAuditEntry, AbicDashboardDef, AbicGoal, AbicKpiDef, AbicReportDef } from "./types";

const KEYS = {
  dashboards: "abic.dashboards.v1",
  reports: "abic.reports.v1",
  kpis: "abic.kpis.v1",
  goals: "abic.goals.v1",
  audit: "abic.audit.v1",
  favorites: "abic.favorites.v1",
} as const;

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}

export const abicStore = {
  listDashboards: () => read<AbicDashboardDef[]>(KEYS.dashboards, []),
  upsertDashboard(d: AbicDashboardDef) {
    const all = abicStore.listDashboards();
    const i = all.findIndex((x) => x.id === d.id);
    if (i >= 0) all[i] = d; else all.push(d);
    write(KEYS.dashboards, all);
    abicStore.audit({ action: "dashboard.update", target: d.id });
  },
  removeDashboard(id: string) {
    write(KEYS.dashboards, abicStore.listDashboards().filter((d) => d.id !== id));
  },

  listReports: () => read<AbicReportDef[]>(KEYS.reports, []),
  upsertReport(r: AbicReportDef) {
    const all = abicStore.listReports();
    const i = all.findIndex((x) => x.id === r.id);
    if (i >= 0) all[i] = r; else all.push(r);
    write(KEYS.reports, all);
    abicStore.audit({ action: "report", target: r.id });
  },
  removeReport(id: string) {
    write(KEYS.reports, abicStore.listReports().filter((r) => r.id !== id));
  },

  listKpis: () => read<AbicKpiDef[]>(KEYS.kpis, []),
  upsertKpi(k: AbicKpiDef) {
    const all = abicStore.listKpis();
    const i = all.findIndex((x) => x.id === k.id);
    if (i >= 0) all[i] = k; else all.push(k);
    write(KEYS.kpis, all);
    abicStore.audit({ action: "kpi.update", target: k.id });
  },
  removeKpi(id: string) {
    write(KEYS.kpis, abicStore.listKpis().filter((k) => k.id !== id));
  },

  listGoals: () => read<AbicGoal[]>(KEYS.goals, []),
  upsertGoal(g: AbicGoal) {
    const all = abicStore.listGoals();
    const i = all.findIndex((x) => x.id === g.id);
    if (i >= 0) all[i] = g; else all.push(g);
    write(KEYS.goals, all);
  },
  removeGoal(id: string) {
    write(KEYS.goals, abicStore.listGoals().filter((g) => g.id !== id));
  },

  listFavorites: () => read<string[]>(KEYS.favorites, []),
  toggleFavorite(id: string) {
    const all = new Set(abicStore.listFavorites());
    if (all.has(id)) all.delete(id); else all.add(id);
    write(KEYS.favorites, Array.from(all));
  },

  audit(entry: Omit<AbicAuditEntry, "id" | "ts" | "actor"> & { actor?: string }) {
    const all = read<AbicAuditEntry[]>(KEYS.audit, []);
    all.unshift({
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      actor: entry.actor ?? "current-user",
      action: entry.action,
      target: entry.target,
      meta: entry.meta,
    });
    write(KEYS.audit, all.slice(0, 500));
  },
  listAudit: () => read<AbicAuditEntry[]>(KEYS.audit, []),
};

// ---- Export helpers (CSV) – client-side only ------------------------------
export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  abicStore.audit({ action: "export", target: filename });
}
