import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { BUDGET_CATEGORIES, MONTH_NAMES, fmt, classifyTx, mapIncomingCategory } from './_controlling';

type Scenario = 'base' | 'best' | 'worst';

export default function FinanceForecast() {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [scenario, setScenario] = useState<Scenario>('base');
  const [forecast, setForecast] = useState<Record<string, number[]>>({});
  const [actual, setActual] = useState<Record<string, number[]>>({});

  async function load() {
    setLoading(true);
    const s = `${year}-01-01`, e = `${year}-12-31`;
    const [f, t, ii] = await Promise.all([
      supabase.from('finance_forecasts' as any).select('*').eq('scenario', scenario).gte('period_date', s).lte('period_date', e),
      supabase.from('finance_transactions').select('amount, transaction_type, booking_date').gte('booking_date', s).lte('booking_date', e),
      supabase.from('finance_incoming_invoices').select('amount_net, amount_gross, invoice_date, description').gte('invoice_date', s).lte('invoice_date', e),
    ]);
    const fMap: Record<string, number[]> = {};
    for (const cat of BUDGET_CATEGORIES) fMap[cat] = Array(12).fill(0);
    for (const r of (f.data ?? []) as any[]) {
      const m = new Date(r.period_date).getMonth();
      if (!fMap[r.category]) fMap[r.category] = Array(12).fill(0);
      fMap[r.category][m] = Number(r.forecast_amount) || 0;
    }
    setForecast(fMap);

    const aMap: Record<string, number[]> = {};
    for (const cat of BUDGET_CATEGORIES) aMap[cat] = Array(12).fill(0);
    for (const r of t.data ?? []) {
      const c = classifyTx(r);
      if (!c) continue;
      aMap[c][new Date(r.booking_date).getMonth()] += Math.abs(Number(r.amount) || 0);
    }
    for (const r of (ii.data ?? []) as any[]) {
      const c = mapIncomingCategory(r.description);
      aMap[c][new Date(r.invoice_date).getMonth()] += Number(r.amount_net || r.amount_gross) || 0;
    }
    setActual(aMap);
    setLoading(false);
  }

  useEffect(() => { load(); }, [year, scenario]);

  function update(cat: string, m: number, v: string) {
    const n = Number(v.replace(',', '.')) || 0;
    setForecast(prev => ({ ...prev, [cat]: prev[cat].map((x, i) => i === m ? n : x) }));
  }

  async function autoInit() {
    const now = new Date();
    const isCurrent = year === now.getFullYear();
    const factor = scenario === 'best' ? 1.15 : scenario === 'worst' ? 0.85 : 1;
    const next: Record<string, number[]> = {};
    for (const cat of BUDGET_CATEGORIES) {
      next[cat] = Array(12).fill(0);
      const ist = actual[cat] || Array(12).fill(0);
      const ytd = isCurrent ? ist.slice(0, now.getMonth() + 1) : ist;
      const lastN = ytd.slice(-3).filter(v => v > 0);
      const avg = lastN.length ? lastN.reduce((a, b) => a + b, 0) / lastN.length : 0;
      for (let m = 0; m < 12; m++) {
        if (isCurrent && m <= now.getMonth()) next[cat][m] = ist[m];
        else next[cat][m] = Math.round(avg * factor);
      }
    }
    setForecast(next);
    toast.success('Forecast initialisiert (noch nicht gespeichert)');
  }

  async function save() {
    const rows: any[] = [];
    for (const cat of Object.keys(forecast)) {
      for (let m = 0; m < 12; m++) {
        rows.push({
          period_date: `${year}-${String(m + 1).padStart(2, '0')}-01`,
          category: cat,
          scenario,
          forecast_amount: forecast[cat][m] || 0,
        });
      }
    }
    const { error } = await supabase.from('finance_forecasts' as any).upsert(rows, { onConflict: 'tenant_id,period_date,category,scenario' });
    if (error) return toast.error(error.message);
    toast.success('Forecast gespeichert');
  }

  const chart = useMemo(() => {
    const istSum = (actual['Umsatz'] || []).map(v => v);
    const fcSum = (forecast['Umsatz'] || []).map(v => v);
    return MONTH_NAMES.map((m, i) => ({ month: m, Ist: istSum[i] || 0, Forecast: fcSum[i] || 0 }));
  }, [actual, forecast]);

  if (loading) return <PageLoading />;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Rolling Forecast" subtitle={`Prognose ${year} · Szenario ${scenario}`} />

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{[year + 1, year, year - 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={scenario} onValueChange={v => setScenario(v as Scenario)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="base">Base</SelectItem>
            <SelectItem value="best">Best Case (+15%)</SelectItem>
            <SelectItem value="worst">Worst Case (-15%)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={autoInit}><Sparkles className="h-4 w-4 mr-2" />Auto-Init</Button>
        <Button onClick={save}><Save className="h-4 w-4 mr-2" />Speichern</Button>
      </div>

      <DataCard title="Umsatz – Ist vs. Forecast">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="Ist" stroke="hsl(var(--primary))" strokeWidth={2} />
              <Line type="monotone" dataKey="Forecast" stroke="hsl(var(--accent))" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </DataCard>

      <DataCard title="Forecast-Tabelle (editierbar)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-3 py-2 text-left">Kategorie</th>
                {MONTH_NAMES.map(m => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
                <th className="px-3 py-2 text-right">Jahr</th>
              </tr>
            </thead>
            <tbody>
              {BUDGET_CATEGORIES.map(cat => {
                const arr = forecast[cat] || Array(12).fill(0);
                return (
                  <tr key={cat} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium">{cat}</td>
                    {arr.map((v, i) => (
                      <td key={i} className="px-1 py-1">
                        <input
                          type="number"
                          value={v}
                          onChange={e => update(cat, i, e.target.value)}
                          className="h-8 w-20 px-2 text-right tabular-nums bg-background border border-border rounded"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(arr.reduce((a, b) => a + b, 0))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataCard>
    </div>
  );
}
