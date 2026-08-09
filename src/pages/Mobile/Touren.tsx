import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { TOUR_STATUS_LABELS, statusClass } from '@/pages/Dispatch/constants';
import { ReleaseStatusDot } from '@/components/delivery/ReleaseStatusDot';
import { fetchReleaseStatusMap } from '@/lib/delivery-approval/api';
import type { OverallStatus } from '@/lib/delivery-approval/config';
import { useTenantFilter } from '@/hooks/useTenantFilter';

const RELEASE_RANK: Record<OverallStatus, number> = { blocked: 0, waiting: 1, released: 2, delivered: 3, completed: 4 };

export default function MobileTouren() {
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tourRelease, setTourRelease] = useState<Record<string, OverallStatus>>({});
  const { tenantId } = useTenantFilter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let tq: any = supabase
        .from('delivery_tours')
        .select('id, tour_number, tour_date, title, status, planned_start_time, planned_distance_km, vehicles:vehicle_id(license_plate), delivery_tour_stops(count)')
        .gte('tour_date', format(new Date(Date.now() - 2 * 86400_000), 'yyyy-MM-dd'))
        .order('tour_date')
        .limit(50);
      if (tenantId) tq = tq.eq('tenant_id', tenantId);
      const { data } = await tq;
      if (cancelled) return;
      setTours(data ?? []);
      setLoading(false);

      // Freigabe-Ampel je Tour = schlechtester Status aller Stopps
      const tourIds = (data ?? []).map((t: any) => t.id);
      if (tourIds.length) {
        const { data: stops } = await supabase
          .from('delivery_tour_stops')
          .select('tour_id, appointment:appointment_id(order_id)')
          .in('tour_id', tourIds);
        const orderIds = [...new Set(((stops ?? []) as any[]).map((s) => s.appointment?.order_id).filter(Boolean))];
        if (!orderIds.length || cancelled) return;
        const map = await fetchReleaseStatusMap(orderIds as string[]);
        if (cancelled) return;
        const worst: Record<string, OverallStatus> = {};
        for (const st of ((stops ?? []) as any[])) {
          const oid = st.appointment?.order_id;
          const status = oid ? map[oid] : undefined;
          if (!status) continue;
          const cur = worst[st.tour_id];
          if (!cur || RELEASE_RANK[status] < RELEASE_RANK[cur]) worst[st.tour_id] = status;
        }
        setTourRelease(worst);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2"><Truck className="w-5 h-5" /> Meine Touren</h1>
      {loading && <div className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>}
      {!loading && tours.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">Aktuell sind dir keine Touren zugewiesen.</Card>
      )}
      {tours.map(t => (
        <Link key={t.id} to={`/m/tour/${t.id}`}>
          <Card className="p-4 flex items-center gap-3 active:bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{t.tour_number}</div>
              <div className="text-xs text-muted-foreground">
                {t.tour_date ? format(new Date(t.tour_date), 'EEEE, dd.MM.yyyy') : '—'}
                {t.planned_start_time ? ` · ${String(t.planned_start_time).slice(0, 5)} Uhr` : ''}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${statusClass(t.status)}`}>
                  {TOUR_STATUS_LABELS[t.status] ?? t.status}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  <MapPin className="w-3 h-3 mr-1" />{t.delivery_tour_stops?.[0]?.count ?? 0} Stopps
                </Badge>
                {t.vehicles?.license_plate && <Badge variant="outline" className="text-[10px]">{t.vehicles.license_plate}</Badge>}
                <ReleaseStatusDot status={tourRelease[t.id]} withLabel />
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </Card>
        </Link>
      ))}
    </div>
  );
}
