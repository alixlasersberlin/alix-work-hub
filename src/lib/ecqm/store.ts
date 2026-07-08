// LocalStorage-backed store for ECQM. Additive – no DB writes, no schema changes.
// Soft-delete only for quality-critical data.

import type {
  EcqmAudit, EcqmAuditLogEntry, EcqmApproval, EcqmBase, EcqmCapa, EcqmChange,
  EcqmComplaint, EcqmDocument, EcqmProcess, EcqmRisk, EcqmSupplier, EcqmTrainingRecord,
} from "./types";

const K = {
  documents: "ecqm.documents.v1",
  processes: "ecqm.processes.v1",
  capas: "ecqm.capas.v1",
  complaints: "ecqm.complaints.v1",
  risks: "ecqm.risks.v1",
  audits: "ecqm.audits.v1",
  suppliers: "ecqm.suppliers.v1",
  changes: "ecqm.changes.v1",
  trainings: "ecqm.trainings.v1",
  approvals: "ecqm.approvals.v1",
  auditlog: "ecqm.auditlog.v1",
  tenant: "ecqm.tenant.v1",
} as const;

function read<T>(k: string, fallback: T): T {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
function write<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}

function log(action: string, targetType: string, targetId: string, meta?: Record<string, unknown>) {
  const all = read<EcqmAuditLogEntry[]>(K.auditlog, []);
  all.unshift({
    id: crypto.randomUUID(), ts: new Date().toISOString(), actor: "current-user",
    action, targetType, targetId, meta,
  });
  write(K.auditlog, all.slice(0, 1000));
}

function crud<T extends EcqmBase>(key: string, targetType: string) {
  return {
    list: (): T[] => read<T[]>(key, []).filter((x) => !x.deletedAt),
    listAll: (): T[] => read<T[]>(key, []),
    get: (id: string): T | undefined => read<T[]>(key, []).find((x) => x.id === id),
    upsert(item: Omit<T, "id" | "createdAt" | "updatedAt"> & Partial<Pick<T, "id" | "createdAt" | "updatedAt">>) {
      const all = read<T[]>(key, []);
      const now = new Date().toISOString();
      const idx = item.id ? all.findIndex((x) => x.id === item.id) : -1;
      if (idx >= 0) {
        const next = { ...all[idx], ...item, updatedAt: now } as T;
        all[idx] = next;
        write(key, all);
        log("update", targetType, next.id);
        return next;
      }
      const created = { ...item, id: item.id ?? crypto.randomUUID(), createdAt: now, updatedAt: now } as T;
      all.push(created);
      write(key, all);
      log("create", targetType, created.id);
      return created;
    },
    softDelete(id: string) {
      const all = read<T[]>(key, []);
      const i = all.findIndex((x) => x.id === id);
      if (i < 0) return;
      all[i] = { ...all[i], deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      write(key, all);
      log("soft-delete", targetType, id);
    },
    restore(id: string) {
      const all = read<T[]>(key, []);
      const i = all.findIndex((x) => x.id === id);
      if (i < 0) return;
      all[i] = { ...all[i], deletedAt: null, updatedAt: new Date().toISOString() };
      write(key, all);
      log("restore", targetType, id);
    },
  };
}

export const ecqm = {
  documents: crud<EcqmDocument>(K.documents, "document"),
  processes: crud<EcqmProcess>(K.processes, "process"),
  capas: crud<EcqmCapa>(K.capas, "capa"),
  complaints: crud<EcqmComplaint>(K.complaints, "complaint"),
  risks: crud<EcqmRisk>(K.risks, "risk"),
  audits: crud<EcqmAudit>(K.audits, "audit"),
  suppliers: crud<EcqmSupplier>(K.suppliers, "supplier"),
  changes: crud<EcqmChange>(K.changes, "change"),
  trainings: crud<EcqmTrainingRecord>(K.trainings, "training"),
  approvals: crud<EcqmApproval>(K.approvals, "approval"),
  auditlog: {
    list: (): EcqmAuditLogEntry[] => read<EcqmAuditLogEntry[]>(K.auditlog, []),
    log,
  },
  tenant: {
    current: (): string => read<string>(K.tenant, "Alix Lasers GmbH"),
    set: (t: string) => write(K.tenant, t),
    list: (): string[] => [
      "Alix Lasers GmbH",
      "Alix Medical GmbH",
      "Medi Metropole GmbH",
      "BeautyTec Holding",
    ],
  },
};

// ---- KPI helpers ----------------------------------------------------------
export function ecqmKpis() {
  const capas = ecqm.capas.list();
  const complaints = ecqm.complaints.list();
  const risks = ecqm.risks.list();
  const audits = ecqm.audits.list();
  const docs = ecqm.documents.list();
  const suppliers = ecqm.suppliers.list();
  const trainings = ecqm.trainings.list();
  const now = new Date();

  const overdue = (d?: string) => d ? new Date(d) < now : false;
  const expiring = (d?: string) => d ? (new Date(d).getTime() - now.getTime()) / 86400000 < 30 : false;

  return {
    openCapas: capas.filter((c) => c.status !== "geschlossen").length,
    overdueCapas: capas.filter((c) => c.status !== "geschlossen" && overdue(c.due)).length,
    openComplaints: complaints.filter((c) => c.status !== "geschlossen").length,
    criticalRisks: risks.filter((r) => (r.probability * r.impact) >= 15).length,
    overdueAudits: audits.filter((a) => a.status !== "abgeschlossen" && overdue(a.scheduledFor)).length,
    docsToApprove: docs.filter((d) => d.status === "pruefung").length,
    expiringTrainings: trainings.filter((t) => t.status !== "abgelaufen" && expiring(t.expiresAt)).length,
    suppliersActive: suppliers.filter((s) => s.approved).length,
    docsExpiring: docs.filter((d) => expiring(d.validUntil)).length,
  };
}

export function ecqmTrafficLight(): "gruen" | "gelb" | "rot" {
  const k = ecqmKpis();
  if (k.overdueCapas > 0 || k.criticalRisks > 2 || k.overdueAudits > 0) return "rot";
  if (k.openCapas > 5 || k.openComplaints > 3 || k.docsToApprove > 3) return "gelb";
  return "gruen";
}
