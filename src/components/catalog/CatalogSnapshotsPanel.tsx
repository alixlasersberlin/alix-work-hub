import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Snapshot {
  id: string;
  item_id: string;
  snapshot: any;
  language_code: string | null;
  country_iso: string | null;
  created_at: string;
}

interface Props {
  /** e.g. 'offer' | 'order' | 'production_order' */
  usedInType: string;
  /** possible IDs to match (order.id, order.order_number, …) */
  usedInIds: Array<string | null | undefined>;
  className?: string;
}

/**
 * Zeigt alle Katalog-Snapshots an, die zu einem Angebot / Auftrag /
 * Produktionsauftrag verknüpft wurden (Preis + Beschreibung eingefroren
 * zum Zeitpunkt der Übernahme).
 */
export function CatalogSnapshotsPanel({ usedInType, usedInIds, className }: Props) {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = usedInIds.filter((v): v is string => !!v && String(v).length > 0);
    if (ids.length === 0) { setSnaps([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('catalog_item_snapshots')
        .select('id, item_id, snapshot, language_code, country_iso, created_at')
        .eq('used_in_type', usedInType)
        .in('used_in_id', ids)
        .order('created_at', { ascending: false });
      setSnaps(data ?? []);
      setLoading(false);
    })();
  }, [usedInType, usedInIds.join('|')]);

  if (loading) return null;
  if (snaps.length === 0) return null;

  return (
    <div className={`rounded-xl border border-border bg-card p-6 card-glow ${className ?? ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-4 h-4 text-primary" />
        <h3 className="text-base font-display font-bold text-foreground">
          Katalog-Bezug
        </h3>
        <Badge variant="outline" className="ml-2">{snaps.length} Snapshot{snaps.length === 1 ? '' : 's'}</Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Preise und Beschreibungen wurden zum Zeitpunkt der Übernahme aus dem Katalog eingefroren.
        Spätere Katalogänderungen betreffen diesen Vorgang nicht.
      </p>
      <div className="space-y-2">
        {snaps.map((s) => {
          const item = s.snapshot?.item ?? {};
          const price = s.snapshot?.price ?? {};
          const captured = new Date(s.created_at).toLocaleString('de-DE');
          const rate = price.sale_gross ?? price.uvp_gross ?? price.sale_net ?? price.uvp_net;
          return (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    <Link
                      to={`/katalog/artikel/${s.item_id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {item.name || 'Artikel'}
                    </Link>
                    {item.sku && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{item.sku}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.country_iso ?? '—'} · {(s.language_code ?? '—').toUpperCase()} · übernommen {captured}
                  </div>
                </div>
              </div>
              {rate != null && (
                <div className="text-xs font-medium text-foreground shrink-0">
                  {Number(rate).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CatalogSnapshotsPanel;
