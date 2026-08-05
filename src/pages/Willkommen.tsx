import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { useWorkspace, type Workspace, type WorkspaceNavEntry } from '@/contexts/WorkspaceContext';
import { useTopPages } from '@/hooks/usePageUsage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, ArrowRight, Building2, LayoutGrid, Zap } from 'lucide-react';

/**
 * Startseite nach dem Login:
 * Mandant + Abteilung (Workspace) per Dropdown wählen.
 * Es werden ALLE Einträge angezeigt – nicht freigegebene sind gesperrt.
 */
export default function Willkommen() {
  const navigate = useNavigate();
  const { profile, roles } = useAuth() as any;
  const { tenants, allowedTenants, setCurrent: setTenant, loading: tLoading } = useTenant();
  const {
    workspaces: allowedWorkspaces,
    setCurrent: setWorkspace,
    setWorkspaceMode,
    loading: wLoading,
  } = useWorkspace();
  const { pages: topPages, loading: topLoading } = useTopPages(20);

  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [allNav, setAllNav] = useState<WorkspaceNavEntry[]>([]);
  const [tenantCode, setTenantCode] = useState<string>('');
  const [wsCode, setWsCode] = useState<string>('');

  useEffect(() => {
    document.title = 'Startseite — Alix Work';
    (async () => {
      const [{ data: ws }, { data: nav }] = await Promise.all([
        supabase.from('workspaces' as any).select('*').eq('is_active', true).order('sort_order'),
        supabase.from('workspace_nav_items' as any).select('*').eq('is_active', true),
      ]);
      setAllWorkspaces(((ws as any) || []) as Workspace[]);
      setAllNav(((nav as any) || []) as WorkspaceNavEntry[]);
    })();
  }, []);


  const allowedTenantCodes = useMemo(
    () => new Set(allowedTenants.map((t) => t.code)),
    [allowedTenants],
  );
  const allowedWsIds = useMemo(
    () => new Set(allowedWorkspaces.map((w) => w.id)),
    [allowedWorkspaces],
  );

  useEffect(() => {
    if (!tenantCode && allowedTenants.length) setTenantCode(allowedTenants[0].code);
  }, [allowedTenants, tenantCode]);

  useEffect(() => {
    if (!wsCode && allowedWorkspaces.length) setWsCode(allowedWorkspaces[0].code);
  }, [allowedWorkspaces, wsCode]);

  const selectedTenant = tenants.find((t) => t.code === tenantCode) || null;
  const selectedWs = allWorkspaces.find((w) => w.code === wsCode) || null;

  const tenantOk = !!selectedTenant && allowedTenantCodes.has(selectedTenant.code);
  const wsOk = !!selectedWs && allowedWsIds.has(selectedWs.id);
  const canEnter = tenantOk && wsOk;

  const enter = () => {
    if (!canEnter || !selectedTenant || !selectedWs) return;
    setTenant(selectedTenant);
    setWorkspace(selectedWs);
    setWorkspaceMode(true);
    navigate(selectedWs.dashboard_path || `/w/${selectedWs.code}`, { replace: true });
  };

  const loading = tLoading || wLoading;

  const isSuper = Array.isArray(roles) && roles.includes('Super Admin');

  // Schnellzugriff: 20 meistgenutzte Menüpunkte über ALLE Workspaces,
  // gefiltert auf erlaubte Workspaces und Rollen.
  const quickAccess = useMemo(() => {
    const wsById = new Map(allWorkspaces.map((w) => [w.id, w]));
    const navByPath = new Map<string, WorkspaceNavEntry>();
    for (const n of allNav) if (!navByPath.has(n.path)) navByPath.set(n.path, n);

    return topPages
      .map((p) => {
        const nav = navByPath.get(p.path);
        const ws = nav ? wsById.get(nav.workspace_id) : undefined;
        return { ...p, nav, ws };
      })
      .filter(({ nav, ws }) => {
        if (!nav || !ws) return false;                       // nur echte Menüpunkte
        if (!allowedWsIds.has(ws.id)) return false;          // Workspace freigegeben?
        if (!nav.roles || nav.roles.length === 0) return true;
        if (isSuper) return true;
        return (roles || []).some((r: string) => nav.roles!.includes(r));
      })
      .slice(0, 20);
  }, [topPages, allNav, allWorkspaces, allowedWsIds, roles, isSuper]);

  const openQuick = (path: string, wsId: string) => {
    const ws = allWorkspaces.find((w) => w.id === wsId);
    if (ws) { setWorkspace(ws); setWorkspaceMode(true); }
    navigate(path);
  };

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 py-10">
      <Card className="w-full max-w-2xl card-glow animate-fade-in">

        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-light tracking-wide">
            Willkommen{profile?.full_name ? `, ${profile.full_name}` : ''}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Mandant und Abteilung wählen, um in den Arbeitsbereich zu wechseln.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> Mandant
            </label>
            <select
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value)}
              disabled={loading}
              className="w-full h-11 rounded-md border border-border bg-background px-3 text-sm"
            >
              {tenants.map((t) => {
                const ok = allowedTenantCodes.has(t.code);
                return (
                  <option key={t.id} value={t.code}>
                    {t.flag_emoji ? `${t.flag_emoji} ` : ''}
                    {t.name}
                    {ok ? '' : '  (kein Zugriff)'}
                  </option>
                );
              })}
            </select>
            {!tenantOk && selectedTenant && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Lock className="h-3 w-3" /> Für diesen Mandanten fehlt Ihnen die Berechtigung.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <LayoutGrid className="h-3.5 w-3.5" /> Abteilung
            </label>
            <select
              value={wsCode}
              onChange={(e) => setWsCode(e.target.value)}
              disabled={loading}
              className="w-full h-11 rounded-md border border-border bg-background px-3 text-sm"
            >
              {allWorkspaces.map((w) => {
                const ok = allowedWsIds.has(w.id);
                return (
                  <option key={w.id} value={w.code}>
                    {w.emoji ? `${w.emoji} ` : ''}
                    {w.name}
                    {ok ? '' : '  (kein Zugriff)'}
                  </option>
                );
              })}
            </select>
            {!wsOk && selectedWs && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Lock className="h-3 w-3" /> Für diese Abteilung fehlt Ihnen die Berechtigung.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{allowedTenants.length} / {tenants.length} Mandanten</Badge>
              <Badge variant="outline">
                {allowedWorkspaces.length} / {allWorkspaces.length} Abteilungen
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                Klassische Ansicht
              </Button>
              <Button onClick={enter} disabled={!canEnter}>
                Weiter <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full max-w-2xl animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Schnellzugriff
            <span className="text-xs font-normal text-muted-foreground">
              Ihre 20 meistgenutzten Menüpunkte (alle Abteilungen)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topLoading ? (
            <p className="text-xs text-muted-foreground">Wird berechnet …</p>
          ) : quickAccess.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Noch keine Nutzungsdaten – der Schnellzugriff füllt sich automatisch, sobald Sie
              Menüpunkte öffnen.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {quickAccess.map((q) => (
                <button
                  key={q.path}
                  onClick={() => openQuick(q.path, q.ws!.id)}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                >
                  <span className="truncate">
                    {q.nav!.label}
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {q.ws!.name}
                    </span>
                  </span>
                  <Badge variant="secondary" className="shrink-0">{q.hits}×</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>

  );
}
