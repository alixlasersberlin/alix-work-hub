import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface OrderStatsBarProps {
  orders: Array<{ order_status?: string | null; total_amount?: number | null; currency?: string | null }>;
  filteredCount: number;
  label?: string;
}

export default function OrderStatsBar({ orders, filteredCount, label = 'Aufträge in dieser Abteilung' }: OrderStatsBarProps) {
  const { hasRole } = useAuth();
  const stats = useMemo(() => {
    const total = orders.length;
    const byStatus: Record<string, number> = {};
    let sum = 0;
    let currency = 'EUR';
    for (const o of orders) {
      const s = o.order_status || 'unbekannt';
      byStatus[s] = (byStatus[s] || 0) + 1;
      if (typeof o.total_amount === 'number') sum += Number(o.total_amount);
      if (o.currency) currency = o.currency;
    }
    return { total, byStatus, sum, currency };
  }, [orders]);

  const statusEntries = Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-xl border border-border bg-card/60 card-glow px-4 py-3 mb-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Gesamt:</span>
          <span className="font-semibold text-foreground">{stats.total}</span>
        </div>
        {filteredCount !== stats.total && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Gefiltert:</span>
            <span className="font-semibold text-primary">{filteredCount}</span>
          </div>
        )}
        {stats.sum > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Volumen:</span>
            <span className="font-semibold text-foreground">
              {stats.sum.toLocaleString('de-DE', { style: 'currency', currency: stats.currency })}
            </span>
          </div>
        )}
        {statusEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {statusEntries.map(([s, n]) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground border border-border"
              >
                <span className="capitalize">{s}</span>
                <span className="font-semibold text-foreground">{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
