import { useEffect, useState } from 'react';
import { Workflow, Plus, Play, Trash2, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const TRIGGERS = [
  { v: 'invoice_threshold', l: 'Eingangsrechnung ab Schwellwert' },
  { v: 'anomaly_detected', l: 'Anomalie erkannt' },
  { v: 'reminder_stage_reached', l: 'Mahnstufe erreicht' },
  { v: 'forecast_deviation', l: 'Forecast-Abweichung' },
  { v: 'payment_matched', l: 'Zahlung gematcht' },
];
const ACTIONS = [
  { v: 'assign_approver', l: 'Genehmiger zuweisen' },
  { v: 'set_status', l: 'Status setzen' },
  { v: 'notify', l: 'Notification' },
  { v: 'send_email', l: 'E-Mail senden' },
  { v: 'trigger_ai_insight', l: 'KI-Analyse triggern' },
];

export default function FinanceAutomations() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Admin');
  const isSuper = roles.includes('Super Admin');
  const [rows, setRows] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', description: '', trigger_type: 'invoice_threshold',
    action_type: 'assign_approver', condition_json: '{"amount_gross_gte":1000}',
    action_config: '{}', active: true,
  });

  const load = async () => {
    setLoading(true);
    const [{ data: r1 }, { data: r2 }] = await Promise.all([
      supabase.from('finance_automations' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('finance_automation_runs' as any).select('*').order('executed_at', { ascending: false }).limit(50),
    ]);
    setRows((r1 ?? []) as any[]);
    setRuns((r2 ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload: any = { ...form };
      payload.condition_json = JSON.parse(form.condition_json || '{}');
      payload.action_config = JSON.parse(form.action_config || '{}');
      const { error } = await supabase.from('finance_automations' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Regel angelegt' });
      setShow(false);
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
  };

  const toggle = async (r: any) => {
    await supabase.from('finance_automations' as any).update({ active: !r.active }).eq('id', r.id);
    load();
  };
  const remove = async (r: any) => {
    if (!confirm('Regel löschen?')) return;
    await supabase.from('finance_automations' as any).delete().eq('id', r.id);
    load();
  };
  const runNow = async () => {
    setBusy(true);
    try {
      await supabase.functions.invoke('finance-automations-engine');
      toast({ title: 'Engine gestartet' });
      load();
    } catch (e: any) { toast({ title: 'Fehler', description: e.message, variant: 'destructive' }); }
    setBusy(false);
  };

  if (loading) return <PageLoading />;
  return (
    <div className="space-y-6">
      <PageHeader title="Finance Automations" subtitle={"Regel-basierte Workflow-Engine"} icon={Workflow} actions={<>
        <Button variant="outline" onClick={runNow} disabled={busy}><Play className="h-4 w-4 mr-2" />Jetzt ausführen</Button>
        {canEdit && <Button onClick={() => setShow(true)}><Plus className="h-4 w-4 mr-2" />Neue Regel</Button>}
      </>} />

      <DataCard title={`${rows.length} Regeln`}>
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.name}</span>
                  <Badge variant={r.active ? 'default' : 'secondary'}>{r.active ? 'Aktiv' : 'Inaktiv'}</Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.trigger_type} → {r.action_type}</div>
                {r.last_run_at && <div className="text-xs text-muted-foreground">Zuletzt: {new Date(r.last_run_at).toLocaleString('de-DE')}</div>}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle(r)}><Power className="h-4 w-4" /></Button>
                  {isSuper && <Button size="sm" variant="outline" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">Noch keine Regeln</div>}
        </div>
      </DataCard>

      <DataCard title="Letzte Ausführungen">
        <div className="space-y-1 max-h-96 overflow-auto">
          {runs.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm p-2 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Badge variant={r.status === 'success' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                <span className="text-muted-foreground">{r.trigger_event}</span>
                <span>{r.message}</span>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(r.executed_at).toLocaleString('de-DE')}</span>
            </div>
          ))}
          {runs.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">Noch keine Ausführungen</div>}
        </div>
      </DataCard>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Automations-Regel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <Textarea placeholder="Beschreibung" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <Select value={form.trigger_type} onValueChange={v => setForm({ ...form, trigger_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder='Bedingung JSON, z.B. {"amount_gross_gte":1000}' value={form.condition_json} onChange={e => setForm({ ...form, condition_json: e.target.value })} className="font-mono text-xs" />
            <Select value={form.action_type} onValueChange={v => setForm({ ...form, action_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIONS.map(a => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder='Aktions-Config JSON, z.B. {"status":"geprueft"}' value={form.action_config} onChange={e => setForm({ ...form, action_config: e.target.value })} className="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
