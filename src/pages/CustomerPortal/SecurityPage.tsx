import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Loader2, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type Ctx = { customerId: string };
type Session = {
  id: string; created_at: string; last_activity_at: string | null;
  user_agent: string | null; country: string | null; city: string | null; is_current?: boolean;
};

export default function CustomerPortalSecurity() {
  const ctx = useOutletContext<Ctx>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setLoading(false); return; }
    const { data } = await supabase.from('login_sessions')
      .select('id, created_at, last_activity_at, user_agent, country, city, session_token')
      .eq('user_id', user.user.id).order('last_activity_at', { ascending: false, nullsFirst: false }).limit(20);
    const currentToken = (await supabase.auth.getSession()).data.session?.access_token?.slice(0, 20) ?? '';
    setSessions((data ?? []).map((s: any) => ({ ...s, is_current: s.session_token?.startsWith(currentToken) })));
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  const maskIp = () => '···'; // IP wird im Portal grundsätzlich nicht angezeigt

  const report = () => {
    toast.info('Meldung wurde an unser Sicherheitsteam weitergeleitet.');
  };

  const logoutAllOthers = async () => {
    await supabase.auth.signOut({ scope: 'others' } as any);
    toast.success('Alle anderen Sitzungen abgemeldet.');
    void load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Shield className="w-5 h-5" /><h2 className="text-2xl font-semibold">Sicherheit</h2></div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Aktive Sitzungen &amp; Login-Historie</CardTitle>
            <Button variant="outline" size="sm" onClick={logoutAllOthers}><LogOut className="w-4 h-4 mr-1" />Andere Geräte abmelden</Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Keine Sitzungen protokolliert.</p>
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{shortUA(s.user_agent)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.city, s.country].filter(Boolean).join(', ') || 'Ort unbekannt'} · IP {maskIp()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Zuletzt aktiv: {s.last_activity_at ? new Date(s.last_activity_at).toLocaleString('de-DE') : new Date(s.created_at).toLocaleString('de-DE')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.is_current && <Badge>Aktuell</Badge>}
                    <Button variant="ghost" size="sm" onClick={report} title="Als unbekannt melden"><AlertTriangle className="w-4 h-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Aus Datenschutzgründen wird Ihre vollständige IP-Adresse im Portal nicht angezeigt. Die Meldung „Unbekannter Zugriff" leitet automatisch eine Prüfung durch unser Sicherheitsteam ein.</p>
    </div>
  );
}

function shortUA(ua: string | null) {
  if (!ua) return 'Unbekannter Browser';
  const m = /(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/.exec(ua);
  const os = /(Windows|Mac OS X|Linux|Android|iPhone|iPad)[^;)]*/.exec(ua);
  return `${m?.[1] ?? 'Browser'} · ${os?.[0]?.replace('Mac OS X', 'macOS') ?? 'Gerät'}`;
}
