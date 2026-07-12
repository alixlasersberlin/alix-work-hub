import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, X, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

type Grant = {
  id: string; user_id: string; role_id: string; role_name: string | null;
  valid_from: string; valid_until: string; reason: string; granted_by: string;
  status: string; auto_revoked_at: string | null; created_at: string;
};

export default function TempGrants() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [g, u] = await Promise.all([
      (supabase as any).from('role_temporary_grants').select('*').order('created_at', { ascending: false }),
      supabase.from('user_profiles').select('id, full_name, email'),
    ]);
    setGrants(g.data ?? []); setUsers(u.data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u?.full_name ?? u?.email ?? id.slice(0, 8);
  };

  const revoke = async (id: string) => {
    const reason = window.prompt('Grund für den Widerruf?');
    if (!reason?.trim()) return;
    setBusy(id);
    const { error } = await (supabase as any).rpc('revoke_temporary_role_grant', { _grant_id: id, _reason: reason });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Zeit-Grant widerrufen');
    load();
  };

  const runExpire = async () => {
    setBusy('expire');
    const { data, error } = await (supabase as any).rpc('expire_temporary_role_grants');
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Prüfung ausgeführt — ${data ?? 0} Grants abgelaufen`);
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const active = grants.filter(g => g.status === 'active');
  const done = grants.filter(g => g.status !== 'active');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="w-5 h-5" /> Befristete Rechte</h2>
          <p className="text-xs text-muted-foreground">Stündlicher Cron-Job läuft automatisch. Sie können die Prüfung auch manuell auslösen.</p>
        </div>
        <Button variant="outline" size="sm" onClick={runExpire} disabled={busy === 'expire'}>
          {busy === 'expire' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1" />}
          Ablauf-Prüfung jetzt ausführen
        </Button>
      </div>

      {active.length > 0 && (
        <div>
          <h3 className="text-xs uppercase text-muted-foreground mb-2">Aktiv ({active.length})</h3>
          <div className="space-y-2">
            {active.map(g => {
              const until = new Date(g.valid_until);
              const hoursLeft = Math.round((until.getTime() - Date.now()) / 3600000);
              return (
                <Card key={g.id} className="p-3 border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-amber-500/10 border-amber-500/40 text-amber-500">{g.role_name}</Badge>
                        <span className="text-sm">für <b>{userName(g.user_id)}</b></span>
                        <span className="text-[10px] text-muted-foreground">gültig bis {until.toLocaleString('de-DE')} ({hoursLeft}h verbleibend)</span>
                      </div>
                      <div className="text-xs mt-1 text-muted-foreground">Grund: {g.reason}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => revoke(g.id)} disabled={busy === g.id}>
                      {busy === g.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <X className="w-3 h-3 mr-1" />}
                      Sofort widerrufen
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h3 className="text-xs uppercase text-muted-foreground mb-2 mt-4">Historie ({done.length})</h3>
          <div className="space-y-1">
            {done.map(g => (
              <Card key={g.id} className="p-2 text-sm flex items-center gap-2 flex-wrap opacity-80">
                <Badge variant="outline" className={g.status === 'revoked' ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-muted'}>
                  {g.status}
                </Badge>
                <span>{g.role_name}</span>
                <span className="text-muted-foreground">→ {userName(g.user_id)}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {g.auto_revoked_at ? new Date(g.auto_revoked_at).toLocaleString('de-DE') : new Date(g.created_at).toLocaleString('de-DE')}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {grants.length === 0 && <Card className="p-8 text-center text-muted-foreground">Noch keine befristeten Rechte vergeben.</Card>}
    </div>
  );
}
