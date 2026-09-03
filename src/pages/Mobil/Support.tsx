/**
 * HILFE & SUPPORT / DIAGNOSE (Prompt 7, Punkt 52/53)
 * Diagnosedaten enthalten weder Secrets noch Kundeninhalte.
 */
import { useEffect, useState } from 'react';
import { LifeBuoy, Copy, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { APP_BUILD, APP_NAME, APP_VERSION_MOBILE, ENVIRONMENT } from '@/lib/mobil/appInfo';
import { detectPlatform, deviceName, getDeviceId } from '@/lib/mobil/security';

export default function MobilSupport() {
  const { user } = useAuth();
  const [backend, setBackend] = useState<'PRUEFT' | 'OK' | 'GESTOERT'>('PRUEFT');
  const [realtime, setRealtime] = useState<'PRUEFT' | 'OK' | 'GESTOERT'>('PRUEFT');
  const [supportUrl, setSupportUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { error } = await (supabase as any).from('app_settings').select('key').limit(1);
      setBackend(error ? 'GESTOERT' : 'OK');
      const { data } = await (supabase as any).from('app_settings').select('value').eq('key', 'support_url').maybeSingle();
      if (data?.value) setSupportUrl(String(data.value).replace(/^"|"$/g, ''));
    })();

    const ch = supabase.channel(`support-health-${Math.random().toString(36).slice(2)}`)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtime('OK');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtime('GESTOERT');
      });
    return () => { supabase.removeChannel(ch); };
  }, []);

  const report = {
    app: APP_NAME,
    version: APP_VERSION_MOBILE,
    build: APP_BUILD,
    environment: ENVIRONMENT,
    platform: detectPlatform(),
    device: deviceName(),
    deviceId: getDeviceId(),
    userId: user?.id ?? null,
    pushPermission: typeof Notification !== 'undefined' ? Notification.permission : 'nicht verfügbar',
    online: navigator.onLine,
    backend,
    realtime,
    generatedAt: new Date().toISOString(),
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-primary" /> Hilfe & Support</h1>

      <Card className="p-4 space-y-1 text-sm">
        {Object.entries(report).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-mono text-[11px] truncate max-w-[60%] text-right">{String(v)}</span>
          </div>
        ))}
      </Card>

      <Button className="w-full h-12" onClick={() => {
        navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        toast.success('Diagnosedaten kopiert (ohne Zugangsdaten).');
      }}>
        <Copy className="w-4 h-4 mr-2" /> Diagnosedaten kopieren
      </Button>

      <Button variant="outline" className="w-full h-12" asChild>
        <a href={supportUrl || 'mailto:service@alix-lasers.com'}>Support kontaktieren</a>
      </Button>

      <Button variant="ghost" className="w-full h-12" asChild>
        <Link to="/mobil/systemstatus"><Activity className="w-4 h-4 mr-2" /> Systemstatus öffnen</Link>
      </Button>
    </div>
  );
}
