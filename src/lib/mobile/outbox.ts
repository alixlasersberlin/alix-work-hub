/**
 * Offline-Outbox via IndexedDB für die Mobile Techniker-App.
 * Speichert ausstehende Mutationen (Foto-Upload, Signatur, Checklist-Antwort),
 * solange das Gerät offline ist, und versendet sie sobald wieder online.
 */
import { openDB, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'alixwork-mobile';
const DB_VERSION = 1;
const STORE = 'outbox';

export type OutboxKind =
  | 'photo'
  | 'signature'
  | 'checklist_run'
  | 'route_status';

export interface OutboxItem {
  id?: number;
  kind: OutboxKind;
  payload: any;
  blob?: Blob;
  blob_path?: string;
  created_at: number;
  attempts: number;
  last_error?: string;
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

export async function enqueue(item: Omit<OutboxItem, 'id' | 'created_at' | 'attempts'>) {
  const db = await getDb();
  await db.add(STORE, { ...item, created_at: Date.now(), attempts: 0 });
}

export async function list(): Promise<OutboxItem[]> {
  const db = await getDb();
  return (await db.getAll(STORE)) as OutboxItem[];
}

export async function remove(id: number) {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function updateAttempt(id: number, err?: string) {
  const db = await getDb();
  const cur = (await db.get(STORE, id)) as OutboxItem | undefined;
  if (!cur) return;
  cur.attempts = (cur.attempts || 0) + 1;
  cur.last_error = err;
  await db.put(STORE, cur);
}

async function processOne(item: OutboxItem) {
  if (item.kind === 'photo' && item.blob && item.blob_path) {
    const up = await supabase.storage.from('dispatch-mobile').upload(item.blob_path, item.blob, {
      upsert: true, contentType: item.blob.type || 'image/jpeg',
    });
    if (up.error) throw up.error;
    const { error } = await supabase.from('dispatch_attachments').insert({
      ...item.payload,
      storage_path: item.blob_path,
    });
    if (error) throw error;
    return;
  }
  if (item.kind === 'signature' && item.blob && item.blob_path) {
    const up = await supabase.storage.from('dispatch-mobile').upload(item.blob_path, item.blob, {
      upsert: true, contentType: 'image/png',
    });
    if (up.error) throw up.error;
    const { error } = await supabase.from('dispatch_signatures').insert({
      ...item.payload,
      storage_path: item.blob_path,
    });
    if (error) throw error;
    return;
  }
  if (item.kind === 'checklist_run') {
    const { error } = await supabase.from('dispatch_checklist_runs').upsert(item.payload);
    if (error) throw error;
    return;
  }
  if (item.kind === 'route_status') {
    const { id, ...patch } = item.payload;
    const { error } = await supabase.from('route_plans').update(patch).eq('id', id);
    if (error) throw error;
    return;
  }
  throw new Error('Unbekannter Outbox-Typ');
}

export async function flush(): Promise<{ ok: number; failed: number }> {
  const items = await list();
  let ok = 0, failed = 0;
  for (const it of items) {
    try {
      await processOne(it);
      if (it.id != null) await remove(it.id);
      ok++;
    } catch (err: any) {
      failed++;
      if (it.id != null) await updateAttempt(it.id, err?.message || String(err));
    }
  }
  return { ok, failed };
}

let listening = false;
export function startAutoSync() {
  if (listening) return;
  listening = true;
  const trigger = () => { if (navigator.onLine) flush().catch(() => {}); };
  window.addEventListener('online', trigger);
  setInterval(trigger, 30_000);
  trigger();
}
