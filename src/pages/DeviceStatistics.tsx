import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import {
  Search,
  BarChart3,
  Loader2,
  Inbox,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type SortField = 'item_name' | 'order_count' | 'total_quantity' | 'sold_quantity' | 'open_quantity';
type SortDir = 'asc' | 'desc';

// Status buckets
const SOLD_STATUSES = new Set(['geliefert', 'invoiced']);
const OPEN_STATUSES = new Set([
  'open',
  'offen',
  'draft',
  'approved',
  'overdue',
  'teilgeliefert',
  'zurückgestellt',
]);
// Items excluded from all statistics (case-insensitive substring match)
const EXCLUDED_PATTERNS = [
  'alix lieferumfang',
  'alix academy',
  'schulungswochenende',
  'schulungswochende',
  'düsensatz microneedle',
  'nisv fachkunde',
  'm8 microneedle 24 pin',
  'm8 microneedle 40 pin',
  'mediapaket 3',
];

function isExcludedItem(name: string): boolean {
  const n = name.toLowerCase();
  return EXCLUDED_PATTERNS.some(p => n.includes(p));
}

interface DeviceStat {
  item_name: string;
  order_count: number;
  total_quantity: number;
  sold_quantity: number;
  open_quantity: number;
  by_status: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Offen',
  offen: 'Offen',
  draft: 'Entwurf',
  approved: 'Genehmigt',
  overdue: 'Überfällig',
  teilgeliefert: 'Teilgeliefert',
  zurückgestellt: 'Zurückgestellt',
  geliefert: 'Geliefert',
  invoiced: 'Berechnet',
};

export default function DeviceStatistics() {
  const [stats, setStats] = useState<DeviceStat[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_quantity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      // Fetch order_items joined with orders.order_status (paged to avoid 1000-row cap)
      const PAGE = 1000;
      let from = 0;
      const all: { item_name: string | null; quantity: number | null; order_id: string; orders: { order_status: string | null } | null }[] = [];

      while (true) {
        const { data, error: err } = await supabase
          .from('order_items')
          .select('item_name, quantity, order_id, orders:order_id(order_status)')
          .range(from, from + PAGE - 1);

        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // Aggregate by item_name
      const map = new Map<string, {
        order_ids: Set<string>;
        qty: number;
        sold: number;
        open: number;
        by_status: Record<string, number>;
      }>();

      for (const item of all) {
        const name = (item.item_name || '').trim();
        if (!name) continue;
        if (isExcludedItem(name)) continue;

        const status = item.orders?.order_status || 'unbekannt';
        // Skip excluded statuses entirely
        if (status === 'void' || status === 'Anwalt') continue;

        const qty = Number(item.quantity) || 0;
        const entry = map.get(name) || {
          order_ids: new Set<string>(),
          qty: 0,
          sold: 0,
          open: 0,
          by_status: {},
        };
        entry.order_ids.add(item.order_id);
        entry.qty += qty;
        if (SOLD_STATUSES.has(status)) entry.sold += qty;
        else if (OPEN_STATUSES.has(status)) entry.open += qty;
        entry.by_status[status] = (entry.by_status[status] || 0) + qty;
        map.set(name, entry);
      }

      const aggregated: DeviceStat[] = Array.from(map.entries()).map(([name, v]) => ({
        item_name: name,
        order_count: v.order_ids.size,
        total_quantity: v.qty,
        sold_quantity: v.sold,
        open_quantity: v.open,
        by_status: v.by_status,
      }));

      setStats(aggregated);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = stats;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.item_name.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'de') : bVal.localeCompare(aVal, 'de');
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return result;
  }, [stats, search, sortField, sortDir]);

  const totals = useMemo(() => ({
    items: filtered.reduce((s, x) => s + x.total_quantity, 0),
    sold: filtered.reduce((s, x) => s + x.sold_quantity, 0),
    open: filtered.reduce((s, x) => s + x.open_quantity, 0),
  }), [filtered]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'item_name' ? 'asc' : 'desc'); }
  };

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`text-left px-4 py-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors ${className || ''}`}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && <ArrowUpDown className="w-3 h-3 text-primary" />}
      </span>
    </th>
  );

  const maxQty = Math.max(...filtered.map(s => s.total_quantity), 1);

  // Pie chart data: top 8 devices by total quantity, rest grouped as "Sonstige"
  const pieData = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => b.total_quantity - a.total_quantity);
    const TOP = 8;
    const top = sorted.slice(0, TOP).map(s => ({ name: s.item_name, value: s.total_quantity }));
    const rest = sorted.slice(TOP);
    if (rest.length > 0) {
      const restSum = rest.reduce((sum, s) => sum + s.total_quantity, 0);
      if (restSum > 0) top.push({ name: `Sonstige (${rest.length})`, value: restSum });
    }
    return top.filter(d => d.value > 0);
  }, [filtered]);

  const PIE_COLORS = [
    'hsl(45 95% 55%)',   // gold
    'hsl(160 70% 45%)',  // emerald
    'hsl(210 80% 60%)',  // blue
    'hsl(280 65% 60%)',  // purple
    'hsl(20 85% 60%)',   // orange
    'hsl(340 75% 60%)',  // pink
    'hsl(190 70% 50%)',  // cyan
    'hsl(100 55% 50%)',  // green
    'hsl(0 0% 50%)',     // grey for "Sonstige"
  ];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Gerätetypen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} Modelle · {totals.items.toLocaleString('de-DE')} Stück gesamt ·{' '}
            <span className="text-emerald-500 font-medium">{totals.sold.toLocaleString('de-DE')} verkauft</span> ·{' '}
            <span className="text-amber-500 font-medium">{totals.open.toLocaleString('de-DE')} offen</span>
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Modell suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Pie chart: device distribution */}
      {!loading && pieData.length > 0 && (
        <div className="rounded-xl border border-border bg-card card-glow p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Geräteverteilung (Stückzahl)
          </h2>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  paddingAngle={2}
                  label={(entry: any) => {
                    const pct = totals.items > 0 ? (entry.value / totals.items) * 100 : 0;
                    return pct >= 4 ? `${pct.toFixed(1)}%` : '';
                  }}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    color: 'hsl(var(--foreground))',
                  }}
                  formatter={(value: any, name: any) => {
                    const pct = totals.items > 0 ? ((value as number) / totals.items) * 100 : 0;
                    return [`${(value as number).toLocaleString('de-DE')} Stück (${pct.toFixed(1)}%)`, name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="w-10 px-2"></th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium w-10">#</th>
                <SortHeader field="item_name" label="Modell / Artikel" />
                <SortHeader field="order_count" label="Aufträge" className="w-28" />
                <SortHeader field="sold_quantity" label="Verkauft" className="w-28" />
                <SortHeader field="open_quantity" label="Offen" className="w-28" />
                <SortHeader field="total_quantity" label="Gesamt" className="w-28" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Verteilung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">Keine Gerätetypen gefunden.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => {
                  const isOpen = expanded.has(s.item_name);
                  const soldPct = s.total_quantity > 0 ? (s.sold_quantity / s.total_quantity) * 100 : 0;
                  const openPct = s.total_quantity > 0 ? (s.open_quantity / s.total_quantity) * 100 : 0;
                  return (
                    <>
                      <tr
                        key={s.item_name}
                        className="hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(s.item_name)}
                      >
                        <td className="px-2 py-3 text-muted-foreground">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{s.item_name}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.order_count.toLocaleString('de-DE')}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-500 tabular-nums">{s.sold_quantity.toLocaleString('de-DE')}</td>
                        <td className="px-4 py-3 font-semibold text-amber-500 tabular-nums">{s.open_quantity.toLocaleString('de-DE')}</td>
                        <td className="px-4 py-3 font-semibold text-foreground tabular-nums">{s.total_quantity.toLocaleString('de-DE')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden flex">
                              <div className="h-full bg-emerald-500/80" style={{ width: `${soldPct}%` }} />
                              <div className="h-full bg-amber-500/80" style={{ width: `${openPct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                              {totals.items > 0 ? ((s.total_quantity / totals.items) * 100).toFixed(1) : '0.0'}%
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={s.item_name + '-detail'} className="bg-secondary/20">
                          <td></td>
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-xs font-semibold text-emerald-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verkauft
                                </h4>
                                <div className="space-y-1">
                                  {Object.entries(s.by_status)
                                    .filter(([st]) => SOLD_STATUSES.has(st))
                                    .map(([st, qty]) => (
                                      <div key={st} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-card border border-border">
                                        <span className="text-foreground">{STATUS_LABELS[st] || st}</span>
                                        <span className="font-semibold text-emerald-500 tabular-nums">{qty.toLocaleString('de-DE')}</span>
                                      </div>
                                    ))}
                                  {s.sold_quantity === 0 && (
                                    <p className="text-xs text-muted-foreground italic">Keine verkauften Geräte</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                                  <Clock className="w-3.5 h-3.5" /> Offen
                                </h4>
                                <div className="space-y-1">
                                  {Object.entries(s.by_status)
                                    .filter(([st]) => OPEN_STATUSES.has(st))
                                    .map(([st, qty]) => (
                                      <div key={st} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-card border border-border">
                                        <span className="text-foreground">{STATUS_LABELS[st] || st}</span>
                                        <span className="font-semibold text-amber-500 tabular-nums">{qty.toLocaleString('de-DE')}</span>
                                      </div>
                                    ))}
                                  {s.open_quantity === 0 && (
                                    <p className="text-xs text-muted-foreground italic">Keine offenen Geräte</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
