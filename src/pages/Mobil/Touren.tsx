import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, Loader2, Play } from 'lucide-react';
import { TOUR_STATUS_LABELS, statusClass } from '@/pages/Dispatch/constants';
import { cacheGet, cacheSet } from '@/lib/mobil/utils';

type TabKey = 'heute' | 'morgen' | 'woche' | 'alle';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'heute', label: 'Heute' },
  { key: 'morgen', label: 'Morgen' },
  { key: 'woche', label: 'Diese Woche' },
  { key: 'alle', label: 'Alle Touren' },
];

export default function MobilTouren() {
  const [tab, setTab] = useState<TabKey>('heute');
  const [tours, setTours] = useState<any[]>(cacheGet<any[]>('tours') ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('delivery_tours')
        .select('id, tour_number, title, tour_date, status, planned_start_time, driver_id, delivery_tour_stops(count)')
        .gte('tour_date', format(addDays(new Date(), -7), 'yyyy-MM-dd'))
        .order('tour_date')
        .limit(100);
      if (cancelled) return;
      if (error) setError('Keine Verbindung – gespeicherte Daten werden angezeigt.');
      else { setTours(data ?? []); cacheSet('tours', data ?? []); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const ws = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const we = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    return tours.filter((t) => {
      const d = String(t.tour_date ?? '');
      if (tab === 'heute') return d === today;
      if (tab === 'morgen') return d === tomorrow;
      if (tab === 'woche') return d >= ws && d <= we;
      return true;
    });
  }, [tours, tab]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><Truck className="w-5 h-5" /> Meine Touren</h1>

      <div className="grid grid-cols-4 gap-1">
        {TABS.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'default' : 'outline'}
            className="h-11 px-1 text-xs"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {error && <Card className="p-3 text-xs text-amber-500">{error}</Card>}
      {loading && <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
      {!loading && filtered.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Keine Touren in diesem Zeitraum.</Card>
      )}

      {filtered.map((t) => (
        <Card key={t.id} className="p-4 space-y-3">
          <div>
            <div className="text-base font-bold">{t.title || t.tour_number}</div>
            <div className="text-sm text-muted-foreground">
              {t.tour_date ? format(new Date(t.tour_date), 'EEEE, dd.MM.yyyy') : '—'}
              {t.planned_start_time ? ` · Start: ${String(t.planned_start_time).slice(0, 5)} Uhr` : ''}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${statusClass(t.status)}`}>
                {TOUR_STATUS_LABELS[t.status] ?? t.status}
              </span>
              <Badge variant="outline" className="text-[10px]">
                <MapPin className="w-3 h-3 mr-1" />{t.delivery_tour_stops?.[0]?.count ?? 0} Stopps
              </Badge>
            </div>
          </div>
          <Button asChild className="w-full h-12 text-base">
            <Link to={`/mobil/tour/${t.id}`}><Play className="w-4 h-4 mr-2" /> Tour starten</Link>
          </Button>
        </Card>
      ))}
    </div>
  );
}
