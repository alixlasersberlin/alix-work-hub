import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PH_CHANNELS, PH_ACTIVE_FIELD } from './config';

const db = supabase as any;

export interface PhChannel {
  id?: string;
  code: string;
  label: string;
  short: string;
  base_url: string | null;
  is_active: boolean;
  sort_order: number;
  builtin: boolean;
}

/** Webseiten aus ph_channels (Standard-Webseiten + selbst angelegte). */
export function usePhChannels(includeInactive = true) {
  const [channels, setChannels] = useState<PhChannel[]>(
    PH_CHANNELS.map((c, i) => ({ code: c.code, label: c.label, short: c.short, base_url: null, is_active: true, sort_order: i + 1, builtin: true })),
  );
  const load = useCallback(async () => {
    const { data } = await db.from('ph_channels').select('*').order('sort_order').order('name');
    if (!data) return;
    setChannels((data as any[]).map(r => ({
      id: r.id, code: r.code, label: r.name, short: String(r.code).toUpperCase(),
      base_url: r.base_url, is_active: r.is_active, sort_order: r.sort_order,
      builtin: !!PH_ACTIVE_FIELD[r.code],
    })));
  }, []);
  useEffect(() => { load(); }, [load]);
  // Standard-Webseiten bleiben immer sichtbar (bisheriges Verhalten), eigene nur wenn aktiv
  const list = includeInactive ? channels : channels.filter(c => c.builtin || c.is_active);
  return { channels: list, all: channels, reload: load };
}

/** Ist ein Gerät auf einer Webseite aktiv? Standard-Webseiten: Spalte active_*, eigene: Kanalzeile. */
export function phIsActiveOn(product: any, code: string, row?: any) {
  const f = PH_ACTIVE_FIELD[code];
  if (f) return !!product?.[f];
  return !!row && row.status !== 'inactive';
}
