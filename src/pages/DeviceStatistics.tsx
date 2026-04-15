import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search, BarChart3, Loader2, Inbox, ArrowUpDown } from 'lucide-react';

type SortField = 'item_name' | 'order_count' | 'total_quantity';
type SortDir = 'asc' | 'desc';

interface DeviceStat {
  item_name: string;
  order_count: number;
  total_quantity: number;
}

export default function DeviceStatistics() {
  const [stats, setStats] = useState<DeviceStat[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('total_quantity');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('order_items')
        .select('item_name, quantity, order_id');

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      // Aggregate by item_name
      const map = new Map<string, { order_ids: Set<string>; qty: number }>();
      for (const item of data ?? []) {
        const name = (item.item_name || '').trim();
        if (!name) continue;
        const entry = map.get(name) || { order_ids: new Set(), qty: 0 };
        entry.order_ids.add(item.order_id);
        entry.qty += Number(item.quantity) || 0;
        map.set(name, entry);
      }

      const aggregated: DeviceStat[] = Array.from(map.entries()).map(([name, v]) => ({
        item_name: name,
        order_count: v.order_ids.size,
        total_quantity: v.qty,
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

  const totalItems = filtered.reduce((sum, s) => sum + s.total_quantity, 0);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir(field === 'item_name' ? 'asc' : 'desc'); }
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

  // Find max quantity for bar visualization
  const maxQty = Math.max(...filtered.map(s => s.total_quantity), 1);

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Gerätetypen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} Modelle · {totalItems.toLocaleString('de-DE')} Stück gesamt
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

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium w-10">#</th>
                <SortHeader field="item_name" label="Modell / Artikel" />
                <SortHeader field="order_count" label="Aufträge" className="w-32" />
                <SortHeader field="total_quantity" label="Stückzahl" className="w-32" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Verteilung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">Keine Gerätetypen gefunden.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((s, idx) => (
                  <tr key={s.item_name} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{s.item_name}</td>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{s.order_count.toLocaleString('de-DE')}</td>
                    <td className="px-4 py-3 font-semibold text-foreground tabular-nums">{s.total_quantity.toLocaleString('de-DE')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all"
                            style={{ width: `${(s.total_quantity / maxQty) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                          {((s.total_quantity / totalItems) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
