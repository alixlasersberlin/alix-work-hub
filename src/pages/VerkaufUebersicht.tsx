import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Building2, FileText, ClipboardList, Receipt, Undo2, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAtOnly } from '@/hooks/useAtOnly';

type Tile = {
  key: string;
  label: string;
  icon: any;
  to: string;
  accent: string;
  load: () => Promise<number | { open: number; total: number } | null>;
};

const TILES: Tile[] = [
  {
    key: 'kunden',
    label: 'Kundenbestand',
    icon: Building2,
    to: '/kunden',
    accent: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    load: async () => {
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  },
  {
    key: 'angebote',
    label: 'Offene Angebote',
    icon: FileText,
    to: '/verkauf/angebote',
    accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
    load: async () => null,
  },
  {
    key: 'auftraege',
    label: '🇩🇪 Aufträge Alix Deutschland',
    icon: ClipboardList,
    to: '/auftraege?region=de',
    accent: 'from-primary/25 to-primary/5 border-primary/40',
    load: async () => {
      const OPEN = ['open', 'offen', 'draft', 'approved', 'overdue', 'teilgeliefert', 'zurückgestellt'];
      const [openRes, totalRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('order_status', OPEN).neq('source_system', 'zoho_eu_2'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).neq('source_system', 'zoho_eu_2'),
      ]);
      return { open: openRes.count ?? 0, total: totalRes.count ?? 0 } as any;
    },
  },
  {
    key: 'auftraege_at',
    label: '🇦🇹 Aufträge Alix Austria (-AT)',
    icon: ClipboardList,
    to: '/auftraege?region=at',
    accent: 'from-red-500/20 to-red-500/5 border-red-500/30',
    load: async () => {
      const OPEN = ['open', 'offen', 'draft', 'approved', 'overdue', 'teilgeliefert', 'zurückgestellt'];
      const [openRes, totalRes] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }).in('order_status', OPEN).eq('source_system', 'zoho_eu_2'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('source_system', 'zoho_eu_2'),
      ]);
      return { open: openRes.count ?? 0, total: totalRes.count ?? 0 } as any;
    },
  },
  {
    key: 'anzahlung',
    label: 'Anzahlungsrechnung offen',
    icon: Receipt,
    to: '/verkauf/anzahlungsrechnung',
    accent: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    load: async () => null,
  },
  {
    key: 'gutschriften',
    label: 'Gutschriften',
    icon: Undo2,
    to: '/verkauf/gutschriften',
    accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/30',
    load: async () => null,
  },
];

export default function VerkaufUebersicht() {
  const atOnly = useAtOnly();
  const [counts, setCounts] = useState<Record<string, number | { open: number; total: number } | null>>({});
  const [loading, setLoading] = useState(true);

  const visibleTiles = atOnly
    ? TILES.filter((t) => t.key !== 'auftraege' && t.key !== 'kunden').concat([{
        key: 'kunden',
        label: 'Kundenbestand (-AT)',
        icon: Building2,
        to: '/kunden',
        accent: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
        load: async () => {
          const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('source_system', 'zoho_eu_2');
          return count ?? 0;
        },
      }])
    : TILES;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const entries = await Promise.all(
        visibleTiles.map(async (t) => {
          try {
            const v = await t.load();
            return [t.key, v] as const;
          } catch {
            return [t.key, null] as const;
          }
        })
      );
      if (!alive) return;
      setCounts(Object.fromEntries(entries));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [atOnly]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold gold-text">Verkäufe – Übersicht</h1>
          <p className="text-sm text-muted-foreground">Schneller Zugriff auf alle Verkaufsbereiche</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTiles.map((t) => {
          const Icon = t.icon;
          const value = counts[t.key];
          return (
            <Link key={t.key} to={t.to}>
              <Card
                className={cn(
                  'p-5 h-full bg-gradient-to-br border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer card-glow',
                  t.accent
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-lg bg-background/40 backdrop-blur-sm">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : value !== null && typeof value === 'object' ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-display font-bold text-amber-500 tabular-nums">
                        {value.open}
                      </span>
                      <span className="text-xs text-muted-foreground">offen</span>
                      <span className="text-xl font-display font-bold text-foreground tabular-nums ml-1">
                        {value.total}
                      </span>
                      <span className="text-xs text-muted-foreground">total</span>
                    </div>
                  ) : (
                    <span className="text-3xl font-display font-bold text-foreground tabular-nums">
                      {typeof value === 'number' ? value : '—'}
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-foreground/90">{t.label}</div>
                <div className="text-[11px] text-muted-foreground mt-1">Öffnen →</div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
