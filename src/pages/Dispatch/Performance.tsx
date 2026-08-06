import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Gauge, Leaf, Timer, TrendingUp, Truck, Users } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { EmptyState } from '@/components/infinity/EmptyState';

import { DEFAULT_CO2 } from './Fahrzeuge';

// Fallback-CO₂-Faktoren (g/km), sofern am Fahrzeug nichts hinterlegt ist
const CO2_DIESEL_G_PER_KM = 250;
const CO2_ELECTRIC_G_PER_KM = 60; // Strommix DE/AT

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

export default function DispatchPerformance() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'performance', from, to],
    queryFn: async () => {
      const [toursRes, driversRes, vehiclesRes] = await Promise.all([
        supabase.from('delivery_tours')
          .select('id, tour_number, tour_date, status, driver_id, vehicle_id, planned_distance_km, actual_distance_km, planned_drive_minutes, planned_work_minutes, utilization_pct, actual_start_at, actual_end_at')
          .gte('tour_date', from).lte('tour_date', to).limit(2000),
        supabase.from('drivers').select('id, full_name, active').limit(500),
        supabase.from('vehicles').select('id, name, license_plate, is_electric, vehicle_type, active').limit(500),
      ]);
      if (toursRes.error) throw toursRes.error;
      const tours = toursRes.data ?? [];
      const tourIds = tours.map((t: any) => t.id);

      let stops: any[] = [];
      let costs: any[] = [];
      let incidents: any[] = [];
      if (tourIds.length) {
        const chunk = tourIds.slice(0, 1000);
        const [s, c, i] = await Promise.all([
          supabase.from('delivery_tour_stops').select('tour_id, stop_status, delay_minutes, distance_from_prev_km').in('tour_id', chunk).limit(5000),
          supabase.from('delivery_costs').select('tour_id, amount').in('tour_id', chunk).limit(5000),
          supabase.from('delivery_incidents').select('tour_id, incident_type').in('tour_id', chunk).limit(5000),
        ]);
        stops = s.data ?? [];
        costs = c.data ?? [];
        incidents = i.data ?? [];
      }
      return { tours, stops, costs, incidents, drivers: driversRes.data ?? [], vehicles: vehiclesRes.data ?? [] };
    },
  });

  const agg = useMemo(() => {
    if (!data) return null;
    const { tours, stops, costs, incidents, drivers, vehicles } = data;
    const vehicleById = new Map(vehicles.map((v: any) => [v.id, v]));
    const driverById = new Map(drivers.map((d: any) => [d.id, d]));

    const stopsByTour = new Map<string, any[]>();
    stops.forEach((s: any) => {
      const arr = stopsByTour.get(s.tour_id) ?? [];
      arr.push(s); stopsByTour.set(s.tour_id, arr);
    });
    const costByTour = new Map<string, number>();
    costs.forEach((c: any) => costByTour.set(c.tour_id, (costByTour.get(c.tour_id) ?? 0) + Number(c.amount || 0)));
    const incByTour = new Map<string, number>();
    incidents.forEach((i: any) => incByTour.set(i.tour_id, (incByTour.get(i.tour_id) ?? 0) + 1));

    const rowsByDriver = new Map<string, any>();
    const rowsByVehicle = new Map<string, any>();
    let totKm = 0, totCo2 = 0, totCost = 0, totStops = 0, onTime = 0, delayed = 0, failed = 0, totUtil = 0, utilCount = 0;

    tours.forEach((t: any) => {
      const km = Number(t.actual_distance_km ?? t.planned_distance_km ?? 0);
      const veh: any = t.vehicle_id ? vehicleById.get(t.vehicle_id) : null;
      const co2 = (km * (veh?.is_electric ? CO2_ELECTRIC_G_PER_KM : CO2_DIESEL_G_PER_KM)) / 1000; // kg
      const cost = costByTour.get(t.id) ?? 0;
      const ts = stopsByTour.get(t.id) ?? [];
      const tOnTime = ts.filter((s: any) => (s.delay_minutes ?? 0) <= 15 && s.stop_status !== 'fehlgeschlagen').length;
      const tDelayed = ts.filter((s: any) => (s.delay_minutes ?? 0) > 15).length;
      const tFailed = ts.filter((s: any) => s.stop_status === 'fehlgeschlagen').length;

      totKm += km; totCo2 += co2; totCost += cost; totStops += ts.length;
      onTime += tOnTime; delayed += tDelayed; failed += tFailed;
      if (t.utilization_pct != null) { totUtil += Number(t.utilization_pct); utilCount++; }

      const push = (map: Map<string, any>, key: string, label: string, extra?: any) => {
        const cur = map.get(key) ?? { key, label, tours: 0, km: 0, co2: 0, cost: 0, stops: 0, onTime: 0, delayed: 0, failed: 0, incidents: 0, util: 0, utilCount: 0, ...extra };
        cur.tours++; cur.km += km; cur.co2 += co2; cur.cost += cost; cur.stops += ts.length;
        cur.onTime += tOnTime; cur.delayed += tDelayed; cur.failed += tFailed;
        cur.incidents += incByTour.get(t.id) ?? 0;
        if (t.utilization_pct != null) { cur.util += Number(t.utilization_pct); cur.utilCount++; }
        map.set(key, cur);
      };

      const dKey = t.driver_id ?? '__none__';
      push(rowsByDriver, dKey, (t.driver_id && driverById.get(t.driver_id)?.full_name) || 'Ohne Fahrer');
      const vKey = t.vehicle_id ?? '__none__';
      push(rowsByVehicle, vKey, veh ? `${veh.name || veh.vehicle_type || 'Fahrzeug'} · ${veh.license_plate ?? ''}`.trim() : 'Ohne Fahrzeug', { is_electric: !!veh?.is_electric });
    });

    const finish = (m: Map<string, any>) => Array.from(m.values()).map(r => ({
      ...r,
      avgUtil: r.utilCount ? r.util / r.utilCount : null,
      onTimePct: r.stops ? (r.onTime / r.stops) * 100 : null,
      kmPerStop: r.stops ? r.km / r.stops : null,
      costPerStop: r.stops ? r.cost / r.stops : null,
    })).sort((a, b) => b.stops - a.stops);

    return {
      totals: {
        tours: tours.length, km: totKm, co2: totCo2, cost: totCost, stops: totStops,
        onTimePct: totStops ? (onTime / totStops) * 100 : null,
        delayed, failed,
        avgUtil: utilCount ? totUtil / utilCount : null,
        co2PerStop: totStops ? totCo2 / totStops : null,
        electricShare: (() => {
          const evKm = tours.reduce((s: number, t: any) => {
            const v: any = t.vehicle_id ? vehicleById.get(t.vehicle_id) : null;
            return s + (v?.is_electric ? Number(t.actual_distance_km ?? t.planned_distance_km ?? 0) : 0);
          }, 0);
          return totKm ? (evKm / totKm) * 100 : 0;
        })(),
      },
      drivers: finish(rowsByDriver),
      vehicles: finish(rowsByVehicle),
    };
  }, [data]);

  const scoreBadge = (pct: number | null) => {
    if (pct == null) return <Badge variant="outline" className="text-muted-foreground">—</Badge>;
    const cls = pct >= 90 ? 'border-emerald-500/40 text-emerald-400'
      : pct >= 75 ? 'border-amber-500/40 text-amber-400'
      : 'border-red-500/40 text-red-400';
    return <Badge variant="outline" className={cls}>{nf(pct, 1)} %</Badge>;
  };

  const kpis = [
    { label: 'Touren', value: agg ? nf(agg.totals.tours) : '—', icon: Truck },
    { label: 'Stopps', value: agg ? nf(agg.totals.stops) : '—', icon: Users },
    { label: 'Pünktlichkeit', value: agg?.totals.onTimePct != null ? `${nf(agg.totals.onTimePct, 1)} %` : '—', icon: Timer },
    { label: 'Ø Auslastung', value: agg?.totals.avgUtil != null ? `${nf(agg.totals.avgUtil, 1)} %` : '—', icon: Gauge },
    { label: 'Kilometer', value: agg ? `${nf(agg.totals.km)} km` : '—', icon: TrendingUp },
    { label: 'CO₂', value: agg ? `${nf(agg.totals.co2 / 1000, 2)} t` : '—', icon: Leaf },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance & Nachhaltigkeit"
        subtitle="Phase 8 – Fahrer- und Fahrzeug-Scorecards, Pünktlichkeit, Kosten je Stopp und CO₂-Bilanz"
        icon={Gauge}
      />

      <Card className="p-4 flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs">Von</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label className="text-xs">Bis</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" />
        </div>
        <div className="text-xs text-muted-foreground">
          CO₂-Faktoren: Diesel {CO2_DIESEL_G_PER_KM} g/km · Elektro {CO2_ELECTRIC_G_PER_KM} g/km
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{k.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Elektro-Anteil an den gefahrenen Kilometern</span>
          <span className="font-medium text-foreground">{agg ? `${nf(agg.totals.electricShare, 1)} %` : '—'}</span>
        </div>
        <Progress value={agg?.totals.electricShare ?? 0} className="mt-2" />
        <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
          <div>CO₂ je Stopp: <span className="text-foreground">{agg?.totals.co2PerStop != null ? `${nf(agg.totals.co2PerStop, 1)} kg` : '—'}</span></div>
          <div>Verspätete Stopps (&gt;15 min): <span className="text-foreground">{agg ? nf(agg.totals.delayed) : '—'}</span></div>
          <div>Fehlgeschlagene Stopps: <span className="text-foreground">{agg ? nf(agg.totals.failed) : '—'}</span></div>
        </div>
      </Card>

      <Tabs defaultValue="fahrer">
        <TabsList>
          <TabsTrigger value="fahrer">Fahrer-Scorecards</TabsTrigger>
          <TabsTrigger value="fahrzeuge">Fahrzeug-Scorecards</TabsTrigger>
        </TabsList>

        {(['fahrer', 'fahrzeuge'] as const).map(tab => {
          const rows = tab === 'fahrer' ? agg?.drivers : agg?.vehicles;
          return (
            <TabsContent key={tab} value={tab}>
              <Card className="p-0 overflow-x-auto">
                {isPending ? <div className="p-4"><SkeletonTable /></div> : !rows?.length ? (
                  <EmptyState title="Keine Daten" description="Im gewählten Zeitraum wurden keine Touren gefunden." icon={Gauge} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{tab === 'fahrer' ? 'Fahrer' : 'Fahrzeug'}</TableHead>
                        <TableHead className="text-right">Touren</TableHead>
                        <TableHead className="text-right">Stopps</TableHead>
                        <TableHead className="text-right">Pünktlichkeit</TableHead>
                        <TableHead className="text-right">Ø Auslastung</TableHead>
                        <TableHead className="text-right">km</TableHead>
                        <TableHead className="text-right">km/Stopp</TableHead>
                        <TableHead className="text-right">Kosten/Stopp</TableHead>
                        <TableHead className="text-right">CO₂</TableHead>
                        <TableHead className="text-right">Vorfälle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r: any) => (
                        <TableRow key={r.key}>
                          <TableCell className="font-medium text-foreground">
                            {r.label}
                            {tab === 'fahrzeuge' && r.is_electric && (
                              <Badge variant="outline" className="ml-2 border-emerald-500/40 text-emerald-400">Elektro</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{nf(r.tours)}</TableCell>
                          <TableCell className="text-right">{nf(r.stops)}</TableCell>
                          <TableCell className="text-right">{scoreBadge(r.onTimePct)}</TableCell>
                          <TableCell className="text-right">{r.avgUtil != null ? `${nf(r.avgUtil, 1)} %` : '—'}</TableCell>
                          <TableCell className="text-right">{nf(r.km)}</TableCell>
                          <TableCell className="text-right">{r.kmPerStop != null ? nf(r.kmPerStop, 1) : '—'}</TableCell>
                          <TableCell className="text-right">{r.costPerStop != null ? `${nf(r.costPerStop, 2)} €` : '—'}</TableCell>
                          <TableCell className="text-right">{nf(r.co2, 1)} kg</TableCell>
                          <TableCell className="text-right">{r.incidents ? <span className="text-red-400">{nf(r.incidents)}</span> : '0'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
