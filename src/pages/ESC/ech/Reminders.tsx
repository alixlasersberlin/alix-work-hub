import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BellRing, Plus, Trash2 } from 'lucide-react';
import { getSettings, saveSettings, subscribeEch } from '@/lib/esc/ech/store';
import type { EchReminderRule, EchSettings, EchChannel } from '@/lib/esc/ech/types';
import { toast } from 'sonner';

const CHANNELS: EchChannel[] = ['email', 'sms', 'whatsapp', 'push', 'calendar_invite'];

export default function EchReminders() {
  const [s, setS] = useState<EchSettings>(getSettings());
  useEffect(() => subscribeEch(() => setS(getSettings())), []);
  const save = (next: EchSettings) => { setS(next); saveSettings(next); };

  const addRule = () => {
    const r: EchReminderRule = { id: crypto.randomUUID(), label: 'Neue Regel', offsetMinutes: 60, channels: ['email'], active: true };
    save({ ...s, reminderRules: [...s.reminderRules, r] });
  };
  const patch = (id: string, p: Partial<EchReminderRule>) =>
    save({ ...s, reminderRules: s.reminderRules.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const remove = (id: string) => save({ ...s, reminderRules: s.reminderRules.filter((r) => r.id !== id) });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Erinnerungsregeln</h1>
        <Button size="sm" className="ml-auto" onClick={addRule}><Plus className="w-4 h-4 mr-1" />Regel</Button>
      </div>
      <div className="text-[11.5px] text-muted-foreground">Beispiele: 30 Tage, 14 Tage, 7 Tage, 3 Tage, 24h, 2h, 30 Min vorher · nach Termin. Beliebig kombinierbar.</div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Regeln</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border/50">
          {s.reminderRules.map((r) => (
            <div key={r.id} className="py-2 grid grid-cols-1 md:grid-cols-[1fr_120px_1fr_auto_auto] gap-2 items-center">
              <Input value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} />
              <div>
                <Label className="text-[10px]">Offset (Min, negativ = danach)</Label>
                <Input type="number" value={r.offsetMinutes} onChange={(e) => patch(r.id, { offsetMinutes: Number(e.target.value) })} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    onClick={() => patch(r.id, { channels: r.channels.includes(c) ? r.channels.filter((x) => x !== c) : [...r.channels, c] })}
                    className={`text-[10.5px] px-2 py-0.5 rounded-md border ${r.channels.includes(c) ? 'bg-primary/15 text-primary border-primary/30' : 'border-border/60 text-muted-foreground'}`}
                  >{c}</button>
                ))}
              </div>
              <Switch checked={r.active} onCheckedChange={(v) => patch(r.id, { active: v })} />
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => { saveSettings(s); toast.success('Erinnerungsregeln gespeichert'); }}>Speichern</Button>
      </div>
    </div>
  );
}
