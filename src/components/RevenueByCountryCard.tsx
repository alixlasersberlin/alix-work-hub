import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Loader2 } from 'lucide-react';

type Period = '1m' | '3m' | '12m';

const PERIODS: { value: Period; label: string }[] = [
  { value: '1m', label: 'Monat' },
  { value: '3m', label: '3 Monate' },
  { value: '12m', label: '1 Jahr' },
];

function startDateFor(period: Period): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === '1m') return d;
  if (period === '3m') { d.setMonth(d.getMonth() - 2); return d; }
  // 12m -> beginning of month 11 months ago = last 12 months including current
  d.setMonth(d.getMonth() - 11);
  return d;
}

function fmtEUR(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default function RevenueByCountryCard() {
  const [period, setPeriod] = useState<Period>('1m');
  const [loading, setLoading] = useState(true);
  const [de, setDe] = useState(0);
  const [at, setAt] = useState(0);

  const since = useMemo(() => startDateFor(period).toISOString().slice(0, 10), [period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount, source_system, order_date')
        .gte('order_date', since)
        .in('source_system', ['zoho_eu_1', 'zoho_eu_2'])
        .limit(10000);
      if (cancelled) return;
      if (error) { setDe(0); setAt(0); setLoading(false); return; }
      let sde = 0, sat = 0;
      for (const r of data || []) {
        const amt = Number((r as any).total_amount) || 0;
        if ((r as any).source_system === 'zoho_eu_1') sde += amt;
        else if ((r as any).source_system === 'zoho_eu_2') sat += amt;
      }
      setDe(sde); setAt(sat); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [since]);

  return (
    <div className="rounded-xl border border-border bg-card card-glow p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Umsatz nach Land</h2>
          <span className="text-xs text-muted-foreground">(nur Super Admin)</span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile flag="🇩🇪" label="Deutschland" value={de} loading={loading} />
        <Tile flag="🇦🇹" label="Austria" value={at} loading={loading} />
        <Tile flag="∑" label="Gesamt" value={de + at} loading={loading} highlight />
      </div>
    </div>
  );
}

function Tile({ flag, label, value, loading, highlight }: { flag: string; label: string; value: number; loading: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border ${highlight ? 'border-primary/40 bg-primary/5' : 'border-border bg-secondary/30'} p-4`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-lg">{flag}</span>
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-display font-semibold text-foreground tabular-nums">
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : fmtEUR(value)}
      </div>
    </div>
  );
}
