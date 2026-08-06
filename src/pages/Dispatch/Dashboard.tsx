import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, Truck, CalendarCheck, AlertTriangle, MailQuestion, PackageCheck, Users, Route } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';

async function loadDispatchStats() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const [todayApps, week, waiting, red, tours, vehicles, drivers, undated] = await Promise.all([
    supabase.from('delivery_appointments').select('id', { count: 'exact', head: true }).eq('planned_date', today),
    supabase.from('delivery_appointments').select('id', { count: 'exact', head: true }).gte('planned_date', today).lte('planned_date', in7),
    supabase.from('delivery_appointments').select('id', { count: 'exact', head: true }).in('status', ['bestaetigung_versendet', 'kunde_geoeffnet']),
    supabase.from('delivery_appointments').select('id', { count: 'exact', head: true }).eq('readiness', 'rot'),
    supabase.from('delivery_tours').select('id', { count: 'exact', head: true }).eq('tour_date', today),
    supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'verfuegbar').eq('active', true),
    supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('delivery_appointments').select('id', { count: 'exact', head: true }).is('planned_date', null),
  ]);

  return {
    today: todayApps.count ?? 0,
    week: week.count ?? 0,
    waiting: waiting.count ?? 0,
    red: red.count ?? 0,
    tours: tours.count ?? 0,
    vehicles: vehicles.count ?? 0,
    drivers: drivers.count ?? 0,
    undated: undated.count ?? 0,
  };
}

export default function DispatchDashboard() {
  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'dashboard'],
    queryFn: loadDispatchStats,
    staleTime: 60_000,
  });
  const s = data ?? { today: 0, week: 0, waiting: 0, red: 0, tours: 0, vehicles: 0, drivers: 0, undated: 0 };

  const kpis = [
    { label: 'Liefertermine heute', value: s.today, icon: CalendarCheck, accent: 'sky' as const },
    { label: 'Termine nächste 7 Tage', value: s.week, icon: Route, accent: 'violet' as const },
    { label: 'Warten auf Kundenbestätigung', value: s.waiting, icon: MailQuestion, accent: 'gold' as const },
    { label: 'Nicht lieferbar (rot)', value: s.red, icon: AlertTriangle, accent: 'rose' as const },
    { label: 'Touren heute', value: s.tours, icon: Truck, accent: 'emerald' as const },
    { label: 'Ohne Termin', value: s.undated, icon: PackageCheck, accent: 'gold' as const },
    { label: 'Verfügbare Fahrzeuge', value: s.vehicles, icon: Truck, accent: 'sky' as const },
    { label: 'Aktive Fahrer', value: s.drivers, icon: Users, accent: 'emerald' as const },
  ];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="ALIX Dispatch Center"
        subtitle="Steuerung von Lieferterminen, Touren, Fahrzeugen und Fahrern"
        icon={LayoutDashboard}
        meta={<InfinityStatusBadge kind={isPending ? 'progress' : 'done'} label={isPending ? 'Lädt' : 'Live'} pulse={isPending} dotOnly />}
      />
      {isPending ? (
        <SkeletonKpiGrid count={8} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(k => (
            <KpiTile key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />
          ))}
        </div>
      )}
    </div>
  );
}
