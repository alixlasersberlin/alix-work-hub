import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

type Row = {
  id: string; amount: number; currency: string; order_date: string;
  model: string; channel: string | null; campaign_id: string | null;
  journey_id: string | null; attributed_amount: number;
};

export default function RevenueIntelligence() {
  const [model, setModel] = useState('linear');
  const [days, setDays] = useState(90);
  const [rows, setRows] = useState<Row[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [forecasting, setForecasting] = useState(false);

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

  const runForecast = async () => {
    setForecasting(true);
    const { data, error } = await supabase.functions.invoke('ac-revenue-forecast', {
      body: { model, days },
    });
    if (error) toast.error(error.message);
    else { setForecast(data); toast.success('Forecast aktualisiert'); }
    setForecasting(false);
  };

  useEffect(() => { load(); }, [model, days]);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.attributed_amount || 0), 0);
    const byChannel = new Map<string, number>();
    const byCampaign = new Map<string, number>();
    const byJourney = new Map<string, number>();
    for (const r of rows) {
      const amt = Number(r.attributed_amount || 0);
      byChannel.set(r.channel ?? '—', (byChannel.get(r.channel ?? '—') ?? 0) + amt);
      if (r.campaign_id) byCampaign.set(r.campaign_id, (byCampaign.get(r.campaign_id) ?? 0) + amt);
      if (r.journey_id) byJourney.set(r.journey_id, (byJourney.get(r.journey_id) ?? 0) + amt);
    }
    const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { total, orders: rows.length, byChannel: top(byChannel), byCampaign: top(byCampaign), byJourney: top(byJourney) };
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Revenue Intelligence"
        subtitle="Pipeline-Impact, ROI-Cockpit & Forecast pro Kanal / Kampagne / Journey"
        icon={TrendingUp}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['linear','first','last','time_decay','position'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[30, 60, 90, 180, 365].map(d => <SelectItem key={d} value={String(d)}>{d} Tage</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Laden</Button>
        <Button onClick={runForecast} disabled={forecasting}><Sparkles className="mr-2 h-4 w-4" />Forecast</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiTile label="Attributed Revenue" value={`€ ${stats.total.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} />
        <KpiTile label="Attributed Orders" value={String(stats.orders)} />
        <KpiTile label="Ø / Order" value={`€ ${(stats.orders ? stats.total / stats.orders : 0).toFixed(0)}`} />
        <KpiTile label="Forecast 30 Tage" value={forecast ? `€ ${Number(forecast.forecast_30 ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(['byChannel','byCampaign','byJourney'] as const).map((k, idx) => (
          <Card key={k}>
            <CardHeader><CardTitle className="text-sm">{['Kanäle','Kampagnen','Journeys'][idx]}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead className="text-right">€</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(stats as any)[k].map(([id, amt]: [string, number]) => (
                    <TableRow key={id}>
                      <TableCell className="max-w-[180px] truncate text-xs">{id}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{amt.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</TableCell>
                    </TableRow>
                  ))}
                  {(stats as any)[k].length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-xs text-muted-foreground">Keine Daten</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      {forecast && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Forecast · Trend & Konfidenz</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4 text-sm">
            <div>30 Tage: <strong>€ {Number(forecast.forecast_30 ?? 0).toLocaleString('de-DE')}</strong></div>
            <div>60 Tage: <strong>€ {Number(forecast.forecast_60 ?? 0).toLocaleString('de-DE')}</strong></div>
            <div>90 Tage: <strong>€ {Number(forecast.forecast_90 ?? 0).toLocaleString('de-DE')}</strong></div>
            <div>Trend: <Badge variant="outline">{forecast.trend ?? '—'}</Badge></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
