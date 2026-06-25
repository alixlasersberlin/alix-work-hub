import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Abonniert Postgres-Changes (INSERT/UPDATE/DELETE) auf den angegebenen
 * Tabellen im public-Schema und ruft `onChange` debounced auf.
 *
 * Damit lassen sich Dashboards in "Livetime" halten: sobald sich eine
 * relevante Quelltabelle ändert, wird die Daten-Ladefunktion neu ausgeführt.
 *
 * Voraussetzung: Die Tabellen müssen in der `supabase_realtime` Publication
 * eingetragen sein (siehe Migration).
 */
export function useRealtimeRefresh(
  tables: string[],
  onChange: () => void,
  options: { debounceMs?: number; enabled?: boolean } = {},
) {
  const { debounceMs = 800, enabled = true } = options;
  // Stable ref to the latest callback, so re-subscribing isn't triggered
  // every render just because the function identity changed.
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try { cbRef.current(); } catch { /* ignore */ }
      }, debounceMs);
    };

    const channelName = `rt-refresh:${tables.slice().sort().join(',')}:${Math.random().toString(36).slice(2, 8)}`;
    let channel = supabase.channel(channelName);
    for (const table of tables) {
      channel = (channel as any).on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        trigger,
      );
    }
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debounceMs, tables.join('|')]);
}
