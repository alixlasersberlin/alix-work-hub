import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, Shield, Timer, User, Building2, KeyRound } from 'lucide-react';
import { CRITICAL_ROLE_NAMES } from './lib';

type Effective = { role_id: string; role_name: string; source: 'primary' | 'temporary'; valid_until: string | null; granted_by: string | null };

export default function EffectiveAccess() {
  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [uta, setUta] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [effective, setEffective] = useState<Effective[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [u, t, ua] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, email, is_active').order('full_name'),
        supabase.from('tenants').select('id, code, name, country'),
        supabase.from('user_tenant_access').select('user_id, tenant_id, role_scope'),
      ]);
      setUsers(u.data ?? []); setTenants(t.data ?? []); setUta(ua.data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!selected) { setEffective([]); return; }
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_effective_roles', { _user_id: selected });
      if (!error) setEffective((data ?? []) as Effective[]);
      setLoading(false);
    })();
  }, [selected]);

  const user = users.find(u => u.id === selected);
  const myTenants = uta.filter(x => x.user_id === selected).map(x => ({ ...tenants.find(t => t.id === x.tenant_id), scope: x.role_scope })).filter(t => t.id);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <Eye className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Effektiven Zugriff prüfen</h2>
            <p className="text-xs text-muted-foreground">Zeigt alle Rollen aus <b>Hauptzuweisung</b> und <b>befristeten Rechten</b>, aus denen sich Zugriff ableitet.</p>
          </div>
        </div>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="max-w-md"><SelectValue placeholder="Benutzer auswählen…" /></SelectTrigger>
          <SelectContent>
            {users.map(u => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name ?? u.email} {!u.is_active && '· inaktiv'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {selected && user && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center"><User className="w-5 h-5" /></div>
              <div>
                <div className="font-semibold">{user.full_name}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              {!user.is_active && <Badge variant="outline" className="ml-auto bg-red-500/10 border-red-500/40 text-red-500">inaktiv</Badge>}
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Niederlassungen</div>
                {myTenants.length === 0 && <div className="text-xs text-amber-500 italic">Keine Niederlassung zugeordnet</div>}
                <div className="flex flex-wrap gap-1">
                  {myTenants.map((t: any) => (
                    <Badge key={t.id} variant="outline" className="text-[10px]">
                      {t.name}{t.country ? ` · ${t.country}` : ''}{t.scope && t.scope !== 'member' ? ` (${t.scope})` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-primary" />
              <div className="font-semibold">Effektive Rollen</div>
              {loading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
            </div>
            {effective.length === 0 && !loading && <div className="text-xs text-muted-foreground italic">Keine effektive Rolle</div>}
            <div className="space-y-2">
              {effective.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    {e.source === 'temporary' ? <Timer className="w-4 h-4 text-amber-500 flex-shrink-0" /> : <Shield className={`w-4 h-4 flex-shrink-0 ${CRITICAL_ROLE_NAMES.has(e.role_name) ? 'text-amber-500' : 'text-primary'}`} />}
                    <span className="font-medium truncate">{e.role_name}</span>
                    {CRITICAL_ROLE_NAMES.has(e.role_name) && <Badge variant="outline" className="text-[9px] bg-amber-500/10 border-amber-500/40 text-amber-500">KRIT</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {e.source === 'primary' ? 'Hauptrolle' : `Befristet bis ${e.valid_until ? new Date(e.valid_until).toLocaleString('de-DE') : '—'}`}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {selected && (
        <Card className="p-4 bg-muted/30 border-dashed">
          <div className="text-xs text-muted-foreground">
            <b className="text-foreground">Herkunft der Rechte:</b> Aus welcher Rolle das jeweilige Recht stammt, wird
            direkt in der <a href="/admin/rollen-freigaben/matrix" className="text-primary underline">Rollenmatrix</a> je
            Modul angezeigt. Server-Enforcement erfolgt über RLS-Policies + <code>has_role()</code>-Funktionen — nicht durch dieses UI.
          </div>
        </Card>
      )}
    </div>
  );
}
