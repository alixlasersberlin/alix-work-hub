import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeedbackHeader, Kpi } from './_shared';
import { Zap, Play, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCanDelete } from '@/hooks/useCanDelete';

const TRIGGERS = [
  { value: 'order_delivered', label: 'Auftrag geliefert' },
  { value: 'order_created', label: 'Auftrag erstellt' },
  { value: 'ticket_closed', label: 'Ticket geschlossen' },
  { value: 'service_done', label: 'Servicetermin erledigt' },
  { value: 'repair_done', label: 'Reparatur abgeschlossen' },
  { value: 'academy_done', label: 'Schulung / Academy besucht' },
  { value: 'mediapaket_done', label: 'Mediapaket fertiggestellt' },
];


export default function FeedbackAutomation() {
  const [rules, setRules] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const canDelete = useCanDelete();

  async function load() {
    const sb = supabase as any;
    const [r, ru, sv] = await Promise.all([
      sb.from('survey_automation_rules').select('*').order('created_at', { ascending: false }),
      sb.from('survey_automation_runs').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('surveys').select('id, name, status').is('deleted_at', null).order('name'),
    ]);
    setRules(r.data ?? []); setRuns(ru.data ?? []); setSurveys(sv.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function addRule() {
    const { error } = await (supabase as any).from('survey_automation_rules').insert({
      name: 'Neue Regel', trigger_event: 'order_delivered', delay_days: 3, min_gap_days: 180, active: false,
    });
    if (error) toast.error(error.message); else load();
  }

  async function patch(id: string, values: Record<string, unknown>) {
    setRules(rs => rs.map(r => r.id === id ? { ...r, ...values } : r));
    const { error } = await (supabase as any).from('survey_automation_rules').update(values).eq('id', id);
    if (error) toast.error(error.message);
  }

  async function remove(id: string) {
    if (!confirm('Regel löschen?')) return;
    const { error } = await (supabase as any).from('survey_automation_rules').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Gelöscht'); load(); }
  }

  async function run(ruleId?: string, dry = false) {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('survey-automation', {
      body: { rule_id: ruleId, dry_run: dry },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(dry
      ? `Testlauf: ${(data as any)?.created ?? 0} Treffer, ${(data as any)?.skipped ?? 0} übersprungen`
      : `${(data as any)?.created ?? 0} Einladungen erzeugt`);
    load();
  }

  const okCount = runs.filter(r => r.status === 'ok').length;
  const failCount = runs.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title="Automatisierung"
        subtitle="Umfragen automatisch nach Geschäftsereignissen versenden"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => run(undefined, true)} disabled={busy}>Testlauf</Button>
            <Button variant="outline" onClick={() => run(undefined, false)} disabled={busy}>
              <Play className="h-4 w-4 mr-2" />Jetzt ausführen
            </Button>
            <Button onClick={addRule}><Plus className="h-4 w-4 mr-2" />Neue Regel</Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Aktive Regeln" value={rules.filter(r => r.active).length} icon={Zap} />
        <Kpi label="Erfolgreiche Auslösungen" value={okCount} icon={CheckCircle2} tone="green" />
        <Kpi label="Fehler" value={failCount} icon={AlertTriangle} tone={failCount ? 'red' : undefined} />
      </div>

      <div className="space-y-3">
        {rules.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] items-end">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={r.name} onChange={e => patch(r.id, { name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Auslöser</Label>
                <Select value={r.trigger_event} onValueChange={v => patch(r.id, { trigger_event: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Umfrage</Label>
                <Select value={r.survey_id ?? ''} onValueChange={v => patch(r.id, { survey_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Umfrage wählen" /></SelectTrigger>
                  <SelectContent>
                    {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.status !== 'aktiv' ? ' (inaktiv)' : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={r.active} onCheckedChange={v => patch(r.id, { active: v })} />
                <Button size="sm" variant="ghost" onClick={() => run(r.id, false)} disabled={busy} title="Diese Regel ausführen">
                  <Play className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                <Label>Wartezeit (Tage nach Ereignis)</Label>
                <Input type="number" min={0} value={r.delay_days}
                  onChange={e => patch(r.id, { delay_days: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Mindestabstand je Kunde (Tage)</Label>
                <Input type="number" min={0} value={r.min_gap_days}
                  onChange={e => patch(r.id, { min_gap_days: Number(e.target.value) || 0 })} />
              </div>
              <div className="text-xs text-muted-foreground md:col-span-2">
                Letzter Lauf: {r.last_run_at ? new Date(r.last_run_at).toLocaleString('de-DE') : '–'}
              </div>
            </CardContent>
          </Card>
        ))}
        {rules.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Noch keine Regeln angelegt.</CardContent></Card>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Zeitpunkt</th><th className="p-3">Quelle</th><th className="p-3">E-Mail</th>
                <th className="p-3">Status</th><th className="p-3">Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {runs.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('de-DE')}</td>
                  <td className="p-3 text-muted-foreground">{r.source_ref}</td>
                  <td className="p-3">{r.email}</td>
                  <td className={`p-3 ${r.status === 'ok' ? 'text-emerald-400' : r.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{r.status}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.error_text ?? '–'}</td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Noch keine Auslösungen.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
