import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { CalendarCog, Save, RefreshCw } from 'lucide-react';

type Settings = {
  stage_days: number[];
  customer_email_enabled: boolean;
  customer_sms_enabled: boolean;
  escalation_amount: number;
  escalation_days: number;
  escalation_role_names: string[];
};

const DEFAULTS: Settings = {
  stage_days: [2, 4, 7, 14, 21],
  customer_email_enabled: false,
  customer_sms_enabled: false,
  escalation_amount: 10000,
  escalation_days: 14,
  escalation_role_names: ['Vertriebsleitung', 'Head of Operations', 'Geschäftsführung'],
};

export default function AngebotsKalenderConfig() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('offer_followup_settings').select('*').eq('id', 1).maybeSingle();
    if (data) {
      setS({
        stage_days: (data.stage_days as number[]) || DEFAULTS.stage_days,
        customer_email_enabled: !!data.customer_email_enabled,
        customer_sms_enabled: !!data.customer_sms_enabled,
        escalation_amount: Number(data.escalation_amount) || 0,
        escalation_days: Number(data.escalation_days) || 0,
        escalation_role_names: (data.escalation_role_names as string[]) || DEFAULTS.escalation_role_names,
      });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from('offer_followup_settings').upsert({
        id: 1,
        stage_days: s.stage_days,
        customer_email_enabled: s.customer_email_enabled,
        customer_sms_enabled: s.customer_sms_enabled,
        escalation_amount: s.escalation_amount,
        escalation_days: s.escalation_days,
        escalation_role_names: s.escalation_role_names,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) throw error;
      toast.success('Einstellungen gespeichert.');
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'unbekannt'));
    } finally {
      setSaving(false);
    }
  }

  async function runEngine() {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('offer-followup-engine', { body: {} });
      if (error) throw error;
      toast.success('Engine ausgeführt.');
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message || 'unbekannt'));
    } finally {
      setRunning(false);
    }
  }

  function setStage(i: number, v: number) {
    const next = [...s.stage_days];
    next[i] = v;
    setS({ ...s, stage_days: next });
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader
        icon={CalendarCog}
        title="Angebotskalender Konfiguration"
        subtitle="Stufen, Kunden-Benachrichtigungen und Eskalationsregeln des Follow-Up Centers."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={runEngine} disabled={running}>
              <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
              Engine starten
            </Button>
            <Button onClick={save} disabled={saving || loading}>
              <Save className="h-4 w-4 mr-2" />
              Speichern
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Nachfass-Stufen (Tage nach Angebotsdatum)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {s.stage_days.map((d, i) => (
            <div key={i}>
              <Label>Stufe {i + 1}</Label>
              <Input
                type="number" min={0}
                value={d}
                onChange={(e) => setStage(i, Number(e.target.value) || 0)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Kunden-Benachrichtigungen</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Kunden-E-Mail Erinnerung</Label>
              <p className="text-sm text-muted-foreground">Automatische E-Mail an den Kunden je Nachfass-Stufe.</p>
            </div>
            <Switch checked={s.customer_email_enabled}
              onCheckedChange={(v) => setS({ ...s, customer_email_enabled: v })} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Kunden-SMS Erinnerung</Label>
              <p className="text-sm text-muted-foreground">Automatische SMS an den Kunden je Nachfass-Stufe.</p>
            </div>
            <Switch checked={s.customer_sms_enabled}
              onCheckedChange={(v) => setS({ ...s, customer_sms_enabled: v })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Eskalation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Eskalations-Betrag (€)</Label>
              <Input type="number" min={0} value={s.escalation_amount}
                onChange={(e) => setS({ ...s, escalation_amount: Number(e.target.value) || 0 })} />
              <p className="text-xs text-muted-foreground mt-1">Angebote ab diesem Brutto-Wert lösen eine Eskalation aus.</p>
            </div>
            <div>
              <Label>Eskalations-Tage</Label>
              <Input type="number" min={0} value={s.escalation_days}
                onChange={(e) => setS({ ...s, escalation_days: Number(e.target.value) || 0 })} />
              <p className="text-xs text-muted-foreground mt-1">Offen länger als X Tage → Eskalation.</p>
            </div>
          </div>
          <div>
            <Label>Empfänger-Rollen (komma-getrennt)</Label>
            <Input
              value={s.escalation_role_names.join(', ')}
              onChange={(e) => setS({
                ...s,
                escalation_role_names: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
              })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Rollen, die bei Eskalation benachrichtigt werden.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
