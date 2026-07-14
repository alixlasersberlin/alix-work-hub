import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, ShieldCheck, Clock, Info, ExternalLink } from 'lucide-react';
import { CRITICAL_ROLE_NAMES } from './lib';

type EffRole = { role_id: string; role_name: string; source: string; valid_until: string | null; granted_by: string | null };

export default function ViewAs() {
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [roles, setRoles] = useState<EffRole[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('user_profiles').select('id, full_name, email, is_active, account_status').order('full_name')
      .then(({ data }) => setUsers(data ?? []));
  }, []);

  useEffect(() => {
    if (!selected) { setRoles([]); setTenants([]); return; }
    setLoading(true);
    Promise.all([
      (supabase as any).rpc('get_effective_roles', { _user_id: selected }),
      supabase.from('user_tenant_access').select('tenant_id, tenants(name, code, country)').eq('user_id', selected),
    ]).then(([r, t]: any[]) => {
      setRoles(r.data ?? []);
      setTenants(t.data ?? []);
      setLoading(false);
    });
  }, [selected]);

  const user = users.find(u => u.id === selected);
  const primary = roles.filter(r => r.source === 'primary');
  const temp = roles.filter(r => r.source === 'temporary');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Eye className="w-5 h-5" /> Zugriffssimulation — "Ansicht als"</h2>
        <p className="text-xs text-muted-foreground">Simulieren Sie die effektiven Rechte eines Benutzers. Diese Ansicht ist read-only und verändert keine Sitzung.</p>
      </div>

      <Card className="p-4">
        <Label>Benutzer auswählen</Label>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Benutzer wählen…" /></SelectTrigger>
          <SelectContent>
            {users.map(u => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name ?? u.email} {!u.is_active && '(inaktiv)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loading && <div className="flex items-center gap-2 text-muted-foreground p-4"><Loader2 className="w-4 h-4 animate-spin" /> Berechne effektive Rechte…</div>}

      {user && !loading && (
        <>
          <Card className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Benutzer</div>
                <div className="text-lg font-semibold">{user.full_name ?? user.email}</div>
                <div className="text-xs text-muted-foreground">{user.email}</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={user.is_active ? 'default' : 'destructive'}>{user.is_active ? 'Aktiv' : 'Inaktiv'}</Badge>
                <Badge variant="outline">{user.account_status ?? 'unbekannt'}</Badge>
                <Button
                  size="sm"
                  onClick={() => window.open(`/simulate/${selected}`, '_blank', 'noopener,noreferrer')}
                  className="bg-amber-500 hover:bg-amber-600 text-black"
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  In neuem Fenster als diesen Benutzer öffnen
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Effektive Rollen ({roles.length})</h3>
            {roles.length === 0 ? (
              <div className="text-sm text-muted-foreground">Keine Rollen — dieser Benutzer hat keinen Zugriff auf geschützte Bereiche.</div>
            ) : (
              <div className="space-y-3">
                {primary.length > 0 && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-2">Primäre Rollen</div>
                    <div className="flex flex-wrap gap-2">
                      {primary.map(r => (
                        <Badge key={r.role_id} variant="outline"
                          className={CRITICAL_ROLE_NAMES.has(r.role_name) ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-primary/10 border-primary/30 text-primary'}>
                          {r.role_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {temp.length > 0 && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-2 flex items-center gap-1"><Clock className="w-3 h-3" /> Befristete Rollen</div>
                    <div className="space-y-1">
                      {temp.map(r => (
                        <div key={r.role_id + (r.valid_until ?? '')} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="bg-amber-500/10 border-amber-500/40 text-amber-500">{r.role_name}</Badge>
                          <span className="text-xs text-muted-foreground">gültig bis {r.valid_until ? new Date(r.valid_until).toLocaleString('de-DE') : '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Niederlassungen / Länder ({tenants.length})</h3>
            {tenants.length === 0 ? (
              <div className="text-sm text-muted-foreground">Keine explizite Niederlassungszuordnung.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tenants.map((t: any) => (
                  <Badge key={t.tenant_id} variant="outline">
                    {t.tenants?.code} · {t.tenants?.name} {t.tenants?.country && `(${t.tenants.country})`}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-3 bg-primary/5 border-primary/30 text-xs flex gap-2">
            <Info className="w-4 h-4 text-primary flex-shrink-0" />
            <div>
              Diese Simulation entspricht dem Ergebnis der Funktion <code className="text-primary">get_effective_roles()</code>.
              Sie protokolliert keine Sitzung und meldet Sie nicht als anderen Benutzer an — jede tatsächliche Anmeldung
              wird weiterhin über <code>auth.uid()</code> geprüft.
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
