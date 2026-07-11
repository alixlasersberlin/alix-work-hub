// Generic Supabase-backed key-value store for ESC (Teamkalender).
// One table per store, row shape: { id text, data jsonb, updated_at }.
// All authenticated users share the same data; Realtime pushes changes to every open session.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type EscStoreTable =
  | 'esc_store_appointments'
  | 'esc_store_departments'
  | 'esc_store_employees'
  | 'esc_store_rm_employees'
  | 'esc_store_rm_vehicles'
  | 'esc_store_rm_rooms'
  | 'esc_store_rm_demo_devices'
  | 'esc_store_rm_absences'
  | 'esc_store_rm_maintenance'
  | 'esc_store_rm_locations'
  | 'esc_store_rm_qualifications';

interface StoreState<T> {
  items: Map<string, T>;
  loaded: boolean;
}

interface StoreInternals<T> {
  table: EscStoreTable;
  getId: (item: T) => string;
  seed?: T[];
  legacyLsKeys?: string[];
  state: StoreState<T>;
  listeners: Set<() => void>;
  channelStarted: boolean;
  initPromise: Promise<void> | null;
}

const registry = new Map<string, StoreInternals<any>>();

function getStore<T>(opts: {
  table: EscStoreTable;
  getId: (item: T) => string;
  seed?: T[];
  legacyLsKeys?: string[];
}): StoreInternals<T> {
  const existing = registry.get(opts.table) as StoreInternals<T> | undefined;
  if (existing) return existing;
  const s: StoreInternals<T> = {
    table: opts.table,
    getId: opts.getId,
    seed: opts.seed,
    legacyLsKeys: opts.legacyLsKeys,
    state: { items: new Map(), loaded: false },
    listeners: new Set(),
    channelStarted: false,
    initPromise: null,
  };
  registry.set(opts.table, s);
  return s;
}

const notify = <T>(s: StoreInternals<T>) => s.listeners.forEach((l) => l());

async function migrateLegacy<T>(s: StoreInternals<T>): Promise<T[]> {
  const migrated: T[] = [];
  const flagKey = `esc.migrated.${s.table}.v1`;
  if (typeof window === 'undefined') return migrated;
  if (localStorage.getItem(flagKey)) return migrated;
  try {
    for (const key of s.legacyLsKeys ?? []) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) migrated.push(...parsed);
    }
  } catch {}
  if (migrated.length) {
    const rows = migrated.map((it) => ({ id: s.getId(it), data: it as any }));
    await supabase.from(s.table).upsert(rows, { onConflict: 'id' });
  }
  localStorage.setItem(flagKey, '1');
  // Clean up legacy keys after successful migration
  for (const key of s.legacyLsKeys ?? []) {
    try { localStorage.removeItem(key); } catch {}
  }
  return migrated;
}

async function seedIfEmpty<T>(s: StoreInternals<T>) {
  if (!s.seed?.length) return;
  const { count } = await supabase.from(s.table).select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;
  const rows = s.seed.map((it) => ({ id: s.getId(it), data: it as any }));
  await supabase.from(s.table).upsert(rows, { onConflict: 'id' });
}

async function initStore<T>(s: StoreInternals<T>): Promise<void> {
  if (s.initPromise) return s.initPromise;
  s.initPromise = (async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        // Not authenticated yet – populate from seed for read-only UX and bail.
        if (s.seed) for (const it of s.seed) s.state.items.set(s.getId(it), it);
        s.state.loaded = true;
        notify(s);
        return;
      }
      await migrateLegacy(s);
      await seedIfEmpty(s);
      const { data, error } = await supabase.from(s.table).select('id,data');
      if (!error && data) {
        s.state.items.clear();
        for (const row of data as any[]) s.state.items.set(row.id, row.data as T);
      }
      s.state.loaded = true;
      notify(s);
      startRealtime(s);
    } catch (err) {
      console.error('[esc-store] init failed', s.table, err);
      s.state.loaded = true;
      notify(s);
    }
  })();
  return s.initPromise;
}

function startRealtime<T>(s: StoreInternals<T>) {
  if (s.channelStarted) return;
  s.channelStarted = true;
  supabase
    .channel(`esc-store-${s.table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: s.table }, (payload: any) => {
      if (payload.eventType === 'DELETE') {
        s.state.items.delete(payload.old?.id);
      } else {
        const row = payload.new;
        if (row?.id) s.state.items.set(row.id, row.data as T);
      }
      notify(s);
    })
    .subscribe();
}

export function useEscStore<T>(opts: {
  table: EscStoreTable;
  getId: (item: T) => string;
  seed?: T[];
  legacyLsKeys?: string[];
}) {
  const s = getStore<T>(opts);
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    s.listeners.add(l);
    void initStore(s);
    return () => { s.listeners.delete(l); };
  }, [s]);

  const items = Array.from(s.state.items.values());

  const upsert = async (item: T) => {
    const id = s.getId(item);
    s.state.items.set(id, item);
    notify(s);
    const { error } = await supabase.from(s.table).upsert({ id, data: item as any }, { onConflict: 'id' });
    if (error) console.error('[esc-store] upsert', s.table, error);
    return item;
  };

  const remove = async (id: string) => {
    s.state.items.delete(id);
    notify(s);
    const { error } = await supabase.from(s.table).delete().eq('id', id);
    if (error) console.error('[esc-store] delete', s.table, error);
  };

  return { items, loaded: s.state.loaded, upsert, remove };
}
