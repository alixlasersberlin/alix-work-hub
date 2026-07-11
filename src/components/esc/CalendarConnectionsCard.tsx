import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Conn {
  id: string; provider: 'google' | 'microsoft';
  account_email: string | null; last_sync_at: string | null; status: string;
}

export function CalendarConnectionsCard() {
  const [conns, setConns] = useState<Conn[]>([]);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from('esc_calendar_connections')
      .select('id,provider,account_email,last_sync_at,status')
      .eq('user_id', user.id);
    setConns((data as Conn[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  function connect(provider: 'google' | 'microsoft') {
    if (!userId) return;
    const redirectUri = `${SUPABASE_URL}/functions/v1/esc-calendar-oauth?provider=${provider}`;
    let authUrl = '';
    if (provider === 'google') {
      const clientId = (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string) ?? '';
      if (!clientId) return toast.error('VITE_GOOGLE_OAUTH_CLIENT_ID nicht konfiguriert');
      const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events email profile');
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${userId}`;
    } else {
      const clientId = (import.meta.env.VITE_MS_OAUTH_CLIENT_ID as string) ?? '';
      const tenant = (import.meta.env.VITE_MS_OAUTH_TENANT as string) ?? 'common';
      if (!clientId) return toast.error('VITE_MS_OAUTH_CLIENT_ID nicht konfiguriert');
      const scope = encodeURIComponent('offline_access Calendars.ReadWrite User.Read');
      authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scope}&state=${userId}`;
    }
    window.location.href = authUrl;
  }

  async function disconnect(id: string) {
    await supabase.from('esc_calendar_connections').delete().eq('id', id);
    load();
  }

  async function syncNow() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('esc-calendar-sync', { body: { user_id: userId } });
      if (error) throw error;
      toast.success(`Synchronisiert: ${data?.results?.length ?? 0} Termine`);
      load();
    } catch (e: any) { toast.error(e?.message ?? 'Sync fehlgeschlagen'); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-[14px] flex items-center gap-2"><Calendar className="w-4 h-4" /> Two-Way-Sync: Google / Microsoft</CardTitle></CardHeader>
      <CardContent className="text-[13px] space-y-3">
        <div className="text-muted-foreground text-[12px]">
          Verbinden Sie Ihren persönlichen Google- oder Microsoft-Kalender, um ESC-Termine automatisch abzugleichen.
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => connect('google')}>Google verbinden</Button>
          <Button size="sm" variant="outline" onClick={() => connect('microsoft')}>Microsoft verbinden</Button>
          <Button size="sm" variant="secondary" onClick={syncNow} disabled={busy || conns.length === 0}>
            <RefreshCw className={`w-4 h-4 mr-1 ${busy ? 'animate-spin' : ''}`} /> Jetzt syncen
          </Button>
        </div>
        <div className="space-y-1">
          {conns.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded px-2 py-1">
              <div>
                <div className="font-medium capitalize">{c.provider}</div>
                <div className="text-[11px] text-muted-foreground">
                  {c.account_email ?? '—'} · Letzter Sync: {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString('de-DE') : 'nie'}
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => disconnect(c.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {conns.length === 0 && <div className="text-[12px] text-muted-foreground">Noch keine Verbindungen.</div>}
        </div>
      </CardContent>
    </Card>
  );
}
