import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, User, Shield, AlertTriangle, Building2, Mail } from 'lucide-react';
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

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  const enriched = useMemo(() => users.map(u => {
    const myRoles = userRoles.filter(x => x.user_id === u.id).map(x => roles.find(r => r.id === x.role_id)?.name).filter(Boolean);
    const myTenants = uta.filter(x => x.user_id === u.id).map(x => tenants.find(t => t.id === x.tenant_id)).filter(Boolean);
    const hasCritical = myRoles.some((n: string) => CRITICAL_ROLE_NAMES.has(n));
    const score = scoreForUser({
      isActive: u.is_active,
      status: u.account_status,
      roleCount: myRoles.length,
      hasCriticalRole: hasCritical,
      hasTenant: myTenants.length > 0,
    });
    const dept = departments.find(d => d.id === u.department_id)?.name;
    return { ...u, myRoles, myTenants, hasCritical, score, dept };
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
          <Card key={u.id} className="p-4 hover:border-primary/40 transition-all">
            <div className="flex items-start gap-3 mb-3">
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
    </div>
  );
}
