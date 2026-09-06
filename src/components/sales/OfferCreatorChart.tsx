import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { OfferSnapshot } from '@/lib/offers-store';

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export type CreatorStat = {
  name: string;
  total: number;
  offen: number;
  unterzeichnet: number;
  volumen: number;
  schnitt: number;
  quote: number;
};

export function buildCreatorStats(offers: OfferSnapshot[], isSigned: (o: OfferSnapshot) => boolean): CreatorStat[] {
  const map = new Map<string, CreatorStat>();
  for (const o of offers) {
    const name = o.createdByName || '—';
    const row = map.get(name) || { name, total: 0, offen: 0, unterzeichnet: 0, volumen: 0, schnitt: 0, quote: 0 };
    row.total += 1;
    if (isSigned(o)) row.unterzeichnet += 1; else row.offen += 1;
    row.volumen += Number(o.totals?.gross || 0);
    map.set(name, row);
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, schnitt: r.total ? r.volumen / r.total : 0, quote: r.total ? r.unterzeichnet / r.total : 0 }))
    .sort((a, b) => b.total - a.total);
}

export function OfferCreatorChart({ stats }: { stats: CreatorStat[] }) {
  const [open, setOpen] = useState(true);
  const data = useMemo(() => stats.map((s) => ({ ...s, label: s.name })), [stats]);
  if (!data.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <CardTitle>Angebote nach Ersteller</CardTitle>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
      </CardHeader>
      {open && (
      <CardContent className="space-y-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval={0} angle={-15} textAnchor="end" height={56} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  color: 'hsl(var(--popover-foreground))',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" name="Total" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="offen" name="Offen" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="unterzeichnet" name="Unterzeichnet" fill="hsl(142 70% 45%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Ersteller</th>
                <th className="py-1 pr-3 font-medium text-right">Total</th>
                <th className="py-1 pr-3 font-medium text-right">Offen</th>
                <th className="py-1 pr-3 font-medium text-right">Unterzeichnet</th>
                <th className="py-1 pr-3 font-medium text-right">Ø Angebotswert</th>
                <th className="py-1 font-medium text-right">Quote</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.name} className="border-t border-border/60">
                  <td className="py-1.5 pr-3">{s.name}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{s.total}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{s.offen}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{s.unterzeichnet}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmtMoney(s.schnitt)}</td>
                  <td className="py-1.5 text-right tabular-nums">{(s.quote * 100).toFixed(1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      )}
    </Card>
  );
}
