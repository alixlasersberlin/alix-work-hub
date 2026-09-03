import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Settings, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Row = {
  id: string; title: string; message: string; category: string; priority: string;
  action_url: string | null; read_at: string | null; created_at: string;
};

export default function MobilBenachrichtigungen() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const load = useCallback(async () => {
    if (!user?.id) return;
    let q = (supabase as any).from('app_notifications')
      .select('id, title, message, category, priority, action_url, read_at, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (filter === 'UNREAD') q = q.is('read_at', null);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }, [user?.id, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase.channel('mobil-notif-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, load]);

  const open = async (r: Row) => {
    if (!r.read_at) await (supabase as any).from('app_notifications').update({ read_at: new Date().toISOString() }).eq('id', r.id);
    if (r.action_url) nav(r.action_url);
  };
  const markAll = async () => {
    await (supabase as any).from('app_notifications')
      .update({ read_at: new Date().toISOString() }).eq('user_id', user!.id).is('read_at', null);
    load();
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold flex items-center gap-2"><Bell className="h-5 w-5" /> Benachrichtigungen</h1>
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Diagnose" onClick={() => nav('/mobil/push-diagnose')}><Activity className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-10 w-10" aria-label="Einstellungen" onClick={() => nav('/mobil/einstellungen/benachrichtigungen')}><Settings className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={filter === 'ALL' ? 'default' : 'outline'} onClick={() => setFilter('ALL')}>Alle</Button>
        <Button size="sm" variant={filter === 'UNREAD' ? 'default' : 'outline'} onClick={() => setFilter('UNREAD')}>Ungelesen</Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={markAll}><CheckCheck className="h-4 w-4 mr-1" /> Alle gelesen</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lädt …</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Keine Benachrichtigungen.</p>
      ) : rows.map((r) => (
        <button key={r.id} onClick={() => open(r)}
          className={`w-full text-left rounded-lg border p-3 ${r.read_at ? 'border-border' : 'border-primary/50 bg-primary/5'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate flex-1">{r.title}</span>
            {r.priority === 'P1' && <Badge variant="destructive" className="text-[10px]">P1</Badge>}
            <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.message}</p>
          <span className="text-[10px] text-muted-foreground">{r.category}</span>
        </button>
      ))}
    </div>
  );
}
