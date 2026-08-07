import { useEffect, useMemo, useState } from 'react';
import { PieChart, RefreshCw, Plus, Trash2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { useAuth } from '@/hooks/useAuth';

type Seg = { id: string; code: string; name: string; description: string | null; is_active: boolean };
type SegRow = {
  segment_id: string; code: string; name: string;
  revenue: number; variable_cost: number; fixed_cost: number; result: number;
};

const fmt = (v: number, cur: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(Number(v || 0));

export default function Segmentbericht() {
  const { region } = useAccountingRegion();
  const { hasRole } = useAuth();
  const canWrite = hasRole('Super Admin') || hasRole('Admin') || hasRole('Buchhaltung Admin')
    || hasRole('Buchhaltung EU') || hasRole('Buchhaltung CH');
  const canDelete = hasRole('Super Admin');
  const cur = region === 'CH' ? 'CHF' : 'EUR';

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        title={`Segmentbericht · ${region === 'CH' ? '🇨🇭 Schweiz' : '🇪🇺 EU'}`}
        subtitle="Geschäftssegmente pflegen und Ergebnis je Segment auswerten"
        icon={PieChart}
      />
      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Auswertung</TabsTrigger>
          <TabsTrigger value="master">Segmente pflegen</TabsTrigger>
        </TabsList>
        <TabsContent value="report"><Report region={region} cur={cur} /></TabsContent>
        <TabsContent value="master"><Master region={region} canWrite={canWrite} canDelete={canDelete} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Report({ region, cur }: { region: 'EU'|'CH'; cur: string }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), 0, 1);
  const [from, setFrom] = useState(first.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<SegRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('finance_segment_report', {
      p_region: region, p_from: from, p_to: to,
    } as any);
    if (error) toast.error(error.message);
    else setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    revenue: a.revenue + Number(r.revenue),
    variable_cost: a.variable_cost + Number(r.variable_cost),
    fixed_cost: a.fixed_cost + Number(r.fixed_cost),
    result: a.result + Number(r.result),
  }), { revenue: 0, variable_cost: 0, fixed_cost: 0, result: 0 }), [rows]);

  const exportCsv = () => {
    const csv = ['Code;Name;Erlöse;Var. Kosten;Fixkosten;Ergebnis',
      ...rows.map(r => `${r.code};${r.name};${r.revenue};${r.variable_cost};${r.fixed_cost};${r.result}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `segmente_${region}_${from}_${to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-2" />Laden</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Erlöse</TableHead>
                <TableHead className="text-right">Var. Kosten</TableHead>
                <TableHead className="text-right">Fixkosten</TableHead>
                <TableHead className="text-right">Ergebnis</TableHead>
                <TableHead className="text-right">Marge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Segmente</TableCell></TableRow>
              )}
              {rows.map(r => {
                const margin = Number(r.revenue) > 0 ? (Number(r.result) / Number(r.revenue)) * 100 : 0;
                return (
                  <TableRow key={r.segment_id}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.revenue), cur)}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.variable_cost), cur)}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.fixed_cost), cur)}</TableCell>
                    <TableCell className={`text-right font-semibold ${Number(r.result) < 0 ? 'text-destructive' : ''}`}>
                      {fmt(Number(r.result), cur)}
                    </TableCell>
                    <TableCell className="text-right">{margin.toFixed(1)} %</TableCell>
                  </TableRow>
                );
              })}
              {rows.length > 0 && (
                <TableRow className="font-semibold bg-muted/50">
                  <TableCell colSpan={2}>Summe</TableCell>
                  <TableCell className="text-right">{fmt(totals.revenue, cur)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.variable_cost, cur)}</TableCell>
                  <TableCell className="text-right">{fmt(totals.fixed_cost, cur)}</TableCell>
                  <TableCell className={`text-right ${totals.result < 0 ? 'text-destructive' : ''}`}>{fmt(totals.result, cur)}</TableCell>
                  <TableCell className="text-right">
                    {totals.revenue > 0 ? ((totals.result / totals.revenue) * 100).toFixed(1) : '0.0'} %
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Master({ region, canWrite, canDelete }: { region: 'EU'|'CH'; canWrite: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<Seg[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '' });

  const load = async () => {
    const { data, error } = await supabase.from('finance_segments')
      .select('*').in('accounting_region', region === 'ALL' ? ['EU','CH'] : [region]).order('code');
    if (error) toast.error(error.message);
    else setRows((data as any) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  const save = async () => {
    if (!form.code || !form.name) return toast.error('Code & Name Pflicht');
    const { error } = await supabase.from('finance_segments').insert({
      accounting_region: (region === 'ALL' ? 'EU' : region), code: form.code, name: form.name, description: form.description || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success('Segment gespeichert');
    setOpen(false); setForm({ code: '', name: '', description: '' }); load();
  };

  const del = async (id: string) => {
    if (!confirm('Segment löschen?')) return;
    const { error } = await supabase.from('finance_segments').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Gelöscht'); load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Segmente</CardTitle>
        {canWrite && <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />Neu</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.description}</TableCell>
                <TableCell className="text-right">
                  {canDelete && <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Keine Segmente</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neues Segment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
