import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, AlarmClock, PlayCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const SETTINGS_KEY = 'bank_return_dunning_escalation';

export interface EscalationConfig {
  enabled: boolean;
  level1AfterDays: number;
  level2AfterDays: number;
  level3AfterDays: number;
  payDays: number;
  maxLevel: number;
}

const DEFAULTS: EscalationConfig = {
  enabled: false,
  level1AfterDays: 0,
  level2AfterDays: 7,
  level3AfterDays: 7,
  payDays: 7,
  maxLevel: 3,
};

/** Einstellungen für die automatische Mahn-Eskalation bei Rücklastschriften. */
export function ReturnDunningEscalationCard() {
  const [cfg, setCfg] = useState<EscalationConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle()
      .then(({ data }) => {
        setCfg({ ...DEFAULTS, ...((data?.value as any) ?? {}) });
        setLoading(false);
      });
  }, []);

  const set = (k: keyof EscalationConfig, v: any) => setCfg(c => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase.from('app_settings') as any)
      .upsert({ key: SETTINGS_KEY, value: cfg as any }, { onConflict: 'key' });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success('Mahn-Eskalation gespeichert');
  };

  const run = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('bank-return-dunning-escalate', {
        body: { dryRun, force: true },
      });
      if (error) throw error;
      const r = data as any;
      if (r?.errors?.length) toast.warning(r.errors.slice(0, 5).join('\n'));
      toast.success(
        dryRun
          ? `${r?.sent ?? 0} Mahnungen wären fällig (${r?.processed ?? 0} geprüft)`
          : `${r?.sent ?? 0} Mahnungen versendet (${r?.processed ?? 0} geprüft)`,
      );
    } catch (e: any) {
      toast.error(e.message ?? 'Lauf fehlgeschlagen');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <Card><CardContent className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></CardContent></Card>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <AlarmClock className="w-4 h-4 text-primary" /> Automatische Mahn-Eskalation (Rücklastschriften)
        </CardTitle>
        <Switch checked={cfg.enabled} onCheckedChange={v => set('enabled', v)} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Der tägliche Lauf prüft bestätigte Rücklastschriften und versendet automatisch die nächste
          Mahnstufe inklusive Sperrankündigung. Bereits bezahlte oder stornierte Vorgänge werden übersprungen.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div><Label>Stufe 1 nach (Tagen)</Label>
            <Input type="number" min={0} value={cfg.level1AfterDays} onChange={e => set('level1AfterDays', Number(e.target.value))} /></div>
          <div><Label>Stufe 2 nach (Tagen)</Label>
            <Input type="number" min={1} value={cfg.level2AfterDays} onChange={e => set('level2AfterDays', Number(e.target.value))} /></div>
          <div><Label>Stufe 3 nach (Tagen)</Label>
            <Input type="number" min={1} value={cfg.level3AfterDays} onChange={e => set('level3AfterDays', Number(e.target.value))} /></div>
          <div><Label>Zahlungsfrist (Tage)</Label>
            <Input type="number" min={1} value={cfg.payDays} onChange={e => set('payDays', Number(e.target.value))} /></div>
          <div><Label>Max. Mahnstufe</Label>
            <Input type="number" min={1} max={3} value={cfg.maxLevel} onChange={e => set('maxLevel', Number(e.target.value))} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Speichern
          </Button>
          <Button variant="outline" onClick={() => run(true)} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}Testlauf (ohne Versand)
          </Button>
          <Button variant="outline" onClick={() => run(false)} disabled={running}>
            Jetzt ausführen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReturnDunningEscalationCard;
