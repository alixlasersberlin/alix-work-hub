/**
 * Offline-Outbox für ALIX CONNECT (Unified Inbox).
 * Speichert ausgehende Antworten & interne Notizen in IndexedDB und
 * versendet sie automatisch, sobald das Gerät wieder online ist.
 */
import { openDB, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'alix-connect-outbox';
const DB_VERSION = 1;
const STORE = 'outbox';

export interface AcOutboxItem {
  id?: number;
  conversation_id: string;
  body: string;
  internal_note: boolean;
  created_at: number;
  attempts: number;
  last_error?: string;
  next_retry_at?: number;
}

export const MAX_ATTEMPTS = 8;
function backoffMs(attempts: number): number {
  return Math.min(600_000, 5_000 * Math.pow(2, Math.max(0, attempts - 1)));
}

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueue(item: Omit<AcOutboxItem, 'id' | 'created_at' | 'attempts'>) {
  const db = await getDb();
  const id = await db.add(STORE, { ...item, created_at: Date.now(), attempts: 0 });
  notify();
  return id;
}

export async function list(): Promise<AcOutboxItem[]> {
  const db = await getDb();
  return (await db.getAll(STORE)) as AcOutboxItem[];
}

export async function remove(id: number) {
  const db = await getDb();
  await db.delete(STORE, id);
  notify();
}

export async function updateAttempt(id: number, err?: string) {
  const db = await getDb();
  const cur = (await db.get(STORE, id)) as AcOutboxItem | undefined;
  if (!cur) return;
  cur.attempts = (cur.attempts || 0) + 1;
  cur.last_error = err;
  cur.next_retry_at = Date.now() + backoffMs(cur.attempts);
  await db.put(STORE, cur);
  notify();
}

export async function retryNow(id: number) {
  const db = await getDb();
  const cur = (await db.get(STORE, id)) as AcOutboxItem | undefined;
  if (!cur) return;
  cur.next_retry_at = 0;
  cur.attempts = Math.min(cur.attempts, MAX_ATTEMPTS - 1);
  cur.last_error = undefined;
  await db.put(STORE, cur);
  notify();
}

async function processOne(item: AcOutboxItem) {
  const { data, error } = await supabase.functions.invoke('ac-send-message', {
    body: {
      conversation_id: item.conversation_id,
      body: item.body,
      internal_note: item.internal_note,
    },
  });
  if (error) throw error;
  if (data && (data as any).ok === false) {
    throw new Error((data as any).error || 'Provider-Fehler');
  }
}

let flushing = false;
export async function flush(): Promise<{ ok: number; failed: number; deferred: number }> {
  if (flushing) return { ok: 0, failed: 0, deferred: 0 };
  flushing = true;
  try {
    const items = await list();
    const now = Date.now();
    let ok = 0, failed = 0, deferred = 0;
    for (const it of items) {
      if (it.attempts >= MAX_ATTEMPTS) { deferred++; continue; }
      if (it.next_retry_at && it.next_retry_at > now) { deferred++; continue; }
      try {
        await processOne(it);
        if (it.id != null) await remove(it.id);
        ok++;
      } catch (err: any) {
        failed++;
        if (it.id != null) await updateAttempt(it.id, err?.message || String(err));
      }
    }
    return { ok, failed, deferred };
  } finally {
    flushing = false;
  }
}

// --- Listeners ---
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach((l) => { try { l(); } catch {} }); }
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

let started = false;
export function startAutoSync() {
  if (started) return;
  started = true;
  const trigger = () => { if (navigator.onLine) flush().catch(() => {}); };
  window.addEventListener('online', trigger);
  window.addEventListener('focus', trigger);
  setInterval(trigger, 30_000);
  trigger();
}
