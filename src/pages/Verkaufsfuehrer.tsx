import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend,
} from 'recharts';

const eur = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

async function fetchAll(table: string, cols: string, apply: (q: any) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply((supabase as any).from(table).select(cols)).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const qKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-Q${Math.floor(dt.getMonth() / 3) + 1}`;
};

type Row = { quarter: string; umsatz: number; auftraege: number; auftragswert: number; offen: number };

export default function Verkaufsfuehrer() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));

  useEffect(() => {
    (async () => {
      try {
        const since = '2023-01-01';
        const [o, i] = await Promise.all([
          fetchAll('orders', 'order_date,total_amount,order_status', (q) => q.gte('order_date', since)),
          fetchAll('zoho_invoices', 'invoice_date,total,balance,status', (q) => q.gte('invoice_date', since)),
        ]);
        setOrders(o.filter((r) => !/cancel|storn|void/i.test(r.order_status ?? '')));
        setInvoices(i.filter((r) => !/void|draft|storn|entwurf/i.test(r.status ?? '')));
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allRows = useMemo<Row[]>(() => {
    const m = new Map<string, Row>();
    const get = (k: string) => {
      if (!m.has(k)) m.set(k, { quarter: k, umsatz: 0, auftraege: 0, auftragswert: 0, offen: 0 });
      return m.get(k)!;
    };
    for (const o of orders) {
      if (!o.order_date) continue;
      const r = get(qKey(o.order_date));
      r.auftraege += 1;
      r.auftragswert += Number(o.total_amount) || 0;
    }
    for (const i of invoices) {
      if (!i.invoice_date) continue;
      const r = get(qKey(i.invoice_date));
      r.umsatz += Number(i.total) || 0;
      r.offen += Math.max(0, Number(i.balance) || 0);
    }
    return [...m.values()].sort((a, b) => a.quarter.localeCompare(b.quarter));
  }, [orders, invoices]);

  const years = useMemo(() => [...new Set(allRows.map((r) => r.quarter.slice(0, 4)))].sort().reverse(), [allRows]);
  const rows = year === 'all' ? allRows : allRows.filter((r) => r.quarter.startsWith(year));
  const sum = rows.reduce(
    (a, r) => ({ umsatz: a.umsatz + r.umsatz, auftraege: a.auftraege + r.auftraege, offen: a.offen + r.offen }),
    { umsatz: 0, auftraege: 0, offen: 0 },
  );

  const tip = {
    contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--popover-foreground))' },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Verkaufsführer</h1>
          <p className="text-sm text-muted-foreground">Umsatz, Aufträge und Offene Posten pro Quartal</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Jahre</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : error ? (
        <p className="text-destructive">Fehler beim Laden: {error}</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Umsatz (Rechnungen)</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{eur(sum.umsatz)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Anzahl Aufträge</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{sum.auftraege.toLocaleString('de-DE')}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Offene Posten</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-destructive">{eur(sum.offen)}</CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Umsatz & Offene Posten</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="quarter" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip {...tip} formatter={(v: number) => eur(v)} />
                    <Legend />
                    <Bar dataKey="umsatz" name="Umsatz" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="offen" name="Offene Posten" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Anzahl Aufträge</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="quarter" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                    <Tooltip {...tip} />
                    <Line type="monotone" dataKey="auftraege" name="Aufträge" stroke="hsl(var(--primary))" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Quartalsübersicht</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2">Quartal</th>
                    <th className="text-right">Umsatz</th>
                    <th className="text-right">Aufträge</th>
                    <th className="text-right">Auftragswert</th>
                    <th className="text-right">Offene Posten</th>
                    <th className="text-right">Offen-Quote</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.quarter} className="border-b border-border/50">
                      <td className="py-2 font-medium">{r.quarter}</td>
                      <td className="text-right">{eur(r.umsatz)}</td>
                      <td className="text-right">{r.auftraege}</td>
                      <td className="text-right">{eur(r.auftragswert)}</td>
                      <td className="text-right text-destructive">{eur(r.offen)}</td>
                      <td className="text-right">{r.umsatz ? `${((r.offen / r.umsatz) * 100).toFixed(1)} %` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">
                Umsatz und Offene Posten nach Rechnungsdatum (ohne Entwürfe/Stornos), Aufträge nach Auftragsdatum (ohne Stornos).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
