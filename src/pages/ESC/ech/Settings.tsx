import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Shield } from 'lucide-react';
import { getSettings, saveSettings, subscribeEch } from '@/lib/esc/ech/store';
import type { EchLanguage, EchSettings } from '@/lib/esc/ech/types';
import { ECH_LANGUAGES } from '@/lib/esc/ech/types';
import { toast } from 'sonner';

export default function EchSettingsPage() {
  const [s, setS] = useState<EchSettings>(getSettings());
  useEffect(() => subscribeEch(() => setS(getSettings())), []);
  const patch = (p: Partial<EchSettings>) => setS({ ...s, ...p });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Communication Hub · Einstellungen</h1>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Absender</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div><Label className="text-[11px]">Absender-Name</Label><Input value={s.fromName} onChange={(e) => patch({ fromName: e.target.value })} /></div>
          <div><Label className="text-[11px]">Absender-E-Mail</Label><Input value={s.fromEmail} onChange={(e) => patch({ fromEmail: e.target.value })} /></div>
          <div><Label className="text-[11px]">SMS-Sender-ID</Label><Input value={s.smsSenderId ?? ''} onChange={(e) => patch({ smsSenderId: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Sprachen & Standards</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px]">Standard-Sprache</Label>
            <Select value={s.defaultLanguage} onValueChange={(v) => patch({ defaultLanguage: v as EchLanguage })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ECH_LANGUAGES.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[11px]">Aktive Sprachen</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ECH_LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  onClick={() => patch({ activeLanguages: s.activeLanguages.includes(l.id) ? s.activeLanguages.filter((x) => x !== l.id) : [...s.activeLanguages, l.id] })}
                  className={`text-[11.5px] px-2 py-1 rounded-md border ${s.activeLanguages.includes(l.id) ? 'bg-primary/15 text-primary border-primary/30' : 'border-border/60 text-muted-foreground'}`}
                >{l.label}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Automatik</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3 items-center">
          <div className="flex items-center gap-2"><Switch checked={s.autoSendCalendarInvite} onCheckedChange={(v) => patch({ autoSendCalendarInvite: v })} /><Label>Kalendereinladung automatisch senden</Label></div>
          <div className="flex items-center gap-2"><Switch checked={s.autoRequestFeedback} onCheckedChange={(v) => patch({ autoRequestFeedback: v })} /><Label>Feedback nach Termin anfordern</Label></div>
          <div>
            <Label className="text-[11px]">Konfliktlösung Kalender-Sync</Label>
            <Select value={s.conflictResolution} onValueChange={(v) => patch({ conflictResolution: v as EchSettings['conflictResolution'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manuell</SelectItem>
                <SelectItem value="auto_prefer_local">Automatisch – AlixWorks bevorzugen</SelectItem>
                <SelectItem value="auto_prefer_remote">Automatisch – Extern bevorzugen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Sicherheit</CardTitle></CardHeader>
        <CardContent className="text-[12.5px] text-muted-foreground space-y-1">
          <div>· Kalender-Feed-Tokens werden zufällig erzeugt und können jederzeit widerrufen werden.</div>
          <div>· Keine geheimen Provider-Schlüssel im Browser – Versand erfolgt serverseitig über Edge-Funktionen (vorbereitet).</div>
          <div>· Kommunikationsprotokolle sind nur für berechtigte Benutzer sichtbar (Aurora-RBAC).</div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => { saveSettings(s); toast.success('Einstellungen gespeichert'); }}>Speichern</Button>
      </div>
    </div>
  );
}
