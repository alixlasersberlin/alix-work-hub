import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type TopPage = {
  path: string;
  label: string | null;
  workspace_code: string | null;
  hits: number;
  last_at: string;
};

/** Zählt Menü-/Seitenaufrufe pro Benutzer in Supabase und liefert die Top-Seiten. */
export function usePageUsageTracker() {
  const { user } = useAuth();
  return useCallback((path: string, label?: string, workspaceCode?: string | null) => {
    if (!user || !path || path === '/' || path === '/willkommen') return;
    void supabase.rpc('page_usage_track' as any, {
      _path: path,
      _label: label ?? null,
      _workspace_code: workspaceCode ?? null,
    });
  }, [user?.id]);
}

export function useTopPages(limit = 20) {
  const { user } = useAuth();
  const [pages, setPages] = useState<TopPage[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setPages([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.rpc('page_usage_top' as any, { _limit: limit });
    setPages(((data as any) || []) as TopPage[]);
    setLoading(false);
  }, [user?.id, limit]);

  useEffect(() => { void reload(); }, [reload]);

  return { pages, loading, reload };
}
