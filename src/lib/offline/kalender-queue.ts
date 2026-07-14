import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

/**
 * Offline-Aktionsqueue für den Mobile-Kalender.
 * Persistiert in IndexedDB (Store: kalender-actions).
 * Wird bei online-Event automatisch abgearbeitet.
 */

const DB_NAME = 'alixwork-mobile-kalender';
const DB_VERSION = 1;
const STORE = 'actions';

export type QueuedAction =
  | { kind: 'status'; event_id: string; status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled' }
  | { kind: 'note'; event_id: string; note: string };

export interface QueueEntry {
  id?: number;
  action: QueuedAction;
  enqueued_at: string;
  attempts: number;
  last_error?: string | null;
}

let _dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return _dbPromise;
}

export async function enqueueAction(action: QueuedAction): Promise<number> {
  const d = await db();
  const entry: QueueEntry = { action, enqueued_at: new Date().toISOString(), attempts: 0 };
  const id = await d.add(STORE, entry as any);
  notify();
  return id as number;
}

export async function listQueue(): Promise<QueueEntry[]> {
  const d = await db();
  return (await d.getAll(STORE)) as QueueEntry[];
}

export async function countQueue(): Promise<number> {
  const d = await db();
  return await d.count(STORE);
}

export async function clearQueue(): Promise<void> {
  const d = await db();
  await d.clear(STORE);
  notify();
}

async function applyAction(a: QueuedAction): Promise<void> {
  if (a.kind === 'status') {
    const patch: Record<string, any> = { status: a.status };
    if (a.status === 'confirmed') patch.confirmation_status = 'confirmed';
    if (a.status === 'in_progress') patch.actual_start_at = new Date().toISOString();
    if (a.status === 'completed') patch.actual_end_at = new Date().toISOString();
    const { error } = await (supabase as any).from('esc_events').update(patch).eq('id', a.event_id);
    if (error) throw error;
  } else if (a.kind === 'note') {
    const { error } = await (supabase as any).from('esc_events').update({ internal_note: a.note }).eq('id', a.event_id);
    if (error) throw error;
  }
}

let syncing = false;
export async function syncQueue(): Promise<{ ok: number; failed: number }> {
  if (syncing) return { ok: 0, failed: 0 };
  syncing = true;
  let ok = 0, failed = 0;
  try {
    const d = await db();
    const entries = (await d.getAll(STORE)) as QueueEntry[];
    for (const e of entries) {
      try {
        await applyAction(e.action);
        if (e.id != null) await d.delete(STORE, e.id);
        ok++;
      } catch (err: any) {
        failed++;
        if (e.id != null) {
          e.attempts = (e.attempts || 0) + 1;
          e.last_error = err?.message || String(err);
          await d.put(STORE, e as any);
        }
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return { ok, failed };
}

// --- Pub/Sub für React ---
type Listener = () => void;
const listeners = new Set<Listener>();
function notify() { listeners.forEach(l => { try { l(); } catch {} }); }
export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
