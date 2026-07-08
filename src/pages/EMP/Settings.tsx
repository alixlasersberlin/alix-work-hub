import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getEmpSettings, setEmpSettings, type EmpSettings } from '@/lib/emp/settings';
import { useState } from 'react';

const ROWS: Array<{ key: keyof EmpSettings; label: string; desc?: string }> = [
  { key: 'darkMode', label: 'Dark Mode' },
  { key: 'pushEnabled', label: 'Push-Benachrichtigungen' },
  { key: 'offlineEnabled', label: 'Offline-Betrieb' },
  { key: 'biometricLock', label: 'Biometrische Sperre (Face/Touch ID vorbereitet)' },
  { key: 'qrEnabled', label: 'QR-Code Check-in' },
  { key: 'signaturesEnabled', label: 'Digitale Unterschriften' },
  { key: 'photosEnabled', label: 'Fotos erlauben' },
];

export default function EmpSettings() {
  const [s, setS] = useState(getEmpSettings());
  const update = (k: keyof EmpSettings, v: any) => setS(setEmpSettings({ [k]: v } as any));

  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-3">
        <div className="text-sm font-semibold">Mobile Einstellungen</div>
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center justify-between">
            <Label className="text-sm">{r.label}</Label>
            <Switch checked={s[r.key] as boolean} onCheckedChange={(v) => update(r.key, v)} />
          </div>
        ))}
      </Card>
      <Card className="p-3 text-xs text-muted-foreground">
        Sensible Daten werden nicht dauerhaft unverschlüsselt lokal gespeichert. Sessions werden automatisch erneuert.
        Remote-Logout ist vorbereitet.
      </Card>
    </div>
  );
}
