import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/infinity/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Play, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

type Cfg = {
  id?: string; enabled: boolean; channel: "email"|"sms"|"both";
  first_after_days: number; second_after_days: number; third_after_days: number;
  max_reminders: number; quiet_hours_start: string; quiet_hours_end: string; weekend_pause: boolean;
};

const DEFAULT: Cfg = {
  enabled: false, channel: "email",
  first_after_days: 3, second_after_days: 10, third_after_days: 21, max_reminders: 3,
  quiet_hours_start: "20:00", quiet_hours_end: "08:00", weekend_pause: true,
};

export default function AlixSmartSettings() {
  const { hasRole, loading: authLoading } = useAuth();
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    supabase.from("alixsmart_reminder_settings").select("*").limit(1).maybeSingle().then(({ data }) => {
      if (data) setCfg({ ...DEFAULT, ...data, quiet_hours_start: String(data.quiet_hours_start).slice(0,5), quiet_hours_end: String(data.quiet_hours_end).slice(0,5) });
      setLoading(false);
    });
  }, []);

  if (authLoading) return null;
  if (!(hasRole("Super Admin") || hasRole("Admin"))) return <Navigate to="/" replace />;

  async function save() {
    setSaving(true);
    const payload: any = { ...cfg, updated_at: new Date().toISOString() };
    const { error } = cfg.id
      ? await supabase.from("alixsmart_reminder_settings").update(payload).eq("id", cfg.id)
      : await supabase.from("alixsmart_reminder_settings").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Einstellungen gespeichert");
  }

  async function runNow() {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("alixsmart-reminders-cron", { body: {} });
    setRunning(false);
    if (error) return toast.error(error.message);
    toast.success(`Cron ok: ${data?.email_sent ?? 0} Emails, ${data?.sms_sent ?? 0} SMS gesendet`);
  }

  if (loading) return <div className="p-6 text-muted-foreground">Lade …</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="AlixSmart Erinnerungs-Automatik"
        subtitle="Regeln für automatische Erinnerungen an nicht registrierte Kunden"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runNow} disabled={running}>
              <Play className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} /> Jetzt ausführen
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> Speichern
            </Button>
          </div>
        }
      />

      <div className="rounded-lg border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Automatik aktiv</Label>
            <p className="text-sm text-muted-foreground">Stündlicher Cron sendet Erinnerungen nach diesen Regeln.</p>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Kanal</Label>
            <Select value={cfg.channel} onValueChange={(v: any) => setCfg({ ...cfg, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Nur E-Mail</SelectItem>
                <SelectItem value="sms">Nur SMS</SelectItem>
                <SelectItem value="both">E-Mail + SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Max. Erinnerungen pro Kunde</Label>
            <Input type="number" min={1} max={10} value={cfg.max_reminders}
              onChange={(e) => setCfg({ ...cfg, max_reminders: +e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>1. Erinnerung nach (Tage)</Label>
            <Input type="number" min={0} value={cfg.first_after_days}
              onChange={(e) => setCfg({ ...cfg, first_after_days: +e.target.value })} />
          </div>
          <div>
            <Label>2. Erinnerung nach (Tage)</Label>
            <Input type="number" min={0} value={cfg.second_after_days}
              onChange={(e) => setCfg({ ...cfg, second_after_days: +e.target.value })} />
          </div>
          <div>
            <Label>3. Erinnerung nach (Tage)</Label>
            <Input type="number" min={0} value={cfg.third_after_days}
              onChange={(e) => setCfg({ ...cfg, third_after_days: +e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ruhezeit Start</Label>
            <Input type="time" value={cfg.quiet_hours_start}
              onChange={(e) => setCfg({ ...cfg, quiet_hours_start: e.target.value })} />
          </div>
          <div>
            <Label>Ruhezeit Ende</Label>
            <Input type="time" value={cfg.quiet_hours_end}
              onChange={(e) => setCfg({ ...cfg, quiet_hours_end: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Wochenend-Pause</Label>
            <p className="text-sm text-muted-foreground">Samstag und Sonntag werden übersprungen.</p>
          </div>
          <Switch checked={cfg.weekend_pause} onCheckedChange={(v) => setCfg({ ...cfg, weekend_pause: v })} />
        </div>
      </div>
    </div>
  );
}
