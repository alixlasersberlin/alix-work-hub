import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2, LayoutGrid } from 'lucide-react';

interface Ws { id: string; code: string; name: string; icon: string; emoji: string | null; dashboard_path: string | null; sort_order: number; is_active: boolean; }
interface NavItem { id: string; workspace_id: string; label: string; path: string; icon: string; section: string | null; roles: string[] | null; tenant_codes: string[] | null; sort_order: number; is_active: boolean; }
interface Profile { id: string; full_name: string | null; email: string | null; is_active: boolean | null; }

const csv = (a: string[] | null) => (a && a.length ? a.join(', ') : '');
const parseCsv = (s: string) => {
  const v = s.split(',').map(x => x.trim()).filter(Boolean);
  return v.length ? v : null;
};

export default function WorkspaceAdmin() {
  const { reload } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ws, setWs] = useState<Ws[]>([]);
  const [nav, setNav] = useState<NavItem[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [access, setAccess] = useState<Record<string, string[]>>({}); // userId -> workspaceIds
  const [tenants, setTenants] = useState<{ id: string; code: string; name: string; flag_emoji: string | null }[]>([]);
  const [tenantAccess, setTenantAccess] = useState<Record<string, string[]>>({}); // userId -> tenantIds
  const [activeWs, setActiveWs] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: w }, { data: n }, { data: p }, { data: a }, { data: t }, { data: ta }] = await Promise.all([
      supabase.from('workspaces' as any).select('*').order('sort_order'),
      supabase.from('workspace_nav_items' as any).select('*').order('sort_order'),
      supabase.from('user_profiles').select('id, full_name, email, is_active').order('full_name').limit(1000),
      supabase.from('user_workspace_access' as any).select('user_id, workspace_id').limit(5000),
      supabase.from('tenants' as any).select('id, code, name, flag_emoji').order('code'),
      supabase.from('user_tenant_access' as any).select('user_id, tenant_id').limit(5000),
    ]);
    const wsList = ((w as any) || []) as Ws[];
    setWs(wsList);
    setNav(((n as any) || []) as NavItem[]);
    setUsers(((p as any) || []) as Profile[]);
    setTenants(((t as any) || []) as any);
    const map: Record<string, string[]> = {};
    ((a as any[]) || []).forEach(r => {
      map[r.user_id] = [...(map[r.user_id] || []), r.workspace_id];
    });
    setAccess(map);
    const tmap: Record<string, string[]> = {};
    ((ta as any[]) || []).forEach(r => {
      tmap[r.user_id] = [...(tmap[r.user_id] || []), r.tenant_id];
    });
    setTenantAccess(tmap);
    setActiveWs(prev => prev || wsList[0]?.id || null);
    setLoading(false);
  };


  useEffect(() => { load(); }, []);

  const patchWs = (id: string, patch: Partial<Ws>) =>
    setWs(list => list.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const patchNav = (id: string, patch: Partial<NavItem>) =>
    setNav(list => list.map(x => (x.id === id ? { ...x, ...patch } : x)));

  const saveWs = async (w: Ws) => {
    setSaving(true);
    const { error } = await supabase.from('workspaces' as any).update({
      code: w.code, name: w.name, icon: w.icon, emoji: w.emoji,
      dashboard_path: w.dashboard_path, sort_order: w.sort_order, is_active: w.is_active,
    }).eq('id', w.id);
    setSaving(false);
    if (error) return toast.error('Speichern fehlgeschlagen: ' + error.message);
    toast.success('Workspace gespeichert');
    reload();
  };

  const addWs = async () => {
    const { error } = await supabase.from('workspaces' as any).insert({
      code: 'NEU' + Math.floor(Math.random() * 900 + 100), name: 'Neuer Workspace',
      icon: 'LayoutGrid', sort_order: (ws.at(-1)?.sort_order ?? 0) + 10, is_active: false,
    });
    if (error) return toast.error(error.message);
    toast.success('Workspace angelegt');
    load(); reload();
  };

  const delWs = async (id: string) => {
    if (!confirm('Workspace wirklich löschen?')) return;
    const { error } = await supabase.from('workspaces' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    load(); reload();
  };

  const saveNav = async (n: NavItem) => {
    setSaving(true);
    const { error } = await supabase.from('workspace_nav_items' as any).update({
      label: n.label, path: n.path, icon: n.icon, section: n.section,
      roles: n.roles, tenant_codes: n.tenant_codes, sort_order: n.sort_order, is_active: n.is_active,
    }).eq('id', n.id);
    setSaving(false);
    if (error) return toast.error('Speichern fehlgeschlagen: ' + error.message);
    toast.success('Eintrag gespeichert');
    reload();
  };

  const addNav = async () => {
    if (!activeWs) return;
    const items = nav.filter(n => n.workspace_id === activeWs);
    const { error } = await supabase.from('workspace_nav_items' as any).insert({
      workspace_id: activeWs, label: 'Neuer Eintrag', path: '/', icon: 'Circle',
      sort_order: (items.at(-1)?.sort_order ?? 0) + 10, is_active: true,
    });
    if (error) return toast.error(error.message);
    load(); reload();
  };

  const delNav = async (id: string) => {
    const { error } = await supabase.from('workspace_nav_items' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    load(); reload();
  };

  const toggleAccess = async (userId: string, wsId: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from('user_workspace_access' as any).insert({ user_id: userId, workspace_id: wsId });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('user_workspace_access' as any).delete()
        .eq('user_id', userId).eq('workspace_id', wsId);
      if (error) return toast.error(error.message);
    }
    setAccess(m => {
      const cur = m[userId] || [];
      return { ...m, [userId]: on ? [...cur, wsId] : cur.filter(x => x !== wsId) };
    });
    reload();
  };

  const toggleTenantAccess = async (userId: string, tenantId: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from('user_tenant_access' as any).insert({ user_id: userId, tenant_id: tenantId });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('user_tenant_access' as any).delete()
        .eq('user_id', userId).eq('tenant_id', tenantId);
      if (error) return toast.error(error.message);
    }
    setTenantAccess(m => {
      const cur = m[userId] || [];
      return { ...m, [userId]: on ? [...cur, tenantId] : cur.filter(x => x !== tenantId) };
    });
  };

  // Standardzuweisung: Workspaces anhand der Rollen der Benutzer vorbelegen
  const ROLE_WS: Record<string, string[]> = {
    'Order': ['verkauf', 'lager', 'fertigung'],
    'Auftragsverwaltung': ['verkauf', 'lager'],
    'SACHBEARBEITUNG': ['verkauf'],
    'Vertrieb': ['verkauf'],
    'Österreich': ['verkauf'],
    'After Sales': ['verkauf', 'operation'],
    'Finance': ['buchhaltung'],
    'Buchhaltung EU': ['buchhaltung'],
    'Finanzierungen': ['buchhaltung'],
    'FACTORY INVOICE': ['buchhaltung', 'fertigung'],
    'Tourenplanung': ['lager', 'operation'],
    'Reparaturannahme': ['operation', 'lager'],
    'QM': ['operation'],
  };

  const applyDefaults = async () => {
    if (!confirm('Fehlende Workspace-Zuordnungen anhand der Rollen ergänzen? Bestehende Zuordnungen bleiben erhalten.')) return;
    setSaving(true);
    try {
      const { data: ur, error } = await supabase
        .from('user_roles').select('user_id, roles!inner(name)').limit(5000);
      if (error) throw error;
      const byCode: Record<string, string> = {};
      ws.forEach(w => { byCode[w.code] = w.id; });
      const rows: { user_id: string; workspace_id: string }[] = [];
      const seen = new Set<string>();
      ((ur as any[]) || []).forEach((r: any) => {
        const roleName = r.roles?.name as string | undefined;
        if (!roleName) return;
        (ROLE_WS[roleName] || []).forEach(code => {
          const wsId = byCode[code];
          if (!wsId) return;
          const key = `${r.user_id}|${wsId}`;
          if (seen.has(key)) return;
          if ((access[r.user_id] || []).includes(wsId)) return;
          seen.add(key);
          rows.push({ user_id: r.user_id, workspace_id: wsId });
        });
      });
      if (rows.length === 0) { toast.info('Keine neuen Zuordnungen nötig'); return; }
      const { error: insErr } = await supabase.from('user_workspace_access' as any).insert(rows);
      if (insErr) throw insErr;
      toast.success(`${rows.length} Zuordnungen ergänzt`);
      await load();
      reload();
    } catch (e: any) {
      toast.error('Standardzuweisung fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'));
    } finally {
      setSaving(false);
    }
  };


  const filteredUsers = useMemo(() => {
    const t = userFilter.trim().toLowerCase();
    if (!t) return users;
    return users.filter(u => (u.full_name || '').toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t));
  }, [users, userFilter]);

  const navOfActive = nav.filter(n => n.workspace_id === activeWs);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <LayoutGrid className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Workspace-Verwaltung</h1>
          <p className="text-sm text-muted-foreground">Workspaces, Navigation und Benutzerzuordnung verwalten</p>
        </div>
      </div>

      <Tabs defaultValue="ws">
        <TabsList>
          <TabsTrigger value="ws">Workspaces</TabsTrigger>
          <TabsTrigger value="nav">Navigation</TabsTrigger>
          <TabsTrigger value="users">Workspace-Zugriffe</TabsTrigger>
          <TabsTrigger value="tenants">Mandanten-Zugriffe</TabsTrigger>
        </TabsList>

        <TabsContent value="ws" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button onClick={addWs} size="sm"><Plus className="w-4 h-4 mr-1" />Workspace</Button>
          </div>
          {ws.map(w => (
            <Card key={w.id}>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>{w.emoji || '▫️'}</span>{w.name}
                  <Badge variant={w.is_active ? 'default' : 'secondary'}>{w.is_active ? 'aktiv' : 'inaktiv'}</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => saveWs(w)}>
                    <Save className="w-4 h-4 mr-1" />Speichern
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => delWs(w.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div><Label>Code</Label><Input value={w.code} onChange={e => patchWs(w.id, { code: e.target.value })} /></div>
                <div><Label>Name</Label><Input value={w.name} onChange={e => patchWs(w.id, { name: e.target.value })} /></div>
                <div><Label>Emoji</Label><Input value={w.emoji || ''} onChange={e => patchWs(w.id, { emoji: e.target.value })} /></div>
                <div><Label>Icon (lucide)</Label><Input value={w.icon || ''} onChange={e => patchWs(w.id, { icon: e.target.value })} /></div>
                <div><Label>Dashboard-Pfad</Label><Input value={w.dashboard_path || ''} onChange={e => patchWs(w.id, { dashboard_path: e.target.value })} /></div>
                <div><Label>Sortierung</Label><Input type="number" value={w.sort_order} onChange={e => patchWs(w.id, { sort_order: Number(e.target.value) })} /></div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={w.is_active} onCheckedChange={v => patchWs(w.id, { is_active: v })} />
                  <span className="text-sm">Aktiv</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="nav" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {ws.map(w => (
              <Button key={w.id} size="sm" variant={activeWs === w.id ? 'default' : 'outline'} onClick={() => setActiveWs(w.id)}>
                {w.emoji} {w.name}
              </Button>
            ))}
            <Button size="sm" className="ml-auto" onClick={addNav} disabled={!activeWs}>
              <Plus className="w-4 h-4 mr-1" />Eintrag
            </Button>
          </div>
          {navOfActive.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Navigationseinträge für diesen Workspace.</p>
          )}
          {navOfActive.map(n => (
            <Card key={n.id}>
              <CardContent className="grid gap-3 md:grid-cols-4 pt-6">
                <div><Label>Label</Label><Input value={n.label} onChange={e => patchNav(n.id, { label: e.target.value })} /></div>
                <div><Label>Pfad</Label><Input value={n.path} onChange={e => patchNav(n.id, { path: e.target.value })} /></div>
                <div><Label>Icon</Label><Input value={n.icon || ''} onChange={e => patchNav(n.id, { icon: e.target.value })} /></div>
                <div><Label>Sektion</Label><Input value={n.section || ''} onChange={e => patchNav(n.id, { section: e.target.value || null })} /></div>
                <div className="md:col-span-2">
                  <Label>Rollen (kommagetrennt, leer = alle)</Label>
                  <Input value={csv(n.roles)} onChange={e => patchNav(n.id, { roles: parseCsv(e.target.value) })} />
                </div>
                <div>
                  <Label>Mandanten-Codes (leer = alle)</Label>
                  <Input value={csv(n.tenant_codes)} onChange={e => patchNav(n.id, { tenant_codes: parseCsv(e.target.value) })} />
                </div>
                <div><Label>Sortierung</Label><Input type="number" value={n.sort_order} onChange={e => patchNav(n.id, { sort_order: Number(e.target.value) })} /></div>
                <div className="md:col-span-4 flex items-center gap-3">
                  <Switch checked={n.is_active} onCheckedChange={v => patchNav(n.id, { is_active: v })} />
                  <span className="text-sm">Aktiv</span>
                  <Button size="sm" variant="outline" className="ml-auto" disabled={saving} onClick={() => saveNav(n)}>
                    <Save className="w-4 h-4 mr-1" />Speichern
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => delNav(n.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="users" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="Benutzer suchen…" value={userFilter} onChange={e => setUserFilter(e.target.value)} className="max-w-sm" />
            <Button size="sm" variant="outline" className="ml-auto" disabled={saving} onClick={applyDefaults}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Standardzuweisung nach Rolle
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ohne Zuordnung sieht ein Benutzer alle Workspaces. Sobald mindestens ein Workspace gesetzt ist, wird die Auswahl eingeschränkt.
            Admins und Super Admins sehen immer alle.
          </p>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Benutzer</th>
                    {ws.map(w => <th key={w.id} className="p-3 text-center whitespace-nowrap">{w.emoji} {w.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-3">
                        <div className="font-medium">{u.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      {ws.map(w => (
                        <td key={w.id} className="p-3 text-center">
                          <Checkbox
                            checked={(access[u.id] || []).includes(w.id)}
                            onCheckedChange={v => toggleAccess(u.id, w.id, Boolean(v))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4 pt-4">
          <Input placeholder="Benutzer suchen…" value={userFilter} onChange={e => setUserFilter(e.target.value)} className="max-w-sm" />
          <p className="text-xs text-muted-foreground">
            Steuert, welche Mandanten (Alix Lasers, Alix Austria, Alix Medical, CMR) ein Benutzer im Umschalter sieht.
            Ohne Zuordnung gelten die bisherigen Rollenregeln. Nur Super Admin darf ändern.
          </p>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Benutzer</th>
                    {tenants.map(t => (
                      <th key={t.id} className="p-3 text-center whitespace-nowrap">{t.flag_emoji || ''} {t.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-3">
                        <div className="font-medium">{u.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      {tenants.map(t => (
                        <td key={t.id} className="p-3 text-center">
                          <Checkbox
                            checked={(tenantAccess[u.id] || []).includes(t.id)}
                            onCheckedChange={v => toggleTenantAccess(u.id, t.id, Boolean(v))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
