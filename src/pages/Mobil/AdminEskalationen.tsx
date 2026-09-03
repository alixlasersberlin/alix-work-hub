import { useEffect, useState } from 'react';
import { AlarmClock, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const ADMIN_ROLES = ['Super Admin', 'Admin', 'Geschäftsführung'];

export default function MobilAdminEskalationen() {
  const { roles } = useAuth() as any;
  const isAdmin = (roles ?? []).some((r: string) => ADMIN_ROLES.includes(r));
  const [rules, setRules] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as any).from('escalation_rules').select('*').order('priority');
    setRules(data ?? []);
    const { data: esc } = await (supabase as any).from('conversation_escalations')
      .select('id, conversation_id, escalation_level, status, scheduled_for, triggered_at')
      .in('status', ['SCHEDULED', 'TRIGGERED']).order('scheduled_for').limit(50);
    setActive(esc ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (rule: any) => {
    setSaving(rule.id);
    const { error } = await (supabase as any).from('escalation_rules').update({
      is_active: rule.is_active,
      first_reminder_minutes: Number(rule.first_reminder_minutes),
      second_reminder_minutes: Number(rule.second_reminder_minutes),
      escalate_minutes: Number(rule.escalate_minutes),
    }).eq('id', rule.id);
    setSaving(null);
    error ? toast.error(`Speichern fehlgeschlagen: ${error.message}`) : toast.success('Regel gespeichert.');
  };

  if (!isAdmin) return <p className="p-4 text-sm text-muted-foreground">Nur für Administratoren.</p>;

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><AlarmClock className="h-5 w-5" /> Eskalationsregeln</h1>

      {rules.map((r, i) => (
        <section key={r.id} className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={r.priority === 'P1' ? 'destructive' : 'secondary'}>{r.priority}</Badge>
            <span className="text-sm font-medium truncate flex-1">{r.name}</span>
            <Switch checked={r.is_active} onCheckedChange={(v) => setRules(rules.map((x, j) => j === i ? { ...x, is_active: v } : x))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['first_reminder_minutes', 'second_reminder_minutes', 'escalate_minutes'] as const).map((k, idx) => (
              <div key={k}>
                <Label className="text-[11px]">{['1. Erinnerung', '2. Erinnerung', 'Eskalation'][idx]} (Min.)</Label>
                <Input type="number" min={1} value={r[k] ?? ''} inputMode="numeric"
                  onChange={(e) => setRules(rules.map((x, j) => j === i ? { ...x, [k]: e.target.value } : x))} />
              </div>
            ))}
          </div>
          <Button size="sm" onClick={() => save(r)} disabled={saving === r.id}>
            <Save className="h-4 w-4 mr-1" /> Speichern
          </Button>
        </section>
      ))}

      <section className="rounded-lg border border-border p-3">
        <h2 className="text-sm font-medium mb-2">Aktive Eskalationen</h2>
        {active.length === 0 ? <p className="text-xs text-muted-foreground">Keine offenen Eskalationen.</p> : active.map((e) => (
          <div key={e.id} className="text-xs border-t border-border py-1.5 first:border-0 flex gap-2">
            <span className="flex-1 truncate">Stufe {e.escalation_level} · {e.status}</span>
            <span className="text-muted-foreground">{new Date(e.scheduled_for).toLocaleString('de-DE')}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
