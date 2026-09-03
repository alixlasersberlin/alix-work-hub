import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getPushStatus, isNative, deviceId, sendTestPush, registerPush } from '@/lib/mobile/push-registration';

export default function MobilPushDiagnose() {
  const { user } = useAuth();
  const [status, setStatus] = useState('…');
  const [native, setNative] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [transports, setTransports] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setStatus(await getPushStatus());
    setNative(await isNative());
    if (!user?.id) return;
    const { data: d } = await (supabase as any).from('mobile_push_subscriptions')
      .select('id, platform, push_provider, device_id, notifications_enabled, revoked_at, last_push_ok_at, last_push_error, last_push_error_at, last_seen_at')
      .eq('user_id', user.id).order('last_seen_at', { ascending: false }).limit(10);
    setDevices(d ?? []);
    const { data: e } = await (supabase as any).from('notification_events')
      .select('id, notification_type, priority, status, provider, failure_reason, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(15);
    setEvents(e ?? []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const test = async () => {
    setBusy(true);
    const r = await sendTestPush();
    setTransports((r.info as any)?.transports ?? null);
    setBusy(false);
    r.ok ? toast.success('Test-Push zugestellt an dieses Konto.') : toast.error(r.error ?? 'Fehlgeschlagen');
    load();
  };

  const Row = ({ ok, label, note }: { ok: boolean | null; label: string; note?: string }) => (
    <div className="flex items-start gap-2 py-1.5">
      {ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
        : ok === false ? <XCircle className="h-4 w-4 text-destructive mt-0.5" />
        : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />}
      <div className="text-sm min-w-0">
        <div>{label}</div>
        {note && <div className="text-[11px] text-muted-foreground break-all">{note}</div>}
      </div>
    </div>
  );

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-5 w-5" /> Push-Diagnose</h1>

      <section className="rounded-lg border border-border p-3">
        <Row ok={status === 'granted'} label={`Berechtigung: ${status}`} />
        <Row ok={native ? true : null} label={native ? 'Native App-Umgebung (APNs/FCM möglich)' : 'Web/PWA — für iOS-Hintergrund-Push ist NATIVE BUILD REQUIRED'} />
        <Row ok={devices.some((d) => !d.revoked_at && d.notifications_enabled)} label="Registriertes Gerät vorhanden" note={`device_id: ${deviceId()}`} />
        {transports && (
          <>
            <Row ok={!!transports.fcm} label="Serverseitig konfiguriert: FCM (Android)" />
            <Row ok={!!transports.apns} label="Serverseitig konfiguriert: APNs (iOS)" />
            <Row ok={!!transports.webpush} label="Serverseitig konfiguriert: Web-Push (VAPID)" />
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={test} disabled={busy}>Test-Push an dieses Konto</Button>
          <Button size="sm" variant="outline" onClick={async () => { const r = await registerPush(); r.ok ? toast.success('Registriert.') : toast.error(r.error!); load(); }}>
            Neu registrieren
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground pt-2">Es werden keine Schlüssel oder Zugangsdaten angezeigt.</p>
      </section>

      <section className="rounded-lg border border-border p-3">
        <h2 className="text-sm font-medium mb-2">Geräte</h2>
        {devices.length === 0 ? <p className="text-xs text-muted-foreground">Kein Gerät registriert.</p> : devices.map((d) => (
          <div key={d.id} className="text-xs border-t border-border py-2 first:border-0">
            <div>{d.platform} · {d.push_provider ?? '—'} {d.revoked_at ? '· widerrufen' : d.notifications_enabled ? '· aktiv' : '· deaktiviert'}</div>
            <div className="text-muted-foreground">
              zuletzt ok: {d.last_push_ok_at ? new Date(d.last_push_ok_at).toLocaleString('de-DE') : '—'}
              {d.last_push_error && ` · Fehler: ${d.last_push_error}`}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border p-3">
        <h2 className="text-sm font-medium mb-2">Letzte Push-Ereignisse</h2>
        {events.length === 0 ? <p className="text-xs text-muted-foreground">Noch keine Ereignisse.</p> : events.map((e) => (
          <div key={e.id} className="text-xs border-t border-border py-1.5 first:border-0 flex gap-2">
            <span className="w-32 shrink-0 text-muted-foreground">{new Date(e.created_at).toLocaleString('de-DE')}</span>
            <span className="flex-1">{e.notification_type} · {e.priority} · {e.status}{e.provider ? ` · ${e.provider}` : ''}</span>
            {e.failure_reason && <span className="text-destructive">{e.failure_reason}</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
