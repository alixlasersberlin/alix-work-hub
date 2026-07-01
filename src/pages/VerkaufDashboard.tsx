import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { TrendingUp, Loader2, Radio, Package, ExternalLink } from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

type Period = '1m' | '3m' | '6m' | '12m';
type PageSize = 10 | 20 | 30 | 50 | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: '1m', label: 'Laufender Monat' },
  { value: '3m', label: 'Letzte 3 Monate' },
  { value: '6m', label: 'Letzte 6 Monate' },
  { value: '12m', label: 'Letztes Jahr' },
];
const PAGE_SIZES: PageSize[] = [10, 20, 30, 50, 'all'];

function startDateFor(period: Period): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === '1m') return d;
  const months = period === '3m' ? 2 : period === '6m' ? 5 : 11;
  d.setMonth(d.getMonth() - months);
  return d;
}

function fmtEUR(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}
function fmtDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleDateString('de-DE') : '—';
}

type OrderRow = {
  id: string;
  order_number: string | null;
  internal_number: string | null;
  source_system: string | null;
  order_status: string | null;
  total_amount: number | null;
  order_date: string | null;
  salesperson_name: string | null;
  customers?: { company_name: string | null; contact_name: string | null } | null;
};

type ItemRow = {
  item_name: string | null;
  sku: string | null;
  quantity: number | null;
  amount: number | null;
  orders?: { order_date: string | null; source_system: string | null } | null;
};

export default function VerkaufDashboard() {
  const [period, setPeriod] = useState<Period>('1m');
  const [loading, setLoading] = useState(true);
  const [de, setDe] = useState({ sum: 0, count: 0 });
  const [at, setAt] = useState({ sum: 0, count: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [monthOrders, setMonthOrders] = useState<OrderRow[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  const since = useMemo(() => startDateFor(period).toISOString().slice(0, 10), [period]);
  const monthSince = useMemo(() => startDateFor('1m').toISOString().slice(0, 10), []);

  const load = useCallback(async () => {
    // Aggregates for selected period
    const aggPromise = supabase
      .from('orders')
      .select('total_amount, source_system, order_date')
      .gte('order_date', since)
      .limit(20000);

    // Current-month orders list
    const listPromise = supabase
      .from('orders')
      .select('id, order_number, internal_number, source_system, order_status, total_amount, order_date, salesperson_name, customers(company_name, contact_name)')
      .gte('order_date', monthSince)
      .order('order_date', { ascending: false })
      .limit(500);

    // Sold items in current month
    const itemsPromise = supabase
      .from('order_items')
      .select('item_name, sku, quantity, amount, orders!inner(order_date, source_system)')
      .gte('orders.order_date', monthSince)
      .limit(5000);

    const [aggRes, listRes, itemsRes] = await Promise.all([aggPromise, listPromise, itemsPromise]);

    if (!aggRes.error) {
      let sde = 0, cde = 0, sat = 0, cat = 0;
      for (const r of aggRes.data || []) {
        const amt = Number((r as any).total_amount) || 0;
        const src = (r as any).source_system;
        if (src === 'zoho_eu_2') { sat += amt; cat++; }
        else { sde += amt; cde++; }
      }
      setDe({ sum: sde, count: cde });
      setAt({ sum: sat, count: cat });
    }
    if (!listRes.error) setMonthOrders((listRes.data as any) || []);
    if (!itemsRes.error) setItems((itemsRes.data as any) || []);

    setLastUpdated(new Date());
    setLoading(false);
    setItemsLoading(false);
  }, [since, monthSince]);

  useEffect(() => {
    setLoading(true);
    setItemsLoading(true);
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  useRealtimeRefresh(['orders', 'order_items'], load, { debounceMs: 600 });

  const visibleOrders = useMemo(() => {
    if (pageSize === 'all') return monthOrders;
    return monthOrders.slice(0, pageSize);
  }, [monthOrders, pageSize]);

  const itemStats = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of items) {
      const rawName = (it.item_name || it.sku || '—').toString();
      const name = rawName.replace(/-AT$/, '').trim() || '—';
      const key = name.toLowerCase();
      const qty = Number(it.quantity) || 0;
      const rev = Number(it.amount) || 0;
      const cur = map.get(key) || { name, qty: 0, revenue: 0 };
      cur.qty += qty;
      cur.revenue += rev;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 12);
  }, [items]);

  const totalUnits = itemStats.reduce((s, r) => s + r.qty, 0);
  const distinctItems = itemStats.length;

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Verkauf"
        subtitle="Aufträge nach Land – summiert je Zeitraum"
        noBreadcrumbs
      />

      {/* Summen-Kasten */}
      <Card className="p-5 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs mr-1">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Live</span>
            {lastUpdated && <span className="text-emerald-500/70">· {lastUpdated.toLocaleTimeString('de-DE')}</span>}
          </div>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Tile flag="🇩🇪" label="Alix Deutschland" value={de.sum} count={de.count} loading={loading} />
          <Tile flag="🇦🇹" label="Alix Austria" value={at.sum} count={at.count} loading={loading} />
          <Tile flag="∑" label="Gesamt" value={de.sum + at.sum} count={de.count + at.count} loading={loading} highlight />
        </div>
      </Card>

      {/* Statistik der verkauften Artikel (laufender Monat) */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Verkaufte Artikel · laufender Monat</h2>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {itemsLoading ? '—' : `${distinctItems} Artikel · ${totalUnits} Stück`}
          </div>
        </div>

        {itemsLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : itemStats.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            Keine Artikel im laufenden Monat verkauft
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemStats} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tick={{ fill: 'hsl(var(--foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any, key: any) => key === 'qty' ? [v, 'Stück'] : [fmtEUR(Number(v)), 'Umsatz']}
                />
                <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Auftrags-Liste laufender Monat */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-foreground">Aufträge · laufender Monat</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Anzeigen:</span>
            {PAGE_SIZES.map(s => (
              <button
                key={s}
                onClick={() => setPageSize(s)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  pageSize === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:text-foreground'
                }`}
              >
                {s === 'all' ? 'Alle' : s}
              </button>
            ))}
            <span className="ml-2 tabular-nums">
              {visibleOrders.length} / {monthOrders.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[11px] text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 px-2">Datum</th>
                <th className="text-left py-2 px-2">Auftrag</th>
                <th className="text-left py-2 px-2">Land</th>
                <th className="text-left py-2 px-2">Kunde</th>
                <th className="text-left py-2 px-2">Verkäufer</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-right py-2 px-2">Betrag</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && monthOrders.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground"><Loader2 className="inline w-4 h-4 animate-spin" /></td></tr>
              )}
              {!loading && monthOrders.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Keine Aufträge im laufenden Monat</td></tr>
              )}
              {visibleOrders.map(r => {
                const at = r.source_system === 'zoho_eu_2';
                const num = (r.order_number || r.internal_number || '—') + (at && r.order_number ? '-AT' : '');
                const kunde = r.customers?.company_name || r.customers?.contact_name || '—';
                return (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="py-2 px-2 whitespace-nowrap">{fmtDate(r.order_date)}</td>
                    <td className="py-2 px-2 font-medium whitespace-nowrap">{num}</td>
                    <td className="py-2 px-2">{at ? '🇦🇹' : '🇩🇪'}</td>
                    <td className="py-2 px-2 truncate max-w-[220px]">{kunde}</td>
                    <td className="py-2 px-2 truncate max-w-[140px]">{r.salesperson_name || '—'}</td>
                    <td className="py-2 px-2">{r.order_status || '—'}</td>
                    <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">{fmtEUR(Number(r.total_amount) || 0)}</td>
                    <td className="py-2 px-2">
                      <Link to={`/auftraege/${r.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" /> Öffnen
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Tile({ flag, label, value, count, loading, highlight }: { flag: string; label: string; value: number; count: number; loading: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border ${highlight ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/30'} p-5`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-lg">{flag}</span>
        <span>{label}</span>
      </div>
      <div className="mt-3 text-3xl font-display font-semibold text-foreground tabular-nums">
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : fmtEUR(value)}
      </div>
      <div className="mt-1 text-xs text-muted-foreground tabular-nums">
        {loading ? '—' : `${count} ${count === 1 ? 'Auftrag' : 'Aufträge'}`}
      </div>
    </div>
  );
}
