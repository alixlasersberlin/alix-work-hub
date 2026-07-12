import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Loader2, CheckCheck, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

type Notif = {
  id: string; kind: string; title: string; body: string | null;
  ref_type: string | null; ref_id: string | null;
  severity: 'info' | 'warning' | 'critical';
  read_at: string | null; created_at: string;
};
type Expiring = { id: string; user_id: string; role_name: string | null; valid_until: string; hours_left: number };

const sevIcon = (s: string) =>
  s === 'critical' ? <ShieldAlert className="w-4 h-4 text-red-500" />
  : s === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-500" />
  : <Info className="w-4 h-4 text-sky-500" />;

const sevClass = (s: string) =>
  s === 'critical' ? 'border-red-500/30 bg-red-500/5'
  : s === 'warning' ? 'border-amber-500/30 bg-amber-500/5'
  : 'border-sky-500/30 bg-sky-500/5';

export default function Notifications() {
  const [items, setItems] = useState<Notif[]>([]);
  const [expiring, setExpiring] = useState<Expiring[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [n, e, u] = await Promise.all([
      (supabase as any).from('role_notifications').select('*').order('created_at', { ascending: false }).limit(100),
      (supabase as any).from('v_temp_grants_expiring_soon').select('*'),
      supabase.from('user_profiles').select('id, full_name, email'),
    ]);
    setItems(n.data ?? []); setExpiring(e.data ?? []); setUsers(u.data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const userName = (id: string) => {
    const u = users.find(x => x.id === id);
    return u?.full_name ?? u?.email ?? id.slice(0, 8);
  };

  const markAll = async () => {
    const { error } = await (supabase as any).from('role_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    if (error) { toast.error(error.message); return; }
    toast.success('Alle als gelesen markiert');
    load();
  };

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>;

  const unread = items.filter(i => !i.read_at).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Bell className="w-5 h-5" /> Benachrichtigungen</h2>
          <p className="text-xs text-muted-foreground">In-App-Meldungen zu Anträgen, Freigaben und ablaufenden Rechten.</p>
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAll}>
            <CheckCheck className="w-3 h-3 mr-1" /> Alle als gelesen ({unread})
          </Button>
        )}
      </div>

      {expiring.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Läuft in den nächsten 24h ab ({expiring.length})
          </h3>
          <div className="space-y-1">
            {expiring.map(g => (
              <div key={g.id} className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-amber-500/10 border-amber-500/40 text-amber-500">{g.role_name}</Badge>
                <span>{userName(g.user_id)}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  in {Math.max(0, Math.round(g.hours_left))}h · {new Date(g.valid_until).toLocaleString('de-DE')}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Keine Benachrichtigungen.</Card>
      ) : (
        <div className="space-y-2">
          {items.map(n => (
            <Card key={n.id} className={`p-3 border ${sevClass(n.severity)} ${n.read_at ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-2">
                {sevIcon(n.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{n.title}</span>
                    <Badge variant="outline" className="text-[10px]">{n.kind}</Badge>
                    {!n.read_at && <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40">neu</Badge>}
                  </div>
                  {n.body && <div className="text-xs mt-1 text-muted-foreground">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('de-DE')}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
