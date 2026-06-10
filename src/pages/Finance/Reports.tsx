import { useEffect, useState } from 'react';
import { BarChart3, Plus, Trash2, Play, Download } from 'lucide-react';
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

const DIMENSIONS = [
  { v: 'tenant', l: 'Mandant' },
  { v: 'account', l: 'Konto' },
  { v: 'cost_center', l: 'Kostenstelle' },
  { v: 'period_month', l: 'Monat' },
  { v: 'period_quarter', l: 'Quartal' },
  { v: 'customer', l: 'Kunde' },
  { v: 'supplier', l: 'Lieferant' },
];
const METRICS = [
  { v: 'revenue', l: 'Umsatz' },
  { v: 'expense', l: 'Aufwand' },
  { v: 'margin', l: 'Marge' },
  { v: 'cashflow', l: 'Cashflow' },
  { v: 'open_items', l: 'Offene Posten' },
  { v: 'invoice_count', l: 'Anzahl Rechnungen' },
];
const VISUALIZATIONS = [
  { v: 'table', l: 'Tabelle' },
  { v: 'bar', l: 'Balkendiagramm' },
  { v: 'line', l: 'Liniendiagramm' },
  { v: 'pie', l: 'Kreisdiagramm' },
  { v: 'kpi', l: 'KPI-Karte' },
];

export default function FinanceReports() {
  const { roles } = useAuth();
  const canEdit = roles.includes('Super Admin') || roles.includes('Admin') || roles.includes('Finance');
  const isSuper = roles.includes('Super Admin');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', description: '',
    dimensions: ['period_month'],
    metrics: ['revenue'],
    visualization: 'table',
    filters: '{}',
    is_shared: false,
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('finance_reports' as any).select('*').order('created_at', { ascending: false });
    setRows((data ?? []) as any[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload: any = { ...form, filters: JSON.parse(form.filters || '{}') };
      const { error } = await supabase.from('finance_reports' as any).insert(payload);
      if (error) throw error;
      toast({ title: 'Bericht gespeichert' });
      setShow(false);
      setForm({ name: '', description: '', dimensions: ['period_month'], metrics: ['revenue'], visualization: 'table', filters: '{}', is_shared: false });
      load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
  };

  const run = async (id: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-report-run', { body: { report_id: id } });
      if (error) throw error;
      toast({ title: 'Bericht ausgeführt', description: `${data?.row_count ?? 0} Zeilen` });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Bericht löschen?')) return;
    const { error } = await supabase.from('finance_reports' as any).delete().eq('id', id);
    if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    else load();
  };

  const toggle = (key: 'dimensions' | 'metrics', v: string) => {
    setForm((f: any) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x: string) => x !== v) : [...f[key], v] }));
  };

  if (loading) return <PageLoading label="Berichte werden geladen…" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Report Builder" subtitle="Eigene Berichte mit Dimensionen, Kennzahlen und Visualisierung" icon={BarChart3}
        actions={canEdit && <Button onClick={() => setShow(true)} className="gap-2"><Plus className="h-4 w-4" />Neuer Bericht</Button>} />

      <DataCard title={`Berichte (${rows.length})`}>
        {rows.length === 0 ? <div className="p-8 text-center text-muted-foreground">Noch keine Berichte angelegt.</div> : (
          <div className="divide-y divide-border">
            {rows.map(r => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {r.name}
                    {r.is_shared && <Badge variant="secondary">geteilt</Badge>}
                    <Badge variant="outline">{r.visualization}</Badge>
                  </div>
                  {r.description && <div className="text-sm text-muted-foreground mt-1">{r.description}</div>}
                  <div className="text-xs text-muted-foreground mt-1">
                    Dimensionen: {(r.dimensions || []).join(', ') || '—'} · Kennzahlen: {(r.metrics || []).join(', ') || '—'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => run(r.id)} disabled={busy}><Play className="h-4 w-4 mr-1" />Run</Button>
                  {isSuper && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Neuer Bericht</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Dimensionen</label>
              <div className="flex flex-wrap gap-2">
                {DIMENSIONS.map(d => (
                  <Badge key={d.v} variant={form.dimensions.includes(d.v) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggle('dimensions', d.v)}>{d.l}</Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Kennzahlen</label>
              <div className="flex flex-wrap gap-2">
                {METRICS.map(m => (
                  <Badge key={m.v} variant={form.metrics.includes(m.v) ? 'default' : 'outline'}
                    className="cursor-pointer" onClick={() => toggle('metrics', m.v)}>{m.l}</Badge>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Visualisierung</label>
              <Select value={form.visualization} onValueChange={v => setForm({ ...form, visualization: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VISUALIZATIONS.map(v => <SelectItem key={v.v} value={v.v}>{v.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Filter (JSON)</label>
              <Textarea value={form.filters} onChange={e => setForm({ ...form, filters: e.target.value })} className="font-mono text-xs" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShow(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={!form.name}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
