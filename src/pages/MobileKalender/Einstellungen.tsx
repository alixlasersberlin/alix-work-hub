import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { useNativePush } from '@/hooks/useNativePush';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Shield, Smartphone } from 'lucide-react';

export default function KalenderEinstellungen() {
  const { prefs, save, loading } = useNotificationPreferences();
  const { supported, permission, subscribed, subscribe, unsubscribe, busy } = usePushSubscription();
  const native = useNativePush();

  if (loading) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Benachrichtigungen</h2>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          {subscribed ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <div className="flex-1">
            <div className="font-semibold text-sm">Push auf diesem Gerät</div>
            <div className="text-xs text-muted-foreground">
              {!supported ? 'Dieses Gerät unterstützt keine Web-Push-Benachrichtigungen.'
                : permission === 'denied' ? 'Benachrichtigungen wurden im Browser blockiert. Bitte in den Systemeinstellungen aktivieren.'
                : subscribed ? 'Aktiv – Erinnerungen werden auch bei geschlossener App empfangen.'
                : 'Nicht aktiviert.'}
            </div>
          </div>
          {supported && (subscribed
            ? <Button size="sm" variant="outline" onClick={unsubscribe} disabled={busy}>Aus</Button>
            : <Button size="sm" onClick={subscribe} disabled={busy || permission === 'denied'}>Aktivieren</Button>)}
        </div>
      </Card>

      {native.isNative && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="font-semibold text-sm">Native Push (App Store / Play Store)</div>
              <div className="text-xs text-muted-foreground">
                {native.status === 'granted' ? 'Aktiv – native Push (APNs/FCM) registriert.'
                  : native.status === 'denied' ? 'In den Systemeinstellungen blockiert.'
                  : native.status === 'error' ? 'Registrierung fehlgeschlagen.'
                  : 'Native Push noch nicht aktiviert.'}
              </div>
            </div>
            {native.status !== 'granted' && (
              <Button size="sm" onClick={native.register}>Aktivieren</Button>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Kanäle</div>
        <Row label="Push-Nachrichten" checked={prefs.push_enabled} onChange={(v) => save({ push_enabled: v })} />
        <Row label="E-Mail-Erinnerungen" checked={prefs.email_enabled} onChange={(v) => save({ email_enabled: v })} />
        <Row label="SMS-Erinnerungen" checked={prefs.sms_enabled} onChange={(v) => save({ sms_enabled: v })} />
        <Row label="WhatsApp-Erinnerungen" checked={prefs.whatsapp_enabled} onChange={(v) => save({ whatsapp_enabled: v })} />
        <Row label="In-App-Erinnerungen" checked={prefs.in_app_enabled} onChange={(v) => save({ in_app_enabled: v })} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Verhalten</div>
        <Row label="Ton" checked={prefs.sound_enabled} onChange={(v) => save({ sound_enabled: v })} />
        <Row label="Vibration" checked={prefs.vibration_enabled} onChange={(v) => save({ vibration_enabled: v })} />
        <Row label="App-Badge (Zähler)" checked={prefs.badge_enabled} onChange={(v) => save({ badge_enabled: v })} />
        <Row label="Am Wochenende" checked={prefs.weekend_enabled} onChange={(v) => save({ weekend_enabled: v })} />
        <Row label="Eskalationen empfangen" checked={prefs.escalations_enabled} onChange={(v) => save({ escalations_enabled: v })} />
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Ruhezeiten</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Von</Label>
            <Input type="time" value={prefs.quiet_hours_start || ''} onChange={(e) => save({ quiet_hours_start: e.target.value || null })} />
          </div>
          <div>
            <Label className="text-xs">Bis</Label>
            <Input type="time" value={prefs.quiet_hours_end || ''} onChange={(e) => save({ quiet_hours_end: e.target.value || null })} />
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">In diesem Zeitraum werden nur dringende Termine und Eskalationen zugestellt.</div>
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm">Privacy-Modus</div>
            <div className="text-xs text-muted-foreground">Push-Nachrichten auf dem Sperrbildschirm enthalten keine Kundennamen. Details erst nach Entsperrung in der App.</div>
          </div>
          <Switch checked={prefs.privacy_mode} onCheckedChange={(v) => save({ privacy_mode: v })} />
        </div>
      </Card>
    </div>
  );
}

function Row({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
