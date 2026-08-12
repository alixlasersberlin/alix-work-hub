import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Truck, CalendarCheck, AlertTriangle, MailQuestion, PackageCheck, Users, Route,
  Euro, Timer, Gauge, TrendingUp, MapPin, Lightbulb, FileDown, Crown, ShieldAlert, ClipboardList,
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { planPdf, exportXlsx } from '@/lib/dispatch/exports';

type RangeKey = 'today' | 'week' | 'month';

function rangeFor(key: RangeKey) {
  const now = new Date();
  if (key === 'today') return { from: now, to: now, label: 'Heute' };
  if (key === 'week') return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }), label: 'Diese Woche' };
  return { from: startOfMonth(now), to: endOfMonth(now), label: 'Dieser Monat' };
}

export default function DispatchDashboard() {
  const navigate = useNavigate();
  // Auf Smartphones automatisch die vereinfachte Ansicht "Meine Touren" laden
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      navigate('/dispatch/meine-touren', { replace: true });
    }
  }, [navigate]);

  const [range, setRange] = useState<RangeKey>('week');
  const r = useMemo(() => rangeFor(range), [range]);
  const from = format(r.from, 'yyyy-MM-dd');
  const to = format(r.to, 'yyyy-MM-dd');

  const { data: kpi, isPending } = useQuery({
    queryKey: ['dispatch', 'kpis', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dispatch_dashboard_kpis' as any, { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? {}) as Record<string, number>;
    },
    staleTime: 60_000,
  });

  const { data: hints } = useQuery({
    queryKey: ['dispatch', 'hints', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dispatch_smart_hints' as any, { p_from: from, p_to: to });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 60_000,
  });

  const { data: resources } = useQuery({
    queryKey: ['dispatch', 'resources'],
    queryFn: async () => {
      const [vehicles, drivers, next7] = await Promise.all([
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'verfuegbar').eq('active', true),
        supabase.from('drivers').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('delivery_appointments').select('id', { count: 'exact', head: true })
          .gte('planned_date', format(new Date(), 'yyyy-MM-dd'))
          .lte('planned_date', format(addDays(new Date(), 7), 'yyyy-MM-dd')),
      ]);
      return { vehicles: vehicles.count ?? 0, drivers: drivers.count ?? 0, next7: next7.count ?? 0 };
    },
    staleTime: 60_000,
  });

  const { data: tours } = useQuery({
    queryKey: ['dispatch', 'dashboard-tours', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tours')
        .select('id, tour_number, title, tour_date, status, planned_distance_km, planned_drive_minutes, planned_start_time, utilization_pct, drivers:driver_id(full_name), vehicles:vehicle_id(license_plate)')
        .gte('tour_date', from).lte('tour_date', to)
        .order('tour_date');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const n = (k: string) => Number(kpi?.[k] ?? 0);

  const kpis = [
    { label: 'Termine im Zeitraum', value: n('appointments_total'), icon: CalendarCheck, accent: 'sky' as const },
    { label: 'Termine nächste 7 Tage', value: resources?.next7 ?? 0, icon: Route, accent: 'violet' as const },
    { label: 'Ausgeliefert', value: n('delivered'), icon: PackageCheck, accent: 'emerald' as const },
    { label: 'Teillieferungen', value: n('partial'), icon: PackageCheck, accent: 'gold' as const },
    { label: 'Fehlgeschlagen', value: n('failed'), icon: ShieldAlert, accent: 'rose' as const },
    { label: 'Offene Termine', value: n('open'), icon: ClipboardList, accent: 'sky' as const },
    { label: 'Warten auf Bestätigung', value: n('awaiting_confirmation'), icon: MailQuestion, accent: 'gold' as const },
    { label: 'Bestätigungsquote', value: `${n('confirmation_rate')} %`, icon: TrendingUp, accent: 'emerald' as const },
    { label: 'Ø Bestätigungsdauer', value: `${n('avg_confirm_hours')} h`, icon: Timer, accent: 'violet' as const },
    { label: 'Nicht lieferbar (rot)', value: n('red'), icon: AlertTriangle, accent: 'rose' as const },
    { label: 'VIP-Termine', value: n('vip'), icon: Crown, accent: 'gold' as const },
    { label: 'Ohne Termin', value: n('undated'), icon: MapPin, accent: 'gold' as const },
    { label: 'Ungeplant > 14 Tage', value: n('undated_long'), icon: AlertTriangle, accent: 'rose' as const },
    { label: 'Touren', value: n('tours'), icon: Truck, accent: 'sky' as const },
    { label: 'Davon freigegeben', value: n('tours_released'), icon: Truck, accent: 'emerald' as const },
    { label: 'Geplante km', value: n('planned_km'), icon: Route, accent: 'violet' as const },
    { label: 'Fahrzeit gesamt', value: `${n('drive_hours')} h`, icon: Timer, accent: 'sky' as const },
    { label: 'Ø Auslastung', value: `${n('avg_utilization')} %`, icon: Gauge, accent: 'gold' as const },
    { label: 'Ø Stopps je Tour', value: n('stops_per_tour'), icon: MapPin, accent: 'violet' as const },
    { label: 'Pünktlichkeit', value: `${n('punctuality_pct')} %`, icon: TrendingUp, accent: 'emerald' as const },
    { label: 'Ø Verspätung', value: `${n('avg_delay_minutes')} Min.`, icon: Timer, accent: 'rose' as const },
    { label: 'Vorfälle', value: n('incidents'), icon: AlertTriangle, accent: 'rose' as const },
    { label: 'Kosten gesamt', value: `${n('cost_total').toLocaleString('de-DE')} €`, icon: Euro, accent: 'gold' as const },
    { label: 'Kosten je Tour', value: `${n('cost_per_tour').toLocaleString('de-DE')} €`, icon: Euro, accent: 'sky' as const },
    { label: 'Kosten je Lieferung', value: `${n('cost_per_delivery').toLocaleString('de-DE')} €`, icon: Euro, accent: 'violet' as const },
    { label: 'Verfügbare Fahrzeuge', value: resources?.vehicles ?? 0, icon: Truck, accent: 'emerald' as const },
    { label: 'Aktive Fahrer', value: resources?.drivers ?? 0, icon: Users, accent: 'emerald' as const },
  ];

  const hintColor = (sev: string) =>
    sev === 'danger' ? 'border-rose-500/40 bg-rose-500/5 text-rose-300'
      : sev === 'warn' ? 'border-amber-500/40 bg-amber-500/5 text-amber-300'
        : 'border-sky-500/40 bg-sky-500/5 text-sky-300';

  const exportPlan = () => {
    const rows = (tours ?? []) as any[];
    planPdf(`Tourenplan ${r.label}`, `${format(r.from, 'dd.MM.yyyy')} – ${format(r.to, 'dd.MM.yyyy')}`, rows);
  };

  const exportExcel = () => {
    const rows = (tours ?? []).map((t: any) => ({
      Datum: t.tour_date, Tour: t.tour_number, Bezeichnung: t.title,
      Fahrer: t.drivers?.full_name ?? '', Fahrzeug: t.vehicles?.license_plate ?? '',
      km: t.planned_distance_km, Fahrzeit_Min: t.planned_drive_minutes,
      Auslastung: t.utilization_pct, Status: t.status,
    }));
    if (!rows.length) return;
    exportXlsx(rows, `Tourenplan_${from}_${to}`, 'Touren');
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="ALIX Dispatch Center"
        subtitle="Kennzahlen, Kosten und intelligente Hinweise zur Tourenplanung"
        icon={LayoutDashboard}
        meta={<InfinityStatusBadge kind={isPending ? 'progress' : 'done'} label={isPending ? 'Lädt' : 'Live'} pulse={isPending} dotOnly />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={range} onValueChange={v => setRange(v as RangeKey)}>
              <TabsList>
                <TabsTrigger value="today">Heute</TabsTrigger>
                <TabsTrigger value="week">Woche</TabsTrigger>
                <TabsTrigger value="month">Monat</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={exportPlan}><FileDown className="h-4 w-4 mr-1" />Plan PDF</Button>
            <Button variant="outline" size="sm" onClick={exportExcel}><FileDown className="h-4 w-4 mr-1" />Excel</Button>
          </div>
        }
      />

      {isPending ? (
        <SkeletonKpiGrid count={12} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {kpis.map(k => (
            <KpiTile key={k.label} label={k.label} value={k.value as any} icon={k.icon} accent={k.accent} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 mt-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-primary" /> Intelligente Hinweise
          </div>
          {(hints ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">Keine Auffälligkeiten im gewählten Zeitraum.</div>
          )}
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {(hints ?? []).map((h: any, i: number) => (
              <Link key={i} to={h.link || '/dispatch'} className={`block rounded-lg border px-3 py-2 text-sm ${hintColor(h.severity)}`}>
                <div className="font-medium">{h.title}</div>
                <div className="text-xs text-muted-foreground">{h.detail}</div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /> Touren im Zeitraum</div>
            <Link to="/dispatch/touren" className="text-xs text-primary hover:underline">alle Touren</Link>
          </div>
          {(tours ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">Keine Touren im Zeitraum.</div>
          )}
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {(tours ?? []).map((t: any) => (
              <Link key={t.id} to={`/dispatch/touren/${t.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent/40">
                <div>
                  <div className="font-medium">{t.tour_number} · {t.tour_date ? format(new Date(t.tour_date), 'dd.MM.yyyy') : ''}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.drivers?.full_name ?? 'kein Fahrer'} · {t.vehicles?.license_plate ?? 'kein Fahrzeug'}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{t.planned_distance_km ?? 0} km</div>
                  <div>{t.utilization_pct != null ? `${t.utilization_pct} % Auslastung` : t.status}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
