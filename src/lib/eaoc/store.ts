import type { EaocRecord, EaocSectionKey, EaocAuditEntry, EaocMaintenance } from "./types";

const NS = "eaoc:v1";
const key = (k: string) => `${NS}:${k}`;

function read<T>(k: string, fallback: T): T {
  try { const raw = localStorage.getItem(key(k)); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
function write<T>(k: string, v: T) { try { localStorage.setItem(key(k), JSON.stringify(v)); } catch {} }

export const eaoc = {
  tenant: {
    current(): string { return read<string>("tenant:current", "ABLM Management GmbH"); },
    set(t: string) { write("tenant:current", t); },
    list(): string[] {
      const cs = eaoc.list("tenants");
      const names = cs.map(c => String(c.name ?? "")).filter(Boolean);
      return names.length ? names : ["ABLM Management GmbH", "BeautyTec Holding", "Alix Lasers GmbH", "Alix Medical GmbH", "Medi Metropole GmbH"];
    },
  },

  list<T extends EaocRecord = EaocRecord>(section: EaocSectionKey | string): T[] {
    return read<T[]>(`data:${section}`, []);
  },
  save<T extends EaocRecord = EaocRecord>(section: EaocSectionKey | string, rows: T[]) {
    write(`data:${section}`, rows);
  },
  upsert<T extends EaocRecord = EaocRecord>(section: EaocSectionKey | string, row: Partial<T> & { id?: string }): T {
    const rows = eaoc.list<T>(section);
    const now = new Date().toISOString();
    const tenant = eaoc.tenant.current();
    if (row.id) {
      const idx = rows.findIndex(r => r.id === row.id);
      if (idx >= 0) {
        const before = rows[idx];
        const next = { ...before, ...row, updatedAt: now } as T;
        rows[idx] = next;
        eaoc.save(section, rows);
        eaoc.audit.log({ action: "update", section, entityId: next.id, before, after: next });
        return next;
      }
    }
    const created = {
      ...(row as any),
      id: row.id ?? `${section}_${Math.random().toString(36).slice(2, 10)}`,
      tenant: (row as any).tenant ?? tenant,
      createdAt: now,
      updatedAt: now,
    } as T;
    rows.unshift(created);
    eaoc.save(section, rows);
    eaoc.audit.log({ action: "create", section, entityId: created.id, after: created });
    return created;
  },
  remove(section: EaocSectionKey | string, id: string) {
    const rows = eaoc.list(section);
    const before = rows.find(r => r.id === id);
    eaoc.save(section, rows.filter(r => r.id !== id));
    eaoc.audit.log({ action: "delete", section, entityId: id, before });
  },

  audit: {
    log(entry: Omit<EaocAuditEntry, "id" | "ts" | "user" | "ip">) {
      const rows = read<EaocAuditEntry[]>("audit", []);
      const e: EaocAuditEntry = {
        id: `a_${Math.random().toString(36).slice(2, 10)}`,
        ts: new Date().toISOString(),
        user: read<string>("session:user", "admin@alixworks"),
        ip: "127.0.0.1",
        ...entry,
      };
      rows.unshift(e);
      write("audit", rows.slice(0, 2000));
    },
    list(): EaocAuditEntry[] { return read<EaocAuditEntry[]>("audit", []); },
    clear() { write("audit", []); },
  },

  maintenance: {
    get(): EaocMaintenance { return read<EaocMaintenance>("maintenance", { active: false, message: "" }); },
    set(m: EaocMaintenance) { write("maintenance", m); eaoc.audit.log({ action: "maintenance:update", section: "system_settings", after: m }); },
  },

  settings: {
    get<T = any>(k: string, fallback: T): T { return read<T>(`settings:${k}`, fallback); },
    set<T = any>(k: string, v: T) { write(`settings:${k}`, v); eaoc.audit.log({ action: "settings:update", section: "system_settings", entityId: k, after: v }); },
  },
};
