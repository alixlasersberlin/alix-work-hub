import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { computeMonthly, eur, type OfferRow } from '@/lib/sales/offer-analytics';

/** Monatlicher Verlauf: Angebotsvolumen, gewonnenes Volumen und Abschlussquote. */
export function TrendSection({ offers }: { offers: OfferRow[] }) {
  const data = useMemo(() => computeMonthly(offers, 12), [offers]);
  const hasData = data.some((d) => d.count > 0);

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Verlauf (12 Monate)</h3>
        <span className="text-xs text-muted-foreground">Volumen &amp; Abschlussquote</span>
      </div>

      {!hasData ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Keine Angebote im Zeitraum.</p>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground"
                tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }}
                stroke="currentColor" className="text-muted-foreground" tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(value: any, name: string) =>
                  name === 'Abschlussquote' ? [`${Number(value).toFixed(0)} %`, name] : [eur(Number(value)), name]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="value" name="Angebotsvolumen" fill="hsl(var(--muted-foreground))" fillOpacity={0.35} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="wonValue" name="Gewonnen" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey={(d: any) => d.winRate * 100} name="Abschlussquote"
                stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 pt-1">
        {(['count', 'value', 'wonValue'] as const).map((k) => {
          const total = data.reduce((s, d) => s + (d[k] as number), 0);
          const label = k === 'count' ? 'Angebote gesamt' : k === 'value' ? 'Volumen gesamt' : 'Gewonnenes Volumen';
          return (
            <div key={k} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="text-base font-semibold tabular-nums">{k === 'count' ? total : eur(total)}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default TrendSection;
