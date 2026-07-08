import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { getSettings, saveSettings, subscribeEch } from '@/lib/esc/ech/store';
import type { EchCommRule, EchSettings } from '@/lib/esc/ech/types';
import { toast } from 'sonner';

export default function EchNotifications() {
  const [s, setS] = useState<EchSettings>(getSettings());
  useEffect(() => subscribeEch(() => setS(getSettings())), []);
  const save = (next: EchSettings) => { setS(next); saveSettings(next); };

  const addRule = () => save({ ...s, commRules: [...s.commRules, {
    id: crypto.randomUUID(), kind: 'service', active: true,
    steps: [{ when: 'on_create', channel: 'email', templateSlug: 'appointment_confirmed' }],
  }] });
  const patch = (id: string, p: Partial<EchCommRule>) =>
    save({ ...s, commRules: s.commRules.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const remove = (id: string) => save({ ...s, commRules: s.commRules.filter((r) => r.id !== id) });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Kommunikationsregeln</h1>
        <Button size="sm" className="ml-auto" onClick={addRule}><Plus className="w-4 h-4 mr-1" />Regel</Button>
      </div>
      <div className="text-[11.5px] text-muted-foreground">Beispiel: <b>Service</b> → E-Mail bei Anlage → SMS 24h vorher → Push 2h vorher → Feedback-E-Mail nach Termin.</div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Regeln pro Terminart</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {s.commRules.map((r) => (
            <div key={r.id} className="rounded-md border border-border/60 p-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto_auto] gap-2 items-center">
                <div><Label className="text-[10px]">Terminart</Label><Input value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value })} /></div>
                <div className="text-[11.5px] text-muted-foreground">{r.steps.length} Schritte</div>
                <Switch checked={r.active} onCheckedChange={(v) => patch(r.id, { active: v })} />
                <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
              </div>
              <div className="pl-2 space-y-1">
                {r.steps.map((st, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 text-[11.5px]">
                    <span className="text-muted-foreground">{st.when}{st.offsetMinutes ? ` · ${st.offsetMinutes} min` : ''}</span>
                    <span className="uppercase text-primary">{st.channel}</span>
                    <span className="col-span-2 font-mono truncate">{st.templateSlug}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={() => { saveSettings(s); toast.success('Regeln gespeichert'); }}>Speichern</Button>
      </div>
    </div>
  );
}
