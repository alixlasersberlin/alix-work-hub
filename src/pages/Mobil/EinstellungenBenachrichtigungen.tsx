import { useEffect, useState } from 'react';
import { BellRing, ShieldCheck, Moon, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { registerPush, revokePush, getPushStatus, sendTestPush, type PushStatus } from '@/lib/mobile/push-registration';

const TOGGLES: { key: string; label: string; hint?: string }[] = [
  { key: 'push_enabled', label: 'Push-Benachrichtigungen' },
  { key: 'new_messages', label: 'Neue WhatsApp-Nachrichten' },
  { key: 'assigned_messages', label: 'Nur mir zugewiesene Vorgänge' },
  { key: 'technical_messages', label: 'Technische Anfragen' },
  { key: 'sales_messages', label: 'Verkaufsanfragen' },
  { key: 'priority_p1', label: 'Priorität P1 (kritisch)' },
  { key: 'priority_p2', label: 'Priorität P2 (hoch)' },
  { key: 'ticket_notifications', label: 'Ticket-Ereignisse' },
  { key: 'escalations_enabled', label: 'Eskalationen' },
  { key: 'sound_enabled', label: 'Ton' },
  { key: 'vibration_enabled', label: 'Vibration' },
  { key: 'badge_enabled', label: 'Badge auf App-Icon' },
  { key: 'preview_enabled', label: 'Nachrichtenvorschau anzeigen', hint: 'Aus = nur „Neue Nachricht eingegangen“' },
];

export default function MobilEinstellungenBenachrichtigungen() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<any>(null);
  const [status, setStatus] = useState<PushStatus>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setStatus(await getPushStatus());
      if (!user?.id) return;
      const { data } = await (supabase as any).from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
      setPrefs(data ?? { user_id: user.id });
    })();
  }, [user?.id]);

  const save = async (patch: Record<string, unknown>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { error } = await (supabase as any).from('notification_preferences')
      .upsert({ ...next, user_id: user!.id }, { onConflict: 'user_id' });
    if (error) toast.error(`Speichern fehlgeschlagen: ${error.message}`);
  };

  const onRegister = async () => {
    setBusy(true);
    const r = await registerPush();
    setStatus(await getPushStatus());
    setBusy(false);
    r.ok ? toast.success(`Gerät registriert (${r.transport}).`) : toast.error(r.error ?? 'Registrierung fehlgeschlagen.');
  };

  const onTest = async () => {
    setBusy(true);
    const r = await sendTestPush();
    setBusy(false);
    r.ok ? toast.success('Test-Push gesendet.') : toast.error(r.error ?? 'Test-Push fehlgeschlagen.');
  };

  if (!prefs) return <p className="p-4 text-sm text-muted-foreground">Lädt …</p>;

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><BellRing className="h-5 w-5" /> Benachrichtigungen</h1>

      <section className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4" /> Dieses Gerät</div>
        <p className="text-xs text-muted-foreground">
          Status: <strong>{status}</strong>
          {status === 'denied' && ' — Berechtigung in den Systemeinstellungen des Geräts freigeben.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onRegister} disabled={busy}>Gerät registrieren</Button>
          <Button size="sm" variant="outline" onClick={onTest} disabled={busy}>Test-Push</Button>
          <Button size="sm" variant="ghost" onClick={async () => { await revokePush(); setStatus(await getPushStatus()); toast.success('Registrierung widerrufen.'); }}>
            Abmelden
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border divide-y divide-border">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <Label className="text-sm">{t.label}</Label>
              {t.hint && <p className="text-[11px] text-muted-foreground">{t.hint}</p>}
            </div>
            <Switch checked={prefs[t.key] ?? true} onCheckedChange={(v) => save({ [t.key]: v })} />
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm flex items-center gap-2"><Moon className="h-4 w-4" /> Ruhezeiten</Label>
          <Switch checked={prefs.quiet_hours_enabled ?? false} onCheckedChange={(v) => save({ quiet_hours_enabled: v })} />
        </div>
        {prefs.quiet_hours_enabled && (
          <>
            <div className="flex gap-2">
              <Input type="time" value={prefs.quiet_hours_start ?? '20:00'} onChange={(e) => save({ quiet_hours_start: e.target.value })} />
              <Input type="time" value={prefs.quiet_hours_end ?? '07:00'} onChange={(e) => save({ quiet_hours_end: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">P1 trotz Ruhezeiten zustellen</Label>
              <Switch checked={prefs.p1_ignores_quiet_hours ?? true} onCheckedChange={(v) => save({ p1_ignores_quiet_hours: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Am Wochenende benachrichtigen</Label>
              <Switch checked={prefs.weekend_enabled ?? true} onCheckedChange={(v) => save({ weekend_enabled: v })} />
            </div>
          </>
        )}
      </section>

      <section className="rounded-lg border border-border p-3 flex items-center justify-between">
        <Label className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Datenschutzmodus (keine Kundendaten im Sperrbildschirm)</Label>
        <Switch checked={prefs.privacy_mode ?? true} onCheckedChange={(v) => save({ privacy_mode: v, preview_enabled: !v })} />
      </section>
    </div>
  );
}
