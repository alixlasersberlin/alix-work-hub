import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export default function SalesForecast() {
  const [lookback, setLookback] = useState(90);
  const [horizon, setHorizon] = useState(30);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("ac-sales-forecast", {
        body: { lookback_days: lookback, horizon_days: horizon },
      });
      if (error) throw error;
      setData(res);
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Laden");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const chart = useMemo(() => {
    if (!data) return [];
    const past = (data.series ?? []).map((s: any) => ({ date: s.date, ist: s.revenue }));
    const fc = (data.forecast ?? []).map((f: any) => ({ date: f.date, forecast: f.revenue, low: f.low, high: f.high }));
    return [...past, ...fc];
  }, [data]);

  const trend = data?.totals?.trend_pct_per_day ?? 0;

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Sales Forecast &amp; Pipeline Intelligence</h1>
        <Badge variant="outline">Phase 46</Badge>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Parameter</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground">Lookback (Tage)</label>
            <Input type="number" min={14} max={180} value={lookback} onChange={e => setLookback(Number(e.target.value))} className="w-28" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Horizont (Tage)</label>
            <Input type="number" min={7} max={90} value={horizon} onChange={e => setHorizon(Number(e.target.value))} className="w-28" />
          </div>
          <Button onClick={load} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Aktualisieren</>}
          </Button>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi label="Umsatz Lookback" value={fmt(data.totals.past_revenue)} />
            <Kpi label={`Forecast ${horizon} Tage`} value={fmt(data.totals.forecast_revenue)} />
            <Kpi label="Ø Tagesumsatz" value={fmt(data.totals.avg_daily)} />
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Trend / Tag</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold flex items-center gap-2">
                {trend >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-500" /> : <TrendingDown className="h-5 w-5 text-red-500" />}
                {trend >= 0 ? "+" : ""}{trend.toFixed(2)}%
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Umsatzverlauf &amp; Prognose</CardTitle></CardHeader>
            <CardContent style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} />
                  <Legend />
                  <Area type="monotone" dataKey="high" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.08} name="Konfidenzband" />
                  <Area type="monotone" dataKey="low" stroke="none" fill="hsl(var(--background))" fillOpacity={1} />
                  <Line type="monotone" dataKey="ist" stroke="hsl(var(--primary))" dot={false} name="Ist-Umsatz" />
                  <Line type="monotone" dataKey="forecast" stroke="hsl(var(--primary))" strokeDasharray="4 3" dot={false} name="Forecast" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Umsatz pro Quellsystem</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Quelle</TableHead><TableHead className="text-right">Umsatz</TableHead><TableHead className="text-right">Anteil</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.per_source.map((s: any) => {
                    const share = data.totals.past_revenue > 0 ? (s.revenue / data.totals.past_revenue) * 100 : 0;
                    return (
                      <TableRow key={s.source}>
                        <TableCell>{s.source}</TableCell>
                        <TableCell className="text-right">{fmt(s.revenue)}</TableCell>
                        <TableCell className="text-right">{share.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}
