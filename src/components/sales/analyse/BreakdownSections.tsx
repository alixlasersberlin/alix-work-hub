import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  computeHeatmap, computePlzZones, computeReps, groupBy, eur, pct, productOf, type OfferRow,
} from '@/lib/sales/offer-analytics';

const COLORS = ['hsl(var(--primary))', '#8b7355', '#a89060', '#c4a86a', '#6b7280', '#94a3b8', '#475569'];

function GroupTable({ title, rows, emptyHint }: { title: string; rows: ReturnType<typeof groupBy>; emptyHint: string }) {
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-display font-semibold text-sm">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium">Kategorie</th>
                <th className="text-right font-medium">Angebote</th>
                <th className="text-right font-medium">Volumen</th>
                <th className="text-right font-medium">Ø Preis</th>
                <th className="text-right font-medium">Gewonnen</th>
                <th className="text-right font-medium">Quote</th>
                <th className="text-right font-medium">Ø Rabatt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/50">
                  <td className="py-2">{r.key}</td>
                  <td className="text-right tabular-nums">{r.count}</td>
                  <td className="text-right tabular-nums">{eur(r.value)}</td>
                  <td className="text-right tabular-nums">{eur(r.avgPrice)}</td>
                  <td className="text-right tabular-nums">{r.won}</td>
                  <td className="text-right tabular-nums">{pct(r.rate, 0)}</td>
                  <td className="text-right tabular-nums">{r.avgDiscount.toFixed(1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function ProductSection({ offers }: { offers: OfferRow[] }) {
  const rows = groupBy(offers, productOf);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <GroupTable title="Produktanalyse" rows={rows} emptyHint="Keine Produktdaten." />
      <Card className="p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm">Volumen je Produkt</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.slice(0, 8)}>
              <XAxis dataKey="key" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={70} tickFormatter={(v) => eur(Number(v))} />
              <Tooltip formatter={(v: any) => eur(Number(v))} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

export function LossSection({ offers }: { offers: OfferRow[] }) {
  const rows = groupBy(offers, (o) => o.loss_reason || (o.declined_reason ? String(o.declined_reason).slice(0, 40) : null));
  const lostValue = offers.filter((o) => o.loss_reason || o.declined_at).reduce((s, o) => s + Number(o.total_gross ?? o.total_net ?? 0), 0);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <GroupTable title="Verlustanalyse" rows={rows} emptyHint="Noch keine Verlustgründe gepflegt." />
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm">Verlorenes Volumen</h3>
          <Badge variant="destructive">{eur(lostValue)}</Badge>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="count" nameKey="key" outerRadius={90} label>
                {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

export function CompetitorSection({ offers }: { offers: OfferRow[] }) {
  return <GroupTable title="Konkurrenzanalyse" rows={groupBy(offers, (o) => o.competitor)} emptyHint="Noch keine Wettbewerber gepflegt." />;
}

export function FinancingSection({ offers }: { offers: OfferRow[] }) {
  return <GroupTable title="Finanzierungsanalyse" rows={groupBy(offers, (o) => o.financing_type)} emptyHint="Noch keine Finanzierungsarten gepflegt." />;
}

export function LeadSection({ offers }: { offers: OfferRow[] }) {
  const rows = groupBy(offers, (o) => o.lead_source);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <GroupTable title="Lead-Herkunft" rows={rows} emptyHint="Noch keine Lead-Quellen gepflegt." />
      <Card className="p-5 space-y-3">
        <h3 className="font-display font-semibold text-sm">Abschlussquote je Kanal</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.slice(0, 10)}>
              <XAxis dataKey="key" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip formatter={(v: any) => pct(Number(v), 0)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
              <Bar dataKey="rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

export function RepSection({ offers }: { offers: OfferRow[] }) {
  const rows = computeReps(offers);
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-display font-semibold text-sm">Verkäufer-Ranking</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-2 font-medium">#</th>
              <th className="text-left font-medium">Verkäufer</th>
              <th className="text-right font-medium">Angebote</th>
              <th className="text-right font-medium">Volumen</th>
              <th className="text-right font-medium">Gewonnen</th>
              <th className="text-right font-medium">Verloren</th>
              <th className="text-right font-medium">Quote</th>
              <th className="text-right font-medium">Ø Wert</th>
              <th className="text-right font-medium">Ø Tage</th>
              <th className="text-right font-medium">Umsatz</th>
              <th className="text-right font-medium">Provision (3 %)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className="border-b border-border/50">
                <td className="py-2 text-muted-foreground">{i + 1}</td>
                <td className="font-medium">{r.name}</td>
                <td className="text-right tabular-nums">{r.count}</td>
                <td className="text-right tabular-nums">{eur(r.volume)}</td>
                <td className="text-right tabular-nums text-emerald-500">{r.won}</td>
                <td className="text-right tabular-nums text-destructive">{r.lost}</td>
                <td className="text-right tabular-nums">{pct(r.rate, 0)}</td>
                <td className="text-right tabular-nums">{eur(r.avgValue)}</td>
                <td className="text-right tabular-nums">{r.avgDays}</td>
                <td className="text-right tabular-nums">{eur(r.revenue)}</td>
                <td className="text-right tabular-nums">{eur(r.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function HeatmapSection({ offers }: { offers: OfferRow[] }) {
  const { weekdays, slots, grid } = computeHeatmap(offers);
  const max = Math.max(1, ...weekdays.flatMap((d) => slots.map((s) => grid[d][s].count)));
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-display font-semibold text-sm">Heatmap — beste Kontaktzeiten</h3>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="w-28" />
              {slots.map((s) => <th key={s} className="px-2 py-1 font-medium text-muted-foreground">{s}</th>)}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((d) => (
              <tr key={d}>
                <td className="pr-3 py-1 text-muted-foreground">{d}</td>
                {slots.map((s) => {
                  const cell = grid[d][s];
                  const intensity = cell.count / max;
                  return (
                    <td key={s} className="p-1">
                      <div
                        className="h-9 w-16 rounded-md flex items-center justify-center tabular-nums"
                        style={{ backgroundColor: `hsl(var(--primary) / ${0.08 + intensity * 0.75})` }}
                        title={`${cell.count} Angebote, ${cell.won} gewonnen`}
                      >
                        {cell.count || ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function MapSection({ offers }: { offers: OfferRow[] }) {
  const zones = computePlzZones(offers);
  const max = Math.max(1, ...zones.map((z) => z.value));
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-display font-semibold text-sm">Regionale Verteilung (PLZ-Zonen, offene Angebote)</h3>
      <div className="space-y-2">
        {zones.map((z) => (
          <div key={z.zone} className="flex items-center gap-3">
            <div className="w-28 text-xs text-muted-foreground">{z.zone}</div>
            <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(z.value / max) * 100}%` }} />
            </div>
            <div className="w-12 text-right text-xs tabular-nums">{z.count}</div>
            <div className="w-28 text-right text-xs tabular-nums text-muted-foreground">{eur(z.value)}</div>
            <div className="w-32 text-right text-[11px]">
              <span className="text-emerald-500">{z.hot} hot</span>
              <span className="text-muted-foreground"> · </span>
              <span className={cn(z.overdue ? 'text-destructive' : 'text-muted-foreground')}>{z.overdue} überfällig</span>
            </div>
          </div>
        ))}
        {zones.length === 0 && <p className="text-xs text-muted-foreground">Keine offenen Angebote mit Adressdaten.</p>}
      </div>
    </Card>
  );
}
