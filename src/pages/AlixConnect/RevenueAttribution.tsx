import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Euro, RefreshCw, Download, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

const MODELS = [
  { v: 'linear', l: 'Linear' },
  { v: 'first', l: 'First Touch' },
  { v: 'last', l: 'Last Touch' },
  { v: 'time_decay', l: 'Time Decay' },
  { v: 'position', l: 'Position-Based' },
];

type Row = {
  id: string; order_id: string; customer_id: string; amount: number;
  currency: string; order_date: string; model: string; channel: string | null;
  weight: number; attributed_amount: number;
};

export default function RevenueAttribution() {
  const [model, setModel] = useState('linear');
  const [days, setDays] = useState(90);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await supabase.from('ac_revenue_attributions' as any)
      .select('*').eq('model', model).gte('order_date', since)
      .order('order_date', { ascending: false }).limit(5000);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [model, days]);

  const compute = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('ac-revenue-attribution', { body: { days } });
      if (error) throw error;
      toast.success('Attribution neu berechnet.');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const byChannel = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.channel ?? '—', (m.get(r.channel ?? '—') ?? 0) + Number(r.attributed_amount)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const total = rows.reduce((s, r) => s + Number(r.attributed_amount), 0);

  const exportCsv = () => {
    const head = 'order_date,order_id,customer_id,model,channel,weight,attributed_amount,currency\n';
    const body = rows.map(r => `${r.order_date},${r.order_id},${r.customer_id},${r.model},${r.channel ?? ''},${r.weight},${r.attributed_amount},${r.currency}`).join('\n');
    const blob = new Blob([head + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `revenue_attribution_${model}_${days}d.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader
        title="Revenue Attribution"
        subtitle="Touchpoint → Umsatz Zuordnung mit 5 Modellen"
        icon={Euro}
        noBreadcrumbs
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button size="sm" onClick={compute} disabled={running}><RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />Neu berechnen</Button>
          </div>
        }
      />

      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Modell</div>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{MODELS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Zeitraum (Tage)</div>
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{[30, 60, 90, 180, 365].map(d => <SelectItem key={d} value={String(d)}>{d} Tage</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Attributed Revenue" value={`€ ${total.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} icon={Euro} accent="gold" />
        <KpiTile label="Rows" value={rows.length} icon={PieChart} accent="sky" />
        <KpiTile label="Kanäle" value={byChannel.length} icon={PieChart} accent="violet" />
        <KpiTile label="Modell" value={model} icon={PieChart} accent="emerald" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Umsatz pro Kanal</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Lädt…</div> : byChannel.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Daten. „Neu berechnen" klicken.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Kanal</TableHead><TableHead className="text-right">Umsatz</TableHead><TableHead className="text-right">Anteil</TableHead></TableRow></TableHeader>
              <TableBody>
                {byChannel.map(([ch, v]) => (
                  <TableRow key={ch}>
                    <TableCell><Badge variant="outline">{ch}</Badge></TableCell>
                    <TableCell className="text-right font-mono">€ {v.toLocaleString('de-DE', { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">{total ? ((v / total) * 100).toFixed(1) : '0'} %</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
