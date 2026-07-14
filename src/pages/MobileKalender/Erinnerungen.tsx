import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, CheckCheck } from 'lucide-react';

interface AppNotification {
  id: string; title: string; message: string | null; priority: string;
  category: string; read_at: string | null; action_url: string | null;
  event_id: string | null; created_at: string;
}

export default function KalenderErinnerungen() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any).from('app_notifications')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
    setRows(((data as any) || []) as AppNotification[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const channel = (supabase as any).channel('mobile-app-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [user?.id]);

  const markAll = async () => {
    if (!user) return;
    await (supabase as any).from('app_notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id).is('read_at', null);
    load();
  };
  const markOne = async (id: string) => {
    await (supabase as any).from('app_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  const unread = rows.filter(r => !r.read_at);
  const read = rows.filter(r => r.read_at);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5" /> Erinnerungen</h2>
        {unread.length > 0 && (
          <Button size="sm" variant="ghost" onClick={markAll}><CheckCheck className="h-4 w-4 mr-1" /> Alle gelesen</Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-16"/><Skeleton className="h-16"/></div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Keine Erinnerungen.</Card>
      ) : (
        <>
          {unread.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Neu ({unread.length})</div>
              {unread.map(n => <Row key={n.id} n={n} onRead={() => markOne(n.id)} />)}
            </div>
          )}
          {read.length > 0 && (
            <div className="space-y-2 opacity-70">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Gelesen</div>
              {read.slice(0, 30).map(n => <Row key={n.id} n={n} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ n, onRead }: { n: AppNotification; onRead?: () => void }) {
  const priorityColor = n.priority === 'urgent' ? 'border-rose-500/50 bg-rose-500/5'
    : n.priority === 'high' ? 'border-amber-500/50 bg-amber-500/5' : '';
  const body = (
    <Card className={`p-3 ${priorityColor}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{n.title}</div>
          {n.message && <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>}
          <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('de-DE')}</div>
        </div>
        {!n.read_at && <Badge variant="outline" className="text-[10px]">NEU</Badge>}
      </div>
    </Card>
  );
  const target = n.event_id ? `/m/kalender/termin/${n.event_id}` : (n.action_url || '/m/kalender');
  return (
    <Link to={target} onClick={onRead}>{body}</Link>
  );
}
