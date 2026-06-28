import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAfterSalesCases, type AsCaseListItem } from '@/hooks/useAfterSales';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, BarChart3, HeartPulse, Clock, Star, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const LIGHT_COLORS: Record<string, string> = {
  green: 'hsl(142 71% 45%)',
  yellow: 'hsl(43 96% 56%)',
  red: 'hsl(0 84% 60%)',
};

function daysBetween(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return null;
  const da = new Date(a).getTime(), db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.max(0, Math.round((db - da) / 86_400_000));
}

function toCsv(rows: AsCaseListItem[]) {
  const cols: Array<[string, (c: AsCaseListItem) => unknown]> = [
    ['Auftrag', c => c.order_number ?? ''],
    ['Intern', c => c.internal_number ?? ''],
    ['Kunde', c => c.customer_company ?? c.customer_contact ?? ''],
    ['Kundennummer', c => c.customer_number ?? ''],
    ['Email', c => c.customer_email ?? ''],
    ['Telefon', c => c.customer_phone ?? ''],
    ['Gerät', c => c.device_model ?? ''],
    ['Seriennummer', c => c.device_serial ?? ''],
    ['Bestelldatum', c => c.order_date ?? ''],
    ['Lieferung', c => c.expected_shipment_date ?? ''],
    ['Wert', c => c.total_amount ?? ''],
    ['Währung', c => c.currency ?? ''],
    ['Status', c => c.status],
    ['Ampel', c => c.traffic_light],
    ['Fortschritt %', c => c.progress_pct ?? 0],
    ['Health Score', c => c.health_score ?? ''],
    ['NPS', c => c.satisfaction_rating ?? ''],
    ['Verkäufer', c => c.sales_user_name ?? ''],
    ['Letzter Kontakt', c => c.last_contact_at ?? ''],
    ['Nächster Rückruf', c => c.next_callback_at ?? ''],
    ['Erstellt', c => c.created_at],
    ['Abgeschlossen', c => c.closed_at ?? ''],
  ];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map(c => c[0]).join(';')];
  rows.forEach(r => lines.push(cols.map(c => esc(c[1](r))).join(';')));
  return '\uFEFF' + lines.join('\n');
}

function download(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AfterSalesReports() {
  const open = useAfterSalesCases({ completed: false });
  const closed = useAfterSalesCases({ completed: true });

  const all = useMemo(() => [...(open.data ?? []), ...(closed.data ?? [])], [open.data, closed.data]);

  const kpis = useMemo(() => {
    const openCnt = open.data?.length ?? 0;
    const closedCnt = closed.data?.length ?? 0;
    const total = openCnt + closedCnt;
    const quote = total ? Math.round((closedCnt / total) * 100) : 0;

    const durations = (closed.data ?? [])
      .map(c => daysBetween(c.created_at, c.closed_at))
      .filter((n): n is number => n != null);
    const avgDays = durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : 0;

    const ratings = all.map(c => c.satisfaction_rating).filter((n): n is number => n != null);
    const promoters = ratings.filter(r => r >= 9).length;
    const detractors = ratings.filter(r => r <= 6).length;
    const nps = ratings.length ? Math.round(((promoters - detractors) / ratings.length) * 100) : null;

    const healthVals = all.map(c => c.health_score).filter((n): n is number => n != null);
    const avgHealth = healthVals.length
      ? Math.round(healthVals.reduce((a, b) => a + b, 0) / healthVals.length)
      : null;

    const red = (open.data ?? []).filter(c => c.traffic_light === 'red').length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = (open.data ?? []).filter(c => c.next_callback_at && new Date(c.next_callback_at) < today).length;

    return { openCnt, closedCnt, total, quote, avgDays, nps, avgHealth, red, overdue, ratingsCnt: ratings.length };
  }, [open.data, closed.data, all]);

  const lightData = useMemo(() => {
    const counts = { green: 0, yellow: 0, red: 0 };
    (open.data ?? []).forEach(c => { counts[c.traffic_light] = (counts[c.traffic_light] ?? 0) + 1; });
    return [
      { name: 'Grün', key: 'green', value: counts.green },
      { name: 'Gelb', key: 'yellow', value: counts.yellow },
      { name: 'Rot', key: 'red', value: counts.red },
    ];
  }, [open.data]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; created: number; closed: number }>();
    const monthKey = (d: string) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
    };
    const ensure = (k: string) => {
      if (!map.has(k)) map.set(k, { month: k, created: 0, closed: 0 });
      return map.get(k)!;
    };
    all.forEach(c => { ensure(monthKey(c.created_at)).created++; });
    (closed.data ?? []).forEach(c => { if (c.closed_at) ensure(monthKey(c.closed_at)).closed++; });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [all, closed.data]);

  const sellers = useMemo(() => {
    const map = new Map<string, { name: string; open: number; closed: number }>();
    open.data?.forEach(c => {
      const k = c.sales_user_name ?? 'Unbekannt';
      const e = map.get(k) ?? { name: k, open: 0, closed: 0 };
      e.open++; map.set(k, e);
    });
    closed.data?.forEach(c => {
      const k = c.sales_user_name ?? 'Unbekannt';
      const e = map.get(k) ?? { name: k, open: 0, closed: 0 };
      e.closed++; map.set(k, e);
    });
    return Array.from(map.values())
      .sort((a, b) => (b.open + b.closed) - (a.open + a.closed))
      .slice(0, 8);
  }, [open.data, closed.data]);

  const healthBuckets = useMemo(() => {
    const buckets = [
      { name: '0–20', min: 0, max: 20, count: 0 },
      { name: '21–40', min: 21, max: 40, count: 0 },
      { name: '41–60', min: 41, max: 60, count: 0 },
      { name: '61–80', min: 61, max: 80, count: 0 },
      { name: '81–100', min: 81, max: 100, count: 0 },
    ];
    all.forEach(c => {
      if (c.health_score == null) return;
      const b = buckets.find(x => c.health_score! >= x.min && c.health_score! <= x.max);
      if (b) b.count++;
    });
    return buckets;
  }, [all]);

  const loading = open.isLoading || closed.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> After-Sales Reporting
          </h1>
          <p className="text-sm text-muted-foreground">Kennzahlen, Trends &amp; Exporte für die gesamte After-Sales-Pipeline.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline"><Link to="/crm/after-sales">Dashboard</Link></Button>
          <Button asChild variant="outline"><Link to="/crm/after-sales/erledigt">Abgeschlossene</Link></Button>
          <Button
            variant="default"
            onClick={() => download(`after-sales-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(all))}
            disabled={!all.length}
          >
            <Download className="w-4 h-4 mr-2" /> CSV Export (alle {all.length})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi icon={<HeartPulse className="w-4 h-4" />} label="Offen" value={kpis.openCnt} />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="Abgeschlossen" value={kpis.closedCnt} accent="emerald" />
        <Kpi icon={<CheckCircle2 className="w-4 h-4" />} label="After-Sales-Quote" value={`${kpis.quote}%`} accent="emerald" />
        <Kpi icon={<Clock className="w-4 h-4" />} label="Ø Bearbeitung" value={`${kpis.avgDays} Tage`} />
        <Kpi icon={<Star className="w-4 h-4" />} label="NPS" value={kpis.nps == null ? '—' : kpis.nps} sub={kpis.ratingsCnt ? `${kpis.ratingsCnt} Bewertungen` : 'keine Daten'} />
        <Kpi icon={<HeartPulse className="w-4 h-4" />} label="Ø Health Score" value={kpis.avgHealth ?? '—'} />
        <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Rot / Überfällig" value={`${kpis.red} / ${kpis.overdue}`} accent="rose" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Verlauf (letzte 12 Monate)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {loading ? <Skeleton /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="created" name="Neu" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="closed" name="Abgeschlossen" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ampel-Verteilung (offen)</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {loading ? <Skeleton /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={lightData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {lightData.map(d => <Cell key={d.key} fill={LIGHT_COLORS[d.key]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Verkäufer (offen vs. abgeschlossen)</CardTitle></CardHeader>
          <CardContent style={{ height: 320 }}>
            {loading ? <Skeleton /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sellers} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="open" name="Offen" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="closed" name="Abgeschlossen" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Health Score Verteilung</CardTitle></CardHeader>
          <CardContent style={{ height: 320 }}>
            {loading ? <Skeleton /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthBuckets}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Fälle" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, accent, sub }: {
  icon: React.ReactNode; label: string; value: React.ReactNode;
  accent?: 'rose' | 'emerald'; sub?: string;
}) {
  const tone = accent === 'rose' ? 'text-rose-500' : accent === 'emerald' ? 'text-emerald-500' : 'text-primary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className={tone}>{icon}</span>
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Skeleton() {
  return <div className="h-full w-full rounded bg-muted/40 animate-pulse" />;
}
