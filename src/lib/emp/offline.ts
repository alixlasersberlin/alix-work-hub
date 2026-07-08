// Simple offline outbox using localStorage. Delta-sync-ready.
const KEY = 'emp:outbox:v1';
const CONFLICT_KEY = 'emp:conflicts:v1';

export interface OutboxEntry {
  id: string;
  kind: 'signature' | 'photo' | 'checklist' | 'service_report' | 'time' | 'material' | 'qr' | 'audit';
  createdAt: string;
  payload: unknown;
  synced?: boolean;
  syncedAt?: string;
  conflict?: string;
}

function read(): OutboxEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(entries: OutboxEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function enqueue(entry: Omit<OutboxEntry, 'id' | 'createdAt' | 'synced'>): OutboxEntry {
  const full: OutboxEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    synced: false,
  };
  const all = read();
  all.push(full);
  write(all);
  return full;
}

export function list(): OutboxEntry[] { return read(); }
export function pending(): OutboxEntry[] { return read().filter((e) => !e.synced); }

export async function syncAll(handler?: (e: OutboxEntry) => Promise<boolean>): Promise<{ ok: number; fail: number }> {
  const all = read();
  let ok = 0, fail = 0;
  for (const e of all) {
    if (e.synced) continue;
    try {
      const success = handler ? await handler(e) : navigator.onLine; // default: mark synced when online
      if (success) { e.synced = true; e.syncedAt = new Date().toISOString(); ok++; }
      else { fail++; }
    } catch (err: any) {
      e.conflict = err?.message ?? 'sync_error';
      fail++;
    }
  }
  write(all);
  return { ok, fail };
}

export function clearSynced() {
  write(read().filter((e) => !e.synced));
}

export function conflicts(): OutboxEntry[] {
  return read().filter((e) => e.conflict);
}
