/**
 * ADMIN · MOBILE COMMAND CENTER (Prompt 6) – Feature Flags und SLA-Schwellen.
 * Änderungen greifen für alle Mobile-Clients; Schwellwerte werden nicht im
 * Code hartkodiert.
 */
import { useEffect, useState } from 'react';
import { Settings2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  CC_FLAG_KEYS, SLA_KEYS, fetchCcFlags, fetchSlaThresholds, setSetting,
  type CcFlags, type CcFlagKey, type SlaKey,
} from '@/lib/mobil/command';

const FLAG_LABEL: Record<CcFlagKey, string> = {
  command_center_enabled: 'Command Center',
  team_presence_enabled: 'Teamstatus / Presence',
  supervisor_cockpit_enabled: 'Supervisor Cockpit',
  magic_search_enabled: 'Magic Search',
  follow_up_reminders_enabled: 'Follow-up Reminder',
  shift_handover_enabled: 'Schichtübergabe',
  management_kpis_enabled: 'Management KPIs',
  ai_daily_brief_enabled: 'AI Briefing',
};

const SLA_LABELS: Record<SlaKey, string> = {
  sla_p1_warn_minutes: 'P1 · bald fällig (Min.)',
  sla_p1_overdue_minutes: 'P1 · überfällig (Min.)',
  sla_p2_warn_minutes: 'P2 · bald fällig (Min.)',
  sla_p2_overdue_minutes: 'P2 · überfällig (Min.)',
  sla_default_warn_minutes: 'Standard · bald fällig (Min.)',
  sla_default_overdue_minutes: 'Standard · überfällig (Min.)',
};

export default function MobilAdminCommandCenter() {
  const [flags, setFlags] = useState<CcFlags | null>(null);
  const [sla, setSla] = useState<Record<SlaKey, number> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCcFlags().then(setFlags).catch(() => toast.error('Einstellungen konnten nicht geladen werden.'));
    fetchSlaThresholds().then(setSla).catch(() => {});
  }, []);

  const toggle = async (k: CcFlagKey, v: boolean) => {
    if (!flags) return;
    setFlags({ ...flags, [k]: v });
    try { await setSetting(k, String(v)); } catch { toast.error('Speichern fehlgeschlagen.'); }
  };

  const saveSla = async () => {
    if (!sla) return;
    setSaving(true);
    try {
      for (const k of SLA_KEYS) await setSetting(k, String(sla[k]));
      toast.success('SLA-Schwellen gespeichert.');
    } catch { toast.error('Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2"><Settings2 className="w-5 h-5" /> Mobile Command Center</h1>

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Feature Flags</div>
        {!flags && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        {flags && CC_FLAG_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1">
            <span className="text-sm">{FLAG_LABEL[k]}</span>
            <Switch checked={flags[k]} onCheckedChange={(v) => toggle(k, v)} />
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">SLA-Schwellen</div>
        <p className="text-[11px] text-muted-foreground">
          Gilt für die Anzeige im Command Center. Die Eskalationsregeln aus dem Eskalations-Admin bleiben führend.
        </p>
        {sla && SLA_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="text-sm flex-1">{SLA_LABELS[k]}</span>
            <Input
              type="number" inputMode="numeric" className="h-10 w-24"
              value={sla[k]}
              onChange={(e) => setSla({ ...sla, [k]: Number(e.target.value) })}
            />
          </div>
        ))}
        <Button className="h-11 w-full" onClick={saveSla} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SLA-Schwellen speichern'}
        </Button>
      </Card>
    </div>
  );
}
