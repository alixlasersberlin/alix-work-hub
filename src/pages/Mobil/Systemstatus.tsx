/**
 * SYSTEMSTATUS (Prompt 6) – echte Health Checks, keine statischen "OK".
 * Jeder Bereich wird tatsächlich abgefragt; nicht konfigurierte Dienste
 * werden als "Nicht konfiguriert" ausgewiesen.
 */
import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { APP_BUILD, APP_VERSION_MOBILE, ENVIRONMENT } from '@/lib/mobil/appInfo';

type State = 'OK' | 'GESTOERT' | 'NICHT_KONFIGURIERT' | 'PRUEFT';
type Check = { key: string; label: string; state: State; detail?: string };

export default function MobilSystemstatus() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [at, setAt] = useState<Date | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    const out: Check[] = [];

    // Backend / Datenbank
    const t0 = performance.now();
    const { error: dbErr } = await (supabase as any).from('app_settings').select('key').limit(1);
    out.push({
      key: 'db', label: 'AlixWork Backend (Supabase)',
      state: dbErr ? 'GESTOERT' : 'OK',
      detail: dbErr ? dbErr.message : `${Math.round(performance.now() - t0)} ms`,
    });

    // Realtime
    const rt = await new Promise<State>((resolve) => {
      const ch = supabase.channel(`health-${Date.now()}`);
      const to = window.setTimeout(() => { supabase.removeChannel(ch); resolve('GESTOERT'); }, 6000);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { window.clearTimeout(to); supabase.removeChannel(ch); resolve('OK'); }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { window.clearTimeout(to); supabase.removeChannel(ch); resolve('GESTOERT'); }
      });
    });
    out.push({ key: 'rt', label: 'Realtime', state: rt });

    // WhatsApp-Kanäle
    const { data: chans } = await (supabase as any).from('ac_channels')
      .select('id, is_active, channel_type, provider').eq('channel_type', 'whatsapp');
    const active = (chans || []).filter((c: any) => c.is_active);
    const { data: flags } = await (supabase as any).from('app_settings')
      .select('key, value').in('key', ['whatsapp_inbound_enabled', 'whatsapp_outbound_enabled']);
    const fmap = new Map((flags || []).map((f: any) => [f.key, String(f.value)]));
    out.push({
      key: 'wa', label: 'WhatsApp',
      state: active.length === 0 ? 'NICHT_KONFIGURIERT' : 'OK',
      detail: `${active.length} aktiver Kanal · Eingang ${fmap.get('whatsapp_inbound_enabled') === 'true' ? 'an' : 'aus'} · Versand ${fmap.get('whatsapp_outbound_enabled') === 'true' ? 'an' : 'aus'}`,
    });

    // Letzte eingehende Nachricht
    const { data: lastMsg } = await (supabase as any).from('ac_messages')
      .select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
    out.push({
      key: 'sync', label: 'Letzte Kommunikation',
      state: lastMsg ? 'OK' : 'NICHT_KONFIGURIERT',
      detail: lastMsg ? new Date(lastMsg.created_at).toLocaleString('de-DE') : 'keine Nachrichten erfasst',
    });

    // Push
    const { count: devices } = await (supabase as any).from('mobile_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .is('revoked_at', null).is('blocked_at', null);
    out.push({
      key: 'push', label: 'Push-Benachrichtigungen',
      state: (devices ?? 0) > 0 ? 'OK' : 'NICHT_KONFIGURIERT',
      detail: `${devices ?? 0} aktive Geräte`,
    });

    // AI
    const { data: aiFlag } = await (supabase as any).from('app_settings').select('value').eq('key', 'ai_enabled').maybeSingle();
    const { data: lastAi } = await (supabase as any).from('ai_classifications')
      .select('created_at, status').order('created_at', { ascending: false }).limit(1).maybeSingle();
    out.push({
      key: 'ai', label: 'ALIX AI',
      state: String(aiFlag?.value) === 'true' ? 'OK' : 'NICHT_KONFIGURIERT',
      detail: lastAi ? `letzte Analyse ${new Date(lastAi.created_at).toLocaleString('de-DE')}` : 'noch keine Analyse',
    });

    setChecks(out);
    setAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><Activity className="w-5 h-5" /> Systemstatus</h1>
        <Button variant="ghost" size="icon" className="h-11 w-11" onClick={run} aria-label="Erneut prüfen">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
        </Button>
      </div>

      {at && <div className="text-xs text-muted-foreground">Geprüft: {at.toLocaleTimeString('de-DE')}</div>}

      {checks.map((c) => (
        <Card key={c.key} className="p-3 flex items-center gap-3">
          {c.state === 'OK' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
          {c.state === 'GESTOERT' && <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
          {c.state === 'NICHT_KONFIGURIERT' && <MinusCircle className="h-5 w-5 text-muted-foreground shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{c.label}</div>
            {c.detail && <div className="text-xs text-muted-foreground truncate">{c.detail}</div>}
          </div>
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {c.state === 'OK' ? 'OK' : c.state === 'GESTOERT' ? 'Gestört' : 'Nicht konfiguriert'}
          </span>
        </Card>
      ))}

      <Card className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Über AlixWork</div>
        <div className="text-sm">Version {APP_VERSION_MOBILE} · Build {APP_BUILD}</div>
        <div className="text-xs text-muted-foreground">Umgebung: {ENVIRONMENT}</div>
      </Card>
    </div>
  );
}
