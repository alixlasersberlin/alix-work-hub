import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

type Row = {
  cost_center_id: string;
  code: string;
  name: string;
  revenue: number;
  variable_cost: number;
  fixed_cost: number;
  db1: number;
  db2: number;
};

const fmt = (v: number, cur: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur, maximumFractionDigits: 2 })
    .format(Number(v || 0));

export default function KostenstellenReport() {
  const { region } = useAccountingRegion();
  const cur = region === 'CH' ? 'CHF' : 'EUR';
  const today = new Date();
  const first = new Date(today.getFullYear(), 0, 1);
  const [from, setFrom] = useState(first.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('finance_cost_center_report', {
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
    db1: a.db1 + Number(r.db1),
    db2: a.db2 + Number(r.db2),
  }), { revenue: 0, variable_cost: 0, fixed_cost: 0, db1: 0, db2: 0 }), [rows]);

  const exportCsv = () => {
    const head = ['Code', 'Name', 'Erlöse', 'Variable Kosten', 'Fixkosten', 'DB1', 'DB2'];
    const csv = [head.join(';'), ...rows.map(r => [
      r.code, r.name, r.revenue, r.variable_cost, r.fixed_cost, r.db1, r.db2
    ].join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kostenstellen_${region}_${from}_${to}.csv`;
    a.click();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <PageHeader
        title={`Kostenstellen-Report · ${region === 'CH' ? '🇨🇭 Schweiz' : '🇪🇺 EU'}`}
        subtitle="Ist-Werte pro Kostenstelle mit DB1 / DB2"
        icon={BarChart3}
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div><Label>Von</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <Button onClick={load} disabled={loading}><RefreshCw className="w-4 h-4 mr-2" />Laden</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />CSV</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { l: 'Erlöse', v: totals.revenue },
          { l: 'Variable Kosten', v: totals.variable_cost },
          { l: 'DB1', v: totals.db1 },
          { l: 'Fixkosten', v: totals.fixed_cost },
          { l: 'DB2', v: totals.db2 },
        ].map((k) => (
          <Card key={k.l}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{k.l}</CardTitle></CardHeader>
            <CardContent className="pt-0 text-lg font-semibold">{fmt(k.v, cur)}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Kostenstellen</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Erlöse</TableHead>
                <TableHead className="text-right">Var. Kosten</TableHead>
                <TableHead className="text-right">Fixkosten</TableHead>
                <TableHead className="text-right">DB1</TableHead>
                <TableHead className="text-right">DB2</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Kostenstellen im Zeitraum</TableCell></TableRow>
              )}
              {rows.map(r => (
                <TableRow key={r.cost_center_id}>
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.revenue), cur)}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.variable_cost), cur)}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.fixed_cost), cur)}</TableCell>
                  <TableCell className={`text-right font-semibold ${Number(r.db1) < 0 ? 'text-destructive' : ''}`}>{fmt(Number(r.db1), cur)}</TableCell>
                  <TableCell className={`text-right font-semibold ${Number(r.db2) < 0 ? 'text-destructive' : ''}`}>{fmt(Number(r.db2), cur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
