/**
 * SECURITY CENTER (Prompt 7, Punkt 8/11/12/13/86)
 * Biometrie, App-PIN, Auto-Lock, Push-Vorschau, Geräte & Sitzungen.
 */
import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Timer, Smartphone, Loader2, LogOut, ShieldCheck, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { APP_VERSION_MOBILE } from '@/lib/mobil/appInfo';
import {
  AUTO_LOCK_OPTIONS, biometricSupported, clearPin, disableBiometric, enableBiometric,
  getAutoLockMinutes, hasBiometric, hasPin, listMyDevices, type MobileDevice,
  pushPreviewEnabled, revokeAllOtherDevices, revokeDevice, setAutoLockMinutes, setPin,
  setPushPreview, touchTrustedDevice, wipeLocalSensitiveData,
} from '@/lib/mobil/security';

function fmt(d?: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
}

export default function MobilSicherheit() {
  const { user, profile, signOut } = useAuth();
  const [bioSupported, setBioSupported] = useState(false);
  const [bioOn, setBioOn] = useState(hasBiometric());
  const [pinOn, setPinOn] = useState(hasPin());
  const [pinInput, setPinInput] = useState('');
  const [lock, setLock] = useState(getAutoLockMinutes());
  const [preview, setPreview] = useState(pushPreviewEnabled());
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await touchTrustedDevice(APP_VERSION_MOBILE);
      setDevices(await listMyDevices());
    } catch (e: any) {
      toast.error('Geräte konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { biometricSupported().then(setBioSupported); void load(); }, [load]);

  const toggleBio = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        await enableBiometric(user!.id, profile?.email || 'AlixWork');
        setBioOn(true);
        toast.success('Biometrische Entsperrung aktiviert.');
      } else {
        disableBiometric();
        setBioOn(false);
      }
      await touchTrustedDevice(APP_VERSION_MOBILE);
    } catch (e: any) {
      toast.error(e?.message || 'Biometrie nicht verfügbar.');
    } finally { setBusy(false); }
  };

  const savePin = async () => {
    try {
      await setPin(pinInput);
      setPinOn(true); setPinInput('');
      await touchTrustedDevice(APP_VERSION_MOBILE);
      toast.success('App-PIN gesetzt.');
    } catch (e: any) { toast.error(e?.message || 'PIN ungültig.'); }
  };

  const removePin = async () => {
    clearPin(); setPinOn(false);
    await touchTrustedDevice(APP_VERSION_MOBILE);
    toast.success('App-PIN entfernt.');
  };

  const onRevoke = async (id: string, self: boolean) => {
    setBusy(true);
    try {
      await revokeDevice(id);
      if (self) { wipeLocalSensitiveData(); await signOut(); return; }
      toast.success('Gerät abgemeldet.');
      await load();
    } catch { toast.error('Abmelden fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  const onRevokeOthers = async () => {
    setBusy(true);
    try {
      await revokeAllOtherDevices();
      toast.success('Alle anderen Geräte abgemeldet.');
      await load();
    } catch { toast.error('Abmelden fehlgeschlagen.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Sicherheit</h1>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Fingerprint className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Mit Face ID / Touch ID entsperren</div>
              <div className="text-[11px] text-muted-foreground">
                {bioSupported ? 'Nutzt ausschliesslich die Geräte-Biometrie. Keine biometrischen Daten werden gespeichert.' : 'Auf diesem Gerät nicht verfügbar.'}
              </div>
            </div>
          </div>
          <Switch checked={bioOn} disabled={!bioSupported || busy} onCheckedChange={toggleBio} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /><span className="text-sm font-medium">App-PIN (4–6 Ziffern)</span></div>
        {pinOn ? (
          <div className="flex items-center justify-between">
            <Badge variant="secondary">aktiv</Badge>
            <Button size="sm" variant="outline" onClick={removePin}>PIN entfernen</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input type="password" inputMode="numeric" maxLength={6} value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="PIN" className="h-11 tracking-[0.4em] text-center" />
            <Button className="h-11" disabled={pinInput.length < 4} onClick={savePin}>Setzen</Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Die PIN wird nur als kryptografischer Hash auf diesem Gerät gespeichert – niemals im Klartext und niemals auf dem Server.</p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2"><Timer className="w-5 h-5 text-primary" /><span className="text-sm font-medium">Automatisch sperren</span></div>
        <div className="flex flex-wrap gap-2">
          {AUTO_LOCK_OPTIONS.map((m) => (
            <Button key={m} size="sm" variant={lock === m ? 'default' : 'outline'}
              onClick={() => { setAutoLockMinutes(m); setLock(m); }}>
              {m === 0 ? 'sofort' : `${m} Min.`}
            </Button>
          ))}
        </div>
        {!pinOn && !bioOn && <p className="text-[11px] text-amber-500">Wirkt erst, wenn PIN oder Biometrie aktiv ist.</p>}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <EyeOff className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Push-Vorschau anzeigen</div>
              <div className="text-[11px] text-muted-foreground">Aus: Benachrichtigungen zeigen keinen Nachrichtentext auf dem Sperrbildschirm.</div>
            </div>
          </div>
          <Switch checked={preview} onCheckedChange={(v) => { setPushPreview(v); setPreview(v); }} />
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /><span className="text-sm font-medium">Geräte & Sitzungen</span></div>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        {devices.length === 0 && !loading && <div className="text-xs text-muted-foreground">Keine registrierten Geräte.</div>}
        {devices.map((d) => (
          <div key={d.device_id} className="border border-border rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium truncate">{d.device_name || 'Unbekanntes Gerät'}</span>
              {d.is_current && <Badge>dieses Gerät</Badge>}
              {d.revoked_at && <Badge variant="destructive">abgemeldet</Badge>}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {d.platform || '—'} · zuletzt aktiv {fmt(d.last_seen_at)} · registriert {fmt(d.created_at)}
              {d.push_registered ? ' · Push aktiv' : ''}
            </div>
            {!d.revoked_at && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onRevoke(d.device_id, d.is_current)}>
                {d.is_current ? 'Dieses Gerät abmelden' : 'Gerät abmelden'}
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" className="w-full" disabled={busy} onClick={onRevokeOthers}>
          Alle anderen Geräte abmelden
        </Button>
      </Card>

      <Button variant="ghost" className="w-full h-12 text-destructive"
        onClick={async () => { wipeLocalSensitiveData({ keepUnlockMethods: true }); await signOut(); }}>
        <LogOut className="w-4 h-4 mr-2" /> Abmelden & lokalen Cache löschen
      </Button>
    </div>
  );
}
