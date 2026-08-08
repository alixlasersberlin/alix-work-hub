import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OfferEditDialog } from './FollowupSections';
import {
  bandLabel, daysSince, eur, isLost, isWon, offerDate, offerScore, offerValue,
  productOf, probabilityOf, stageOf, STAGES, type OfferRow,
} from '@/lib/sales/offer-analytics';

type SortKey = 'date' | 'value' | 'score' | 'age' | 'customer';

const stageLabel = (code: string) => STAGES.find((s) => s.code === code)?.label ?? code;

const BAND_CLASS: Record<'hot' | 'warm' | 'cold', string> = {
  hot: 'bg-destructive/15 text-destructive border-destructive/30',
  warm: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  cold: 'bg-muted text-muted-foreground border-border',
};

/** Detailliste aller gefilterten Angebote mit Score, Alter und Direktbearbeitung. */
export function OfferTableSection({ offers, onRefresh }: { offers: OfferRow[]; onRefresh: () => void }) {
  const [sort, setSort] = useState<SortKey>('date');
  const [desc, setDesc] = useState(true);
  const [edit, setEdit] = useState<OfferRow | null>(null);

  const rows = useMemo(() => {
    const list = [...offers];
    list.sort((a, b) => {
      let d = 0;
      if (sort === 'date') d = offerDate(a).getTime() - offerDate(b).getTime();
      if (sort === 'value') d = offerValue(a) - offerValue(b);
      if (sort === 'score') d = offerScore(a).score - offerScore(b).score;
      if (sort === 'age') d = (daysSince(offerDate(a)) ?? 0) - (daysSince(offerDate(b)) ?? 0);
      if (sort === 'customer') d = String(a.customer_name ?? '').localeCompare(String(b.customer_name ?? ''));
      return desc ? -d : d;
    });
    return list.slice(0, 300);
  }, [offers, sort, desc]);

  const toggle = (key: SortKey) => {
    if (sort === key) setDesc((v) => !v);
    else { setSort(key); setDesc(true); }
  };

  const Th = ({ label, k, align = 'left' }: { label: string; k?: SortKey; align?: 'left' | 'right' }) => (
    <th className={cn('px-3 py-2 font-medium text-muted-foreground', align === 'right' && 'text-right')}>
      {k ? (
        <button onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-foreground">
          {label}
          <ArrowUpDown className={cn('h-3 w-3', sort === k ? 'text-foreground' : 'opacity-40')} />
        </button>
      ) : label}
    </th>
  );

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="font-display font-semibold text-sm">Angebote im Detail</h3>
        <span className="text-xs text-muted-foreground">
          {rows.length} angezeigt{offers.length > rows.length ? ` von ${offers.length}` : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-y border-border">
            <tr>
              <Th label="Angebot" />
              <Th label="Datum" k="date" />
              <Th label="Kunde" k="customer" />
              <Th label="Verkäufer" />
              <Th label="Phase" />
              <Th label="Produkt" />
              <Th label="Wert" k="value" align="right" />
              <Th label="Alter" k="age" align="right" />
              <Th label="Score" k="score" align="right" />
              <Th label="Wahrsch." align="right" />
              <Th label="" align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Keine Angebote für die aktuelle Auswahl.</td></tr>
            )}
            {rows.map((o, i) => {
              const s = offerScore(o);
              const age = daysSince(offerDate(o)) ?? 0;
              return (
                <tr key={o.id} className={cn('border-b border-border/50', i % 2 === 1 && 'bg-muted/20')}>
                  <td className="px-3 py-2 font-medium tabular-nums">{o.offer_number ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {o.offer_date ? new Date(o.offer_date).toLocaleDateString('de-DE') : '—'}
                  </td>
                  <td className="px-3 py-2 max-w-[220px] truncate">{o.customer_name ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{o.created_by_name ?? 'Unbekannt'}</td>
                  <td className="px-3 py-2">
                    <span className="text-muted-foreground">{stageLabel(stageOf(o))}</span>
                    {isWon(o) && <Badge variant="outline" className="ml-1 text-[10px] border-emerald-500/40 text-emerald-500">gewonnen</Badge>}
                    {isLost(o) && <Badge variant="outline" className="ml-1 text-[10px] border-destructive/40 text-destructive">verloren</Badge>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{productOf(o)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{eur(offerValue(o))}</td>
                  <td className={cn('px-3 py-2 text-right tabular-nums', age > 30 && 'text-destructive')}>{age} T.</td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant="outline" className={cn('text-[10px] tabular-nums', BAND_CLASS[s.band])}>
                      {s.score} · {bandLabel(s.band)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {(probabilityOf(o) * 100).toFixed(0)} %
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEdit(o)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <OfferEditDialog offer={edit} onClose={() => setEdit(null)} onSaved={onRefresh} />
    </Card>
  );
}

export default OfferTableSection;
