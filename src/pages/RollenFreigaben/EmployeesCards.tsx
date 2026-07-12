import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, User, Shield, Building2, Mail, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { CRITICAL_ROLE_NAMES, levelClasses, levelLabel, scoreForUser } from './lib';

export default function EmployeesCards() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [uta, setUta] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'inactive' | 'noRole'>('all');

  const [editing, setEditing] = useState<any | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editTenantIds, setEditTenantIds] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [u, r, ur, t, ua, d] = await Promise.all([
      supabase.from('user_profiles').select('id, full_name, email, is_active, account_status, department_id'),
      supabase.from('roles').select('id, name'),
      supabase.from('user_roles').select('user_id, role_id'),
      supabase.from('tenants').select('id, code, name, country'),
      supabase.from('user_tenant_access').select('user_id, tenant_id'),
      supabase.from('departments').select('id, name'),
    ]);
    setUsers(u.data ?? []); setRoles(r.data ?? []); setUserRoles(ur.data ?? []);
    setTenants(t.data ?? []); setUta(ua.data ?? []); setDepartments(d.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => users.map(u => {
    const myRoleIds = userRoles.filter(x => x.user_id === u.id).map(x => x.role_id);
    const myRoles = myRoleIds.map(id => roles.find(r => r.id === id)?.name).filter(Boolean);
    const myTenantIds = uta.filter(x => x.user_id === u.id).map(x => x.tenant_id);
    const myTenants = myTenantIds.map(id => tenants.find(t => t.id === id)).filter(Boolean);
    const hasCritical = myRoles.some((n: string) => CRITICAL_ROLE_NAMES.has(n));
    const score = scoreForUser({
      isActive: u.is_active,
      status: u.account_status,
      roleCount: myRoles.length,
      hasCriticalRole: hasCritical,
      hasTenant: myTenants.length > 0,
    });
    const dept = departments.find(d => d.id === u.department_id)?.name;
    return { ...u, myRoleIds, myRoles, myTenantIds, myTenants, hasCritical, score, dept };
  }), [users, userRoles, roles, uta, tenants, departments]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filter === 'critical') list = list.filter(u => u.hasCritical);
    if (filter === 'inactive') list = list.filter(u => !u.is_active);
    if (filter === 'noRole') list = list.filter(u => u.myRoles.length === 0);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter(u => (u.full_name ?? '').toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s));
    }
    return list;
  }, [enriched, filter, q]);

  const openEdit = (u: any) => {
    setEditing(u);
    setEditRoleIds([...u.myRoleIds]);
    setEditTenantIds([...u.myTenantIds]);
    setEditActive(!!u.is_active);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Roles: diff
      const before = new Set<string>(editing.myRoleIds);
      const after = new Set<string>(editRoleIds);
      const toAddRoles = editRoleIds.filter(id => !before.has(id));
      const toRemoveRoles = [...before].filter(id => !after.has(id));
      if (toRemoveRoles.length) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', editing.id).in('role_id', toRemoveRoles);
        if (error) throw error;
      }
      if (toAddRoles.length) {
        const { error } = await supabase.from('user_roles').insert(toAddRoles.map(rid => ({ user_id: editing.id, role_id: rid })));
        if (error) throw error;
      }
      // Tenants: diff
      const tBefore = new Set<string>(editing.myTenantIds);
      const tAfter = new Set<string>(editTenantIds);
      const toAddTen = editTenantIds.filter(id => !tBefore.has(id));
      const toRemoveTen = [...tBefore].filter(id => !tAfter.has(id));
      if (toRemoveTen.length) {
        const { error } = await supabase.from('user_tenant_access').delete().eq('user_id', editing.id).in('tenant_id', toRemoveTen);
        if (error) throw error;
      }
      if (toAddTen.length) {
        const { error } = await supabase.from('user_tenant_access').insert(toAddTen.map(tid => ({ user_id: editing.id, tenant_id: tid })));
        if (error) throw error;
      }
      // Active
      if (editActive !== !!editing.is_active) {
        const { error } = await supabase.from('user_profiles').update({ is_active: editActive }).eq('id', editing.id);
        if (error) throw error;
      }
      toast.success('Änderungen gespeichert');
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade Mitarbeiter…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Name oder E-Mail…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
        {[
          { id: 'all', label: `Alle (${enriched.length})` },
          { id: 'critical', label: `Kritisch (${enriched.filter(u => u.hasCritical).length})` },
          { id: 'inactive', label: `Inaktiv (${enriched.filter(u => !u.is_active).length})` },
          { id: 'noRole', label: `Ohne Rolle (${enriched.filter(u => u.myRoles.length === 0).length})` },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-md text-xs border ${filter === f.id ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border hover:bg-muted/40'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(u => (
          <Card key={u.id} className="p-4 hover:border-primary/40 transition-all relative">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 absolute top-2 right-2 z-10"
              onClick={(e) => { e.stopPropagation(); openEdit(u); }}
              title="Bearbeiten"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <div className="flex items-start gap-3 mb-3 pr-8">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{u.full_name ?? '—'}</h3>
                  {!u.is_active && <Badge variant="outline" className="text-[10px] bg-red-500/10 border-red-500/40 text-red-500">inaktiv</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="w-3 h-3" />{u.email}</div>
                {u.dept && <div className="text-xs text-muted-foreground mt-0.5">{u.dept}</div>}
              </div>
            </div>


            <div className="space-y-2">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase mb-1">Rollen</div>
                <div className="flex flex-wrap gap-1">
                  {u.myRoles.length === 0 && <Badge variant="outline" className="text-[10px] bg-red-500/10 border-red-500/40 text-red-500">Keine Rolle</Badge>}
                  {u.myRoles.map((r: string) => (
                    <Badge key={r} variant="outline" className={`text-[10px] ${CRITICAL_ROLE_NAMES.has(r) ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : ''}`}>
                      {CRITICAL_ROLE_NAMES.has(r) && <Shield className="w-2.5 h-2.5 mr-0.5" />}
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>

              {u.myTenants.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Niederlassungen</div>
                  <div className="flex flex-wrap gap-1">
                    {u.myTenants.map((t: any) => (
                      <Badge key={t.id} variant="outline" className="text-[10px]">
                        {t.name}{t.country ? ` · ${t.country}` : ''}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className={`p-2 rounded-md border flex items-center justify-between ${levelClasses(u.score.level)}`}>
                <div className="text-xs font-medium">{levelLabel(u.score.level)}</div>
                <div className="text-sm font-bold tabular-nums">{u.score.score}</div>
              </div>

              {u.score.reasons.length > 0 && (
                <ul className="text-[10px] text-muted-foreground space-y-0.5">
                  {u.score.reasons.slice(0, 3).map((r: string, i: number) => <li key={i}>• {r}</li>)}
                </ul>
              )}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <div className="col-span-full text-center py-8 text-muted-foreground">Keine Treffer</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.full_name || editing?.email} bearbeiten</DialogTitle>
            <DialogDescription>Rollen, Niederlassungen und Aktiv-Status verwalten.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox id="active" checked={editActive} onCheckedChange={v => setEditActive(!!v)} />
                <label htmlFor="active" className="text-sm">Aktiv</label>
              </div>

              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Rollen</div>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                  {roles.map(r => {
                    const checked = editRoleIds.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={v => setEditRoleIds(prev => v ? [...prev, r.id] : prev.filter(x => x !== r.id))}
                        />
                        <span className={CRITICAL_ROLE_NAMES.has(r.name) ? 'text-amber-500' : ''}>{r.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Niederlassungen</div>
                <div className="grid grid-cols-2 gap-2 p-2 border rounded-md">
                  {tenants.map(t => {
                    const checked = editTenantIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={v => setEditTenantIds(prev => v ? [...prev, t.id] : prev.filter(x => x !== t.id))}
                        />
                        <span>{t.name}{t.country ? ` · ${t.country}` : ''}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
