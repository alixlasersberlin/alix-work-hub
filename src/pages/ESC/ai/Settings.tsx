import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getSettings, saveSettings } from '@/lib/esc/ai/store';
import type { AiSettings, AiSuggestionKind } from '@/lib/esc/ai/types';

const KIND_LABEL: Record<AiSuggestionKind, string> = {
  schedule: 'Terminvorschläge', resource: 'Ressourcen', route: 'Touren', capacity: 'Kapazität',
  no_show: 'No-Show-Hinweise', follow_up: 'Follow-ups', service: 'Service', training: 'Schulung', reminder: 'Erinnerungen',
};

export default function AiSettings() {
  const [s, setS] = useState<AiSettings>(getSettings());
  const save = () => { saveSettings(s); toast.success('AI-Einstellungen gespeichert'); };
  const patch = (p: Partial<AiSettings>) => setS({ ...s, ...p });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Alix AI · Einstellungen</h1>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Aktivierung</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3 items-center">
          <div className="flex items-center gap-2">
            <Switch checked={s.enabled} onCheckedChange={(v) => patch({ enabled: v })} />
            <Label>KI aktiv</Label>
          </div>
          <div>
            <Label className="text-[11px]">Aktualisierungsintervall (Min)</Label>
            <Input type="number" value={s.refreshIntervalMinutes} onChange={(e) => patch({ refreshIntervalMinutes: Number(e.target.value) || 15 })} />
          </div>
          <div>
            <Label className="text-[11px]">Sprache</Label>
            <Select value={s.language} onValueChange={(v) => patch({ language: v as 'de' | 'en' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Vorschlagsarten</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-2">
          {(Object.keys(KIND_LABEL) as AiSuggestionKind[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <Switch checked={s.kinds[k]} onCheckedChange={(v) => patch({ kinds: { ...s.kinds, [k]: v } })} />
              <Label>{KIND_LABEL[k]}</Label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Schwellenwerte</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div><Label className="text-[11px]">Auslastung Warnung (%)</Label><Input type="number" value={s.utilizationWarnAt} onChange={(e) => patch({ utilizationWarnAt: Number(e.target.value) })} /></div>
          <div><Label className="text-[11px]">Auslastung Kritisch (%)</Label><Input type="number" value={s.utilizationCriticalAt} onChange={(e) => patch({ utilizationCriticalAt: Number(e.target.value) })} /></div>
          <div><Label className="text-[11px]">No-Show Warnung (Score)</Label><Input type="number" value={s.noShowWarnAt} onChange={(e) => patch({ noShowWarnAt: Number(e.target.value) })} /></div>
          <div><Label className="text-[11px]">Prognosehorizont (Tage)</Label><Input type="number" value={s.forecastHorizonDays} onChange={(e) => patch({ forecastHorizonDays: Number(e.target.value) })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Datenschutz & Provider</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <div>
            <Label className="text-[11px]">Externer Anbieter</Label>
            <Select value={s.externalProvider} onValueChange={(v) => patch({ externalProvider: v as AiSettings['externalProvider'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nur intern (empfohlen)</SelectItem>
                <SelectItem value="openai">OpenAI (vorbereitet)</SelectItem>
                <SelectItem value="azure">Azure OpenAI (vorbereitet)</SelectItem>
                <SelectItem value="local">Lokales Modell (vorbereitet)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Switch checked={s.shareSensitiveDataExternally} onCheckedChange={(v) => patch({ shareSensitiveDataExternally: v })} />
            <Label className="text-[12px]">Personenbezogene Daten an externen Provider übertragen (Standard: aus)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save}>Speichern</Button>
      </div>
    </div>
  );
}
