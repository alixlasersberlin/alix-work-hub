import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, Users, Copy, AlertTriangle } from 'lucide-react';
import { CRITICAL_ROLE_NAMES, levelClasses, levelLabel, scoreForRole, type RoleRow } from './lib';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function RolesCards() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [userRoles, setUserRoles] = useState<{ user_id: string; role_id: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string | null; email: string | null; is_active: boolean }[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<RoleRow | null>(null);

  useEffect(() => {
    (async () => {
      const [r, ur, u] = await Promise.all([
        supabase.from('roles').select('id, name, description').order('name'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase.from('user_profiles').select('id, full_name, email, is_active'),
      ]);
      setRoles((r.data ?? []) as RoleRow[]);
      setUserRoles(ur.data ?? []);
      setUsers(u.data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q) return roles;
    const s = q.toLowerCase();
    return roles.filter(r => r.name.toLowerCase().includes(s) || (r.description ?? '').toLowerCase().includes(s));
  }, [roles, q]);

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  return (
    <div className="space-y-4">
      <Input placeholder="Rolle suchen…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(role => {
          const roleUsers = userRoles.filter(x => x.role_id === role.id);
          const activeUsers = roleUsers.filter(ru => users.find(u => u.id === ru.user_id)?.is_active).length;
          const score = scoreForRole(role, roleUsers.length);
          const isCritical = CRITICAL_ROLE_NAMES.has(role.name);
          return (
            <Card
              key={role.id}
              className="p-4 hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => setSelected(role)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className={`w-5 h-5 ${isCritical ? 'text-amber-500' : 'text-primary'}`} />
                    <h3 className="font-semibold truncate">{role.name}</h3>
                    {isCritical && <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/40 text-amber-500">KRITISCH</Badge>}
                  </div>
                  {role.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</p>}
                  {!role.description && <p className="text-xs text-amber-500 mt-1 italic">Keine Beschreibung hinterlegt</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-muted/40 rounded-md p-2">
                  <div className="text-[10px] text-muted-foreground uppercase">Benutzer</div>
                  <div className="text-lg font-bold tabular-nums flex items-center gap-1">
                    <Users className="w-3 h-3" /> {activeUsers}
                    {activeUsers < roleUsers.length && <span className="text-xs text-muted-foreground">/{roleUsers.length}</span>}
                  </div>
                </div>
                <div className={`rounded-md p-2 border ${levelClasses(score.level)}`}>
                  <div className="text-[10px] uppercase opacity-70">Sicherheit</div>
                  <div className="text-lg font-bold tabular-nums">{score.score}</div>
                </div>
              </div>

              <Badge variant="outline" className={`text-[10px] ${levelClasses(score.level)}`}>
                {levelLabel(score.level)}
              </Badge>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && <RoleDetail role={selected} users={users} userRoles={userRoles} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleDetail({ role, users, userRoles }: {
  role: RoleRow;
  users: { id: string; full_name: string | null; email: string | null; is_active: boolean }[];
  userRoles: { user_id: string; role_id: string }[];
}) {
  const assigned = userRoles.filter(x => x.role_id === role.id);
  const detailed = assigned.map(a => users.find(u => u.id === a.user_id)).filter(Boolean);
  const score = scoreForRole(role, assigned.length);
  const isCritical = CRITICAL_ROLE_NAMES.has(role.name);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Shield className={`w-5 h-5 ${isCritical ? 'text-amber-500' : 'text-primary'}`} />
          {role.name}
          {isCritical && <Badge variant="outline" className="bg-amber-500/10 border-amber-500/40 text-amber-500">KRITISCH</Badge>}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Beschreibung</div>
          <div className="text-sm">{role.description ?? <span className="italic text-amber-500">Keine Beschreibung hinterlegt</span>}</div>
        </div>

        <Card className={`p-3 border ${levelClasses(score.level)}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase font-semibold opacity-80">Sicherheitsbewertung</div>
            <div className="text-2xl font-bold tabular-nums">{score.score}<span className="text-xs opacity-60">/100</span></div>
          </div>
          <div className="text-sm">{levelLabel(score.level)}</div>
          {score.reasons.length > 0 && (
            <ul className="text-xs mt-2 space-y-0.5 opacity-90">
              {score.reasons.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
          )}
        </Card>

        <div>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Users className="w-3 h-3" /> Zugewiesene Benutzer ({detailed.length})
          </div>
          <div className="space-y-1 max-h-64 overflow-auto">
            {detailed.length === 0 && <div className="text-sm text-muted-foreground italic">Keine Benutzer zugeordnet</div>}
            {detailed.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.full_name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                {!u.is_active && <Badge variant="outline" className="text-[10px] bg-red-500/10 border-red-500/40 text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> inaktiv</Badge>}
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-3">
          Rechteänderungen an dieser Rolle müssen über <b>Freigabeanträge</b> beantragt werden (Vier-Augen-Prinzip).
        </div>
      </div>
    </>
  );
}
