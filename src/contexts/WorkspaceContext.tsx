import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { classicNavForWorkspace, WORKSPACE_CLASSIC_GROUPS } from '@/lib/workspace/classicNav';

export interface Workspace {
  id: string;
  code: string;
  name: string;
  icon: string;
  emoji: string | null;
  dashboard_path: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface WorkspaceNavEntry {
  id: string;
  workspace_id: string;
  label: string;
  path: string;
  icon: string;
  section: string | null;
  roles: string[] | null;
  tenant_codes: string[] | null;
  sort_order: number;
  is_active: boolean;
  /** Direkt gesetzte Lucide-Komponente (bei Übernahme aus dem klassischen Menü) */
  IconComp?: React.ComponentType<{ className?: string }>;
}


interface WorkspaceContextType {
  workspaces: Workspace[];        // erlaubte, aktive Workspaces
  navItems: WorkspaceNavEntry[];  // Navigation des aktiven Workspaces (rollen-gefiltert)
  current: Workspace | null;
  setCurrent: (w: Workspace | null) => void;
  workspaceMode: boolean;         // true = Sidebar zeigt nur Workspace-Navigation
  setWorkspaceMode: (v: boolean) => void;
  loading: boolean;
  reload: () => void;
}

const WS_KEY = 'alixwork.currentWorkspaceCode';
const MODE_KEY = 'alixwork.workspaceMode';

const Ctx = createContext<WorkspaceContextType>({
  workspaces: [], navItems: [], current: null, setCurrent: () => {},
  workspaceMode: false, setWorkspaceMode: () => {}, loading: true, reload: () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, roles, isAdmin } = useAuth();
  const [all, setAll] = useState<Workspace[]>([]);
  const [nav, setNav] = useState<WorkspaceNavEntry[]>([]);
  const [accessIds, setAccessIds] = useState<string[] | null>(null);
  const [current, setCurrentState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [workspaceMode, setModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(MODE_KEY) === '1';
  });

  const isSuper = Array.isArray(roles) && roles.includes('Super Admin');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: ws }, { data: items }] = await Promise.all([
        supabase.from('workspaces' as any).select('*').eq('is_active', true).order('sort_order'),
        supabase.from('workspace_nav_items' as any).select('*').eq('is_active', true).order('sort_order'),
      ]);
      if (cancelled) return;
      setAll(((ws as any) || []) as Workspace[]);
      setNav(((items as any) || []) as WorkspaceNavEntry[]);
      if (user) {
        const { data: uwa } = await supabase
          .from('user_workspace_access' as any)
          .select('workspace_id')
          .eq('user_id', user.id);
        if (!cancelled) setAccessIds(((uwa as any) || []).map((r: any) => r.workspace_id));
      } else if (!cancelled) {
        setAccessIds([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, tick]);

  const workspaces = useMemo(() => {
    if (isSuper || isAdmin) return all;
    if (!accessIds || accessIds.length === 0) return all; // keine Einschränkung hinterlegt
    return all.filter(w => accessIds.includes(w.id));
  }, [all, accessIds, isSuper, isAdmin]);

  useEffect(() => {
    if (loading) return;
    let code: string | null = null;
    try { code = localStorage.getItem(WS_KEY); } catch { /* ignore */ }
    const found = code ? workspaces.find(w => w.code === code) : null;
    setCurrentState(found || workspaces[0] || null);
  }, [loading, workspaces]);

  const setCurrent = useCallback((w: Workspace | null) => {
    setCurrentState(w);
    try {
      if (w) localStorage.setItem(WS_KEY, w.code);
      else localStorage.removeItem(WS_KEY);
    } catch { /* Storage evtl. blockiert */ }
  }, []);

  const setWorkspaceMode = useCallback((v: boolean) => {
    setModeState(v);
    try { localStorage.setItem(MODE_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const navItems = useMemo(() => {
    if (!current) return [];
    // 1) Menü aus der klassischen Ansicht (rollen-gefiltert)
    const classic = WORKSPACE_CLASSIC_GROUPS[current.code]
      ? classicNavForWorkspace(current.code, current.id, roles || [], isSuper)
      : [];
    // 2) Zusätzlich in der DB gepflegte Einträge (ohne Dubletten)
    const known = new Set(classic.map(c => c.path));
    const custom = nav
      .filter(n => n.workspace_id === current.id)
      .filter(n => !known.has(n.path))
      .filter(n => {
        if (!n.roles || n.roles.length === 0) return true;
        if (isSuper) return true;
        return (roles || []).some((r: string) => n.roles!.includes(r));
      });
    return [...classic, ...custom];
  }, [nav, current, roles, isSuper]);

  return (
    <Ctx.Provider value={{
      workspaces, navItems, current, setCurrent, workspaceMode, setWorkspaceMode,
      loading, reload: () => setTick(t => t + 1),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() {
  return useContext(Ctx);
}
