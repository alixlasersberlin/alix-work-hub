import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  computeAges, computeFunnel, computeKpis, currentMonthOffers, delta, eur, pct,
  previousMonthOffers, type OfferRow,
} from '@/lib/sales/offer-analytics';

function Trend({ value }: { value: number }) {
  const Icon = value > 0.01 ? TrendingUp : value < -0.01 ? TrendingDown : Minus;
  const tone = value > 0.01 ? 'text-emerald-500' : value < -0.01 ? 'text-destructive' : 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', tone)}>
      <Icon className="h-3.5 w-3.5" />
      {(value * 100).toFixed(0)} %
    </span>
  );
}

function Kpi({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number }) {
  return (
    <Card className="p-4 space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-bold text-foreground tabular-nums">{value}</div>
      <div className="flex items-center gap-2">
        {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
        {trend !== undefined && <Trend value={trend} />}
      </div>
    </Card>
  );
}

export function KpiSection({ offers }: { offers: OfferRow[] }) {
  const k = computeKpis(offers);
  const cur = computeKpis(currentMonthOffers(offers));
  const prev = computeKpis(previousMonthOffers(offers));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <Kpi label="Offene Angebote (Wert)" value={eur(k.openValue)} sub={`${k.openCount} Angebote`} />
      <Kpi label="Ø Angebotswert" value={eur(k.avgValue)} trend={delta(cur.avgValue, prev.avgValue)} />
      <Kpi label="Angebote heute" value={String(k.todayCount)} sub={`${k.monthCount} in diesem Monat`} />
      <Kpi label="Abschlussquote" value={pct(k.winRate, 1)} trend={delta(cur.winRate, prev.winRate)} />
      <Kpi label="Ø Zeit bis Abschluss" value={`${k.avgDaysToClose.toFixed(1)} Tage`} />
      <Kpi label="Ø Rabatt" value={`${k.avgDiscount.toFixed(1)} %`} />
      <Kpi label="Erwarteter Umsatz (gewichtet)" value={eur(k.expectedRevenue)} sub="Pipeline × Wahrscheinlichkeit" />
      <Kpi label="Angebote diesen Monat" value={String(cur.monthCount)} trend={delta(cur.monthCount, prev.monthCount)} />
      <Kpi label="Gewonnenes Volumen" value={eur(offers.filter((o) => o.status === 'order' || o.status === 'signed').reduce((s, o) => s + Number(o.total_gross ?? o.total_net ?? 0), 0))} />
      <Kpi label="Angebote gesamt" value={String(offers.length)} />
    </div>
  );
}

export function FunnelSection({ offers }: { offers: OfferRow[] }) {
  const rows = computeFunnel(offers);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Vertriebsfunnel</h3>
        <span className="text-xs text-muted-foreground">Ø Verweildauer je Phase</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.code} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-xs text-muted-foreground">{r.label}</div>
            <div className="flex-1">
              <Progress value={(r.count / max) * 100} className="h-3" />
            </div>
            <div className="w-16 text-right text-xs tabular-nums">{r.count}</div>
            <div className="w-28 text-right text-xs tabular-nums text-muted-foreground">{eur(r.value)}</div>
            <div className="w-20 text-right text-xs tabular-nums text-muted-foreground">{r.avgDays} T.</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AgeSection({ offers }: { offers: OfferRow[] }) {
  const rows = computeAges(offers);
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-display font-semibold text-sm">Angebotsalter (offene Angebote)</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className={cn(
              'rounded-lg border p-3 space-y-1',
              r.critical && r.count > 0 ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted/20',
            )}
          >
            <div className="text-[11px] text-muted-foreground">{r.label}</div>
            <div className="text-lg font-semibold tabular-nums">{r.count}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">{eur(r.value)}</div>
            {r.critical && r.count > 0 && <Badge variant="destructive" className="text-[10px]">kritisch</Badge>}
          </div>
        ))}
      </div>
    </Card>
  );
}
