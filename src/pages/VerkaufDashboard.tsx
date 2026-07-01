import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { TrendingUp, Loader2, Radio } from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';


type Period = '1m' | '3m' | '6m' | '12m';

const PERIODS: { value: Period; label: string }[] = [
  { value: '1m', label: 'Laufender Monat' },
  { value: '3m', label: 'Letzte 3 Monate' },
  { value: '6m', label: 'Letzte 6 Monate' },
  { value: '12m', label: 'Letztes Jahr' },
];

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

export default function VerkaufDashboard() {
  const [period, setPeriod] = useState<Period>('1m');
  const [loading, setLoading] = useState(true);
  const [de, setDe] = useState({ sum: 0, count: 0 });
  const [at, setAt] = useState({ sum: 0, count: 0 });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const since = useMemo(() => startDateFor(period).toISOString().slice(0, 10), [period]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('total_amount, source_system, order_date')
      .gte('order_date', since)
      .limit(20000);
    if (error) { setDe({ sum: 0, count: 0 }); setAt({ sum: 0, count: 0 }); setLoading(false); return; }
    let sde = 0, cde = 0, sat = 0, cat = 0;
    for (const r of data || []) {
      const amt = Number((r as any).total_amount) || 0;
      const src = (r as any).source_system;
      if (src === 'zoho_eu_2') { sat += amt; cat++; }
      else { sde += amt; cde++; }
    }
    setDe({ sum: sde, count: cde });
    setAt({ sum: sat, count: cat });
    setLastUpdated(new Date());
    setLoading(false);
  }, [since]);

  useEffect(() => {
    setLoading(true);
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  useRealtimeRefresh(['orders'], load, { debounceMs: 600 });


  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Verkauf"
        subtitle="Aufträge nach Land – summiert je Zeitraum"
        noBreadcrumbs
      />

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
