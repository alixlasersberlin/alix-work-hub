import { useEffect, useState } from 'react';
import { CalendarClock, Plus, Trash2, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const CRONS = [
  { v: '0 7 * * 1', l: 'Wöchentlich (Mo 07:00)' },
  { v: '0 7 1 * *', l: 'Monatlich (1., 07:00)' },
  { v: '0 7 1 */3 *', l: 'Quartalsweise (07:00)' },
  { v: '0 7 1 1 *', l: 'Jährlich (01.01., 07:00)' },
];

export default function FinanceReportSchedules() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Admin') || roles.includes('Finance');
  const isSuper = roles.includes('Super Admin');
  const [rows, setRows] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', report_id: '', cron_expression: '0 7 1 * *',
    recipients: '', output_format: 'pdf', enabled: true,
  });

  const load = async () => {
    setLoading(true);
    const [{ data: r1 }, { data: r2 }] = await Promise.all([
      supabase.from('finance_report_schedules' as any).select('*, finance_reports(name)').order('created_at', { ascending: false }),
      supabase.from('finance_reports' as any).select('id,name').order('name'),
    ]);
    setRows((r1 ?? []) as any[]);
    setReports((r2 ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload: any = {
        ...form,
        recipients: form.recipients.split(',').map((s: string) => s.trim()).filter(Boolean),
      };
      const { error } = await supabase.from('finance_report_schedules' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Zeitplan gespeichert' });
      setShow(false);
      setForm({ name: '', report_id: '', cron_expression: '0 7 1 * *', recipients: '', output_format: 'pdf', enabled: true });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
  };

  const toggleEnabled = async (r: any) => {
    await supabase.from('finance_report_schedules' as any).update({ enabled: !r.enabled }).eq('id', r.id);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Zeitplan löschen?')) return;
    await supabase.from('finance_report_schedules' as any).delete().eq('id', id);
    load();
  };

  if (loading) return <PageLoading label="Zeitpläne werden geladen…" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Berichts-Zeitpläne" subtitle="Geplante Berichte automatisch erstellen und versenden" icon={CalendarClock}
        actions={canEdit && <Button onClick={() => setShow(true)} className="gap-2"><Plus className="h-4 w-4" />Neuer Zeitplan</Button>} />

      <DataCard title={`Zeitpläne (${rows.length})`}>
        {rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">Keine Zeitpläne aktiv.</div> : (
          <div className="divide-y divide-border">
            {rows.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {r.name}
                    <Badge variant={r.enabled ? 'default' : 'secondary'}>{r.enabled ? 'aktiv' : 'pausiert'}</Badge>
                    <Badge variant="outline">{r.output_format.toUpperCase()}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Bericht: {r.finance_reports?.name ?? '—'} · Cron: <code>{r.cron_expression}</code>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Empfänger: {(r.recipients || []).join(', ') || '—'} · Letzter Lauf: {r.last_run_at ? new Date(r.last_run_at).toLocaleString('de-DE') : 'nie'}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canEdit && <Button size="sm" variant="outline" onClick={() => toggleEnabled(r)}><Power className="h-4 w-4" /></Button>}
                  {isSuper && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Zeitplan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Bericht</label>
              <Select value={form.report_id} onValueChange={v => setForm({ ...form, report_id: v })}>
                <SelectTrigger><SelectValue placeholder="Bericht wählen" /></SelectTrigger>
                <SelectContent>{reports.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Frequenz</label>
              <Select value={form.cron_expression} onValueChange={v => setForm({ ...form, cron_expression: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CRONS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Format</label>
              <Select value={form.output_format} onValueChange={v => setForm({ ...form, output_format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Empfänger (E-Mails, komma-separiert)</label>
              <Input value={form.recipients} onChange={e => setForm({ ...form, recipients: e.target.value })} placeholder="cfo@firma.de, controlling@firma.de" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={!form.name || !form.report_id}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
