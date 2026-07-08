// EIG – Enterprise Integration Gateway
export type EigRecord = { id: string; createdAt: string; updatedAt: string; tenant: string; [k: string]: any };

const NS = "eig:v1";
const key = (k: string) => `${NS}:${k}`;
function read<T>(k: string, fb: T): T { try { const r = localStorage.getItem(key(k)); return r ? JSON.parse(r) as T : fb; } catch { return fb; } }
function write<T>(k: string, v: T) { try { localStorage.setItem(key(k), JSON.stringify(v)); } catch {} }

export interface EigAudit { id: string; ts: string; user: string; action: string; section: string; entityId?: string; before?: any; after?: any; }
export interface EigLog { id: string; ts: string; level: "info" | "warn" | "error"; source: string; message: string; meta?: any; }
export interface EigEventEntry { id: string; ts: string; event: string; module: string; payload?: any; status: "delivered" | "failed" | "queued"; latencyMs: number; }

export const eig = {
  tenant: {
    current(): string { return read<string>("tenant:current", "ABLM Management GmbH"); },
    set(t: string) { write("tenant:current", t); },
    list(): string[] { return ["ABLM Management GmbH", "Alix Lasers GmbH", "Alix Medical GmbH", "Medi Metropole GmbH"]; },
  },
  list<T extends EigRecord = EigRecord>(section: string): T[] { return read<T[]>(`data:${section}`, []); },
  save<T extends EigRecord = EigRecord>(section: string, rows: T[]) { write(`data:${section}`, rows); },
  upsert<T extends EigRecord = EigRecord>(section: string, row: Partial<T> & { id?: string }): T {
    const rows = eig.list<T>(section); const now = new Date().toISOString();
    if (row.id) {
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx >= 0) { const before = rows[idx]; const next = { ...before, ...row, updatedAt: now } as T; rows[idx] = next; eig.save(section, rows); eig.audit.log({ action: "update", section, entityId: next.id, before, after: next }); return next; }
    }
    const created = { ...(row as any), id: row.id ?? `${section}_${Math.random().toString(36).slice(2, 10)}`, tenant: (row as any).tenant ?? eig.tenant.current(), createdAt: now, updatedAt: now } as T;
    rows.unshift(created); eig.save(section, rows); eig.audit.log({ action: "create", section, entityId: created.id, after: created }); return created;
  },
  remove(section: string, id: string) { const rows = eig.list(section); const before = rows.find(r => r.id === id); eig.save(section, rows.filter(r => r.id !== id)); eig.audit.log({ action: "delete", section, entityId: id, before }); },

  audit: {
    log(e: Omit<EigAudit, "id" | "ts" | "user">) { const rows = read<EigAudit[]>("audit", []); rows.unshift({ id: `a_${Math.random().toString(36).slice(2, 10)}`, ts: new Date().toISOString(), user: "admin@alixworks", ...e }); write("audit", rows.slice(0, 2000)); },
    list(): EigAudit[] { return read<EigAudit[]>("audit", []); },
  },
  logs: {
    add(l: Omit<EigLog, "id" | "ts">) { const rows = read<EigLog[]>("logs", []); rows.unshift({ id: `l_${Math.random().toString(36).slice(2, 10)}`, ts: new Date().toISOString(), ...l }); write("logs", rows.slice(0, 2000)); },
    list(): EigLog[] { return read<EigLog[]>("logs", []); },
  },
  events: {
    emit(e: Omit<EigEventEntry, "id" | "ts">) { const rows = read<EigEventEntry[]>("events:history", []); rows.unshift({ id: `e_${Math.random().toString(36).slice(2, 10)}`, ts: new Date().toISOString(), ...e }); write("events:history", rows.slice(0, 2000)); },
    list(): EigEventEntry[] { return read<EigEventEntry[]>("events:history", []); },
  },
};
