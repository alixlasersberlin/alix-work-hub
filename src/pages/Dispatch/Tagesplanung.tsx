import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, Truck, Route as RouteIcon, Wand2, Plus, Trash2, Crown, MapPin, Clock, Gauge } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DELIVERY_TYPE_LABELS, TOUR_STATUS_LABELS, statusClass, readinessClass, READINESS_LABELS } from './constants';
import { TourOrderPicker, type PickedItem, type PickedOrder } from '@/components/dispatch/TourOrderPicker';
import { assertOrderReleased } from '@/lib/delivery-approval/api';
import { useAuth } from '@/hooks/useAuth';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export default function DispatchTagesplanung() {
  const qc = useQueryClient();
  const { user, profile, hasRole } = useAuth();
  const [searchParams] = useSearchParams();
  const initialDay = searchParams.get('datum') || todayStr();
  const [day, setDay] = useState<string>(initialDay);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('alle');
  const [calcLoading, setCalcLoading] = useState(false);
  const [newTourOpen, setNewTourOpen] = useState(searchParams.get('neu') === '1');
  const [newTour, setNewTour] = useState({ title: '', driver_id: '', vehicle_id: '', start: '08:00', date: todayStr() });
  const [pickedOrder, setPickedOrder] = useState<PickedOrder | null>(null);
  const [pickedItems, setPickedItems] = useState<PickedItem[]>([]);
  const [partialDelivery, setPartialDelivery] = useState(false);
  const [creating, setCreating] = useState(false);


  const { data: tours = [], isPending: toursLoading } = useQuery({
    queryKey: ['dispatch', 'tagesplanung', 'tours', day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tours')
        .select('id, tour_number, title, status, planned_start_time, planned_end_time, planned_distance_km, planned_drive_minutes, planned_work_minutes, utilization_pct, region, driver_id, vehicle_id, drivers:driver_id(full_name), vehicles:vehicle_id(license_plate, name)')
        .eq('tour_date', day)
        .order('planned_start_time', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stops = [] } = useQuery({
    queryKey: ['dispatch', 'tagesplanung', 'stops', day],
    queryFn: async () => {
      const ids = (tours as any[]).map((t) => t.id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('delivery_tour_stops')
        .select('id, tour_id, appointment_id, position, distance_from_prev_km, drive_minutes_from_prev, planned_arrival, delivery_appointments:appointment_id(id, order_number, customer_name, company_name, delivery_street, delivery_zip, delivery_city, appointment_type, status, readiness, is_vip, duration_minutes, time_window_start, time_window_end)')
        .in('tour_id', ids)
        .order('position', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: (tours as any[]).length > 0,
  });

  const { data: unplanned = [] } = useQuery({
    queryKey: ['dispatch', 'tagesplanung', 'unplanned', day, filterRegion, filterStatus],
    queryFn: async () => {
      let q = supabase
        .from('delivery_appointments')
        .select('id, order_number, customer_name, company_name, delivery_street, delivery_zip, delivery_city, appointment_type, status, readiness, is_vip, duration_minutes, time_window_start, time_window_end, planned_date')
        .or(`planned_date.eq.${day},planned_date.is.null`)
        .not('status', 'in', '(storniert,abgeschlossen,erfolgreich_ausgeliefert)')
        .order('is_vip', { ascending: false })
        .limit(200);
      if (filterStatus !== 'alle') q = q.eq('status', filterStatus as any);
      if (filterRegion.trim()) q = q.ilike('delivery_zip', `${filterRegion.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['dispatch', 'drivers-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('drivers').select('id, full_name').eq('active', true).order('full_name');
      if (error) { toast.error(`Fahrer konnten nicht geladen werden: ${error.message}`); return []; }
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['dispatch', 'vehicles-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('id, license_plate, name, status').eq('active', true).order('license_plate');
      if (error) { toast.error(`Fahrzeuge konnten nicht geladen werden: ${error.message}`); return []; }
      return data ?? [];
    },
    staleTime: 300_000,
  });


  const assignedIds = useMemo(() => new Set((stops as any[]).map((s) => s.appointment_id)), [stops]);
  const openAppointments = useMemo(
    () => (unplanned as any[]).filter((a) => !assignedIds.has(a.id)),
    [unplanned, assignedIds],
  );
  const tourStops = useMemo(
    () => (stops as any[]).filter((s) => s.tour_id === selectedTour),
    [stops, selectedTour],
  );
  const currentTour = (tours as any[]).find((t) => t.id === selectedTour) ?? null;

  function refresh() {
    qc.invalidateQueries({ queryKey: ['dispatch', 'tagesplanung'] });
  }

  const userName = profile?.full_name || user?.email || 'Unbekannt';
  const isSuperAdmin = hasRole('Super Admin');

  /** Harte Sperre: ohne vollständige Freigabe keine Tourenplanung. */
  async function guardRelease(orderId: string, context: string) {
    let reason: string | null = null;
    let res = await assertOrderReleased({ orderId, context });
    if (!res.allowed && isSuperAdmin) {
      reason = window.prompt(
        `Auftrag ist nicht freigegeben (fehlend: ${res.missing.join(', ')}).\nSuper-Admin-Übersteuerung – bitte Begründung (min. 5 Zeichen):`,
      );
      if (reason && reason.trim().length >= 5) {
        res = await assertOrderReleased({
          orderId, context, isSuperAdmin: true, overrideReason: reason.trim(),
          userId: user?.id ?? null, userName,
        });
      }
    }
    if (!res.allowed) {
      toast.error(`Auslieferung gesperrt – fehlende Freigaben: ${res.missing.join(', ')}`);
      return false;
    }
    return true;
  }

  async function createTour() {
    const tourDate = newTour.date || day;
    if (pickedOrder && !(await guardRelease(pickedOrder.id, 'Tourenplanung'))) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('delivery_tours')
        .insert({
          tour_date: tourDate,
          title: newTour.title || `Tour ${format(new Date(tourDate), 'dd.MM.yyyy')}`,
          driver_id: newTour.driver_id || null,
          vehicle_id: newTour.vehicle_id || null,
          planned_start_time: newTour.start || '08:00',
          status: (pickedOrder ? 'geplant' : 'entwurf') as any,
        })
        .select('id')
        .single();
      if (error) { toast.error(error.message); return; }
      const tourId = data.id;

      if (pickedOrder) {
        const included = pickedItems.filter((i) => i.include && i.description.trim());
        const { data: appt, error: aErr } = await supabase
          .from('delivery_appointments')
          .insert({
            order_id: pickedOrder.id,
            customer_id: pickedOrder.customer_id,
            order_number: pickedOrder.order_number,
            customer_name: pickedOrder.customer_name || null,
            company_name: pickedOrder.company_name || null,
            contact_name: pickedOrder.contact_name || null,
            contact_email: pickedOrder.contact_email || null,
            contact_phone: pickedOrder.contact_phone || null,
            delivery_street: pickedOrder.street || null,
            delivery_zip: pickedOrder.zip || null,
            delivery_city: pickedOrder.city || null,
            delivery_country: pickedOrder.country || null,
            appointment_type: 'auslieferung' as any,
            status: 'intern_geplant' as any,
            planned_date: tourDate,
            time_window_start: newTour.start || '08:00',
            scope_of_delivery: `${partialDelivery ? 'Teillieferung' : 'Komplettlieferung'}: ${included.map((i) => `${i.quantity}× ${i.description}`).join(', ') || '—'}`,
          })
          .select('id, contact_email')
          .single();
        if (aErr) { toast.error(aErr.message); return; }

        await supabase.from('delivery_tour_stops').insert({ tour_id: tourId, appointment_id: appt.id, position: 1 });

        if (included.length) {
          const { data: list } = await supabase
            .from('delivery_loading_lists')
            .insert({ tour_id: tourId, notes: partialDelivery ? 'Teillieferung' : null })
            .select('id')
            .single();
          if (list) {
            await supabase.from('delivery_loading_items').insert(
              included.map((i, idx) => ({
                loading_list_id: list.id,
                appointment_id: appt.id,
                position: idx + 1,
                description: i.description,
                quantity: i.quantity,
                serial_number: i.serial_number || null,
              })),
            );
          }
        }

        if (appt.contact_email) {
          const { data: sendRes, error: sendErr } = await supabase.functions.invoke('delivery-appointment-send', {
            body: { appointmentId: appt.id, baseUrl: 'https://app.alixwork.de' },
          });
          if (sendErr || (sendRes as any)?.error) {
            toast.warning('Tour angelegt – Bestätigungs-E-Mail konnte nicht versendet werden.');
          } else {
            toast.success('Tour geplant · Bestätigungs-E-Mail an den Kunden versendet');
          }
        } else {
          toast.warning('Tour geplant – keine Kunden-E-Mail hinterlegt, keine Bestätigung versendet.');
        }
      } else {
        toast.success('Tour angelegt');
      }

      setNewTourOpen(false);
      setNewTour({ title: '', driver_id: '', vehicle_id: '', start: '08:00', date: tourDate });
      setPickedOrder(null);
      setPickedItems([]);
      setPartialDelivery(false);
      if (tourDate !== day) setDay(tourDate);
      setSelectedTour(tourId);
      refresh();
    } finally {
      setCreating(false);
    }
  }


  async function assignToTour(appointmentId: string, tourId: string) {
    const { data: appt } = await supabase
      .from('delivery_appointments').select('order_id').eq('id', appointmentId).maybeSingle();
    const orderId = (appt as any)?.order_id as string | undefined;
    if (orderId && !(await guardRelease(orderId, 'Tourenzuordnung'))) return;
    const existing = (stops as any[]).filter((s) => s.tour_id === tourId);
    const { error } = await supabase.from('delivery_tour_stops').insert({
      tour_id: tourId,
      appointment_id: appointmentId,
      position: existing.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from('delivery_appointments').update({ planned_date: day }).eq('id', appointmentId);
    toast.success('Termin der Tour zugeordnet');
    refresh();
  }

  async function removeStop(stopId: string) {
    const { error } = await supabase.from('delivery_tour_stops').delete().eq('id', stopId);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function reorder(fromStopId: string, toStopId: string) {
    if (fromStopId === toStopId) return;
    const list = [...tourStops];
    const from = list.findIndex((s) => s.id === fromStopId);
    const to = list.findIndex((s) => s.id === toStopId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    await Promise.all(list.map((s, i) => supabase.from('delivery_tour_stops').update({ position: i + 1 }).eq('id', s.id)));
    toast.success('Reihenfolge aktualisiert');
    refresh();
  }

  async function calcRoute(optimize: boolean) {
    if (!selectedTour) return;
    setCalcLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('delivery-route-calc', {
        body: { tour_id: selectedTour, optimize },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      toast.success(
        `${optimize ? 'Tour optimiert' : 'Route berechnet'}: ${d.total_distance_km} km · ${Math.round(d.total_drive_minutes)} Min. Fahrzeit`,
      );
      if (d.missing_geocode?.length) toast.warning(`Ohne gültige Lieferadresse (nicht in Route): ${d.missing_geocode.join(', ')}`);
      if (d.billing_fallback?.length) toast.info(`Rechnungsadresse als Lieferadresse genutzt: ${d.billing_fallback.join(', ')}`);
      if (d.provider === 'haversine') toast.warning('Schätzung per Luftlinie – kein Routing-Dienst verfügbar');
      refresh();
    } catch (e: any) {
      toast.error(e.message || 'Routenberechnung fehlgeschlagen');
    } finally {
      setCalcLoading(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <PageHeader title="Tagesplanung" subtitle="Ungeplante Termine, Touren und Routenoptimierung" icon={CalendarDays} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Datum</Label>
          <Input type="date" value={day} onChange={(e) => { setDay(e.target.value); setSelectedTour(null); }} className="w-44" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setDay(format(addDays(new Date(day), -1), 'yyyy-MM-dd'))}>‹ Vortag</Button>
        <Button variant="outline" size="sm" onClick={() => setDay(todayStr())}>Heute</Button>
        <Button variant="outline" size="sm" onClick={() => setDay(format(addDays(new Date(day), 1), 'yyyy-MM-dd'))}>Folgetag ›</Button>
        <div>
          <Label className="text-xs">PLZ-Filter</Label>
          <Input value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} placeholder="z. B. 10" className="w-28" />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value="kunde_bestaetigt">Kunde bestätigt</SelectItem>
              <SelectItem value="bestaetigung_versendet">Bestätigung versendet</SelectItem>
              <SelectItem value="intern_geplant">Intern geplant</SelectItem>
              <SelectItem value="entwurf">Entwurf</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={newTourOpen} onOpenChange={(o) => { setNewTourOpen(o); if (o) setNewTour((p) => ({ ...p, date: day })); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="ml-auto"><Plus className="mr-1 h-4 w-4" />Neue Tour</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>Neue Tour am {format(new Date(newTour.date || day), 'dd.MM.yyyy')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Tourdatum</Label><Input type="date" value={newTour.date} onChange={(e) => setNewTour({ ...newTour, date: e.target.value })} /></div>
              <TourOrderPicker
                order={pickedOrder}
                setOrder={setPickedOrder}
                items={pickedItems}
                setItems={setPickedItems}
                partial={partialDelivery}
                setPartial={setPartialDelivery}
              />
              <div><Label>Bezeichnung</Label><Input value={newTour.title} onChange={(e) => setNewTour({ ...newTour, title: e.target.value })} placeholder="z. B. Berlin Nord" /></div>

              <div>
                <Label>Fahrer</Label>
                <select
                  value={newTour.driver_id}
                  onChange={(e) => setNewTour({ ...newTour, driver_id: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Fahrer wählen</option>
                  {(drivers as any[]).map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
                {(drivers as any[]).length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Keine aktiven Fahrer vorhanden – unter Dispatch → Fahrer anlegen.</p>
                )}
              </div>
              <div>
                <Label>Fahrzeug</Label>
                <select
                  value={newTour.vehicle_id}
                  onChange={(e) => setNewTour({ ...newTour, vehicle_id: e.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Fahrzeug wählen</option>
                  {(vehicles as any[]).map((v) => <option key={v.id} value={v.id}>{v.license_plate}{v.name ? ` · ${v.name}` : ''}</option>)}
                </select>
                {(vehicles as any[]).length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Keine aktiven Fahrzeuge vorhanden – unter Dispatch → Fahrzeuge anlegen.</p>
                )}
              </div>

              <div><Label>Startzeit</Label><Input type="time" value={newTour.start} onChange={(e) => setNewTour({ ...newTour, start: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button onClick={createTour} disabled={creating}>
                {creating ? 'Wird angelegt…' : pickedOrder ? 'Tour anlegen & Bestätigung senden' : 'Tour anlegen'}
              </Button>
            </DialogFooter>

          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr_380px]">
        {/* Spalte 1: ungeplante Termine */}
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ungeplante Termine</h3>
            <Badge variant="secondary">{openAppointments.length}</Badge>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {openAppointments.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Keine offenen Termine.</p>}
            {openAppointments.map((a: any) => (
              <div
                key={a.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/appointment', a.id)}
                className="cursor-grab rounded-lg border border-border bg-background p-2 text-xs hover:border-primary/50"
              >
                <div className="flex items-center gap-1 font-medium">
                  {a.is_vip && <Crown className="h-3 w-3 text-amber-400" />}
                  {a.company_name || a.customer_name || 'Ohne Namen'}
                </div>
                <div className="text-muted-foreground">{a.order_number ?? '—'} · {DELIVERY_TYPE_LABELS[a.appointment_type] ?? a.appointment_type}</div>
                <div className="text-muted-foreground">{a.delivery_zip} {a.delivery_city}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className={`rounded-full border px-1.5 py-0.5 ${readinessClass(a.readiness)}`}>{READINESS_LABELS[a.readiness] ?? a.readiness ?? '—'}</span>
                  {a.time_window_start && <span className="rounded-full border border-border px-1.5 py-0.5">{a.time_window_start.slice(0, 5)}–{a.time_window_end?.slice(0, 5) ?? ''}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Spalte 2: Touren des Tages */}
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Touren am {format(new Date(day), 'dd.MM.yyyy')}</h3>
            <Badge variant="secondary">{(tours as any[]).length}</Badge>
          </div>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            {toursLoading && <p className="py-6 text-center text-xs text-muted-foreground">Lädt…</p>}
            {!toursLoading && (tours as any[]).length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Keine Tour für diesen Tag – oben „Neue Tour" anlegen.</p>
            )}
            {(tours as any[]).map((t: any) => {
              const list = (stops as any[]).filter((s) => s.tour_id === t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTour(t.id)}
                  onDragOver={(e) => { if (e.dataTransfer.types.includes('text/appointment')) e.preventDefault(); }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData('text/appointment');
                    if (id) { e.preventDefault(); assignToTour(id, t.id); }
                  }}
                  className={`cursor-pointer rounded-lg border p-3 transition ${selectedTour === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold"><Truck className="h-4 w-4 text-primary" />{t.tour_number} · {t.title ?? '—'}</div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(t.status)}`}>{TOUR_STATUS_LABELS[t.status] ?? t.status}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-3">
                    <span>{t.drivers?.full_name ?? 'Kein Fahrer'}</span>
                    <span>{t.vehicles?.license_plate ?? 'Kein Fahrzeug'}</span>
                    <span>{t.planned_start_time?.slice(0, 5) ?? '—'}{t.planned_end_time ? `–${t.planned_end_time.slice(0, 5)}` : ''}</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{list.length} Stopps</span>
                    <span className="flex items-center gap-1"><RouteIcon className="h-3 w-3" />{t.planned_distance_km ?? 0} km</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.planned_drive_minutes ?? 0} Min.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Number(t.utilization_pct ?? 0))}%` }} />
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Gauge className="h-3 w-3" />{Math.round(Number(t.utilization_pct ?? 0))}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Spalte 3: Tourdetail */}
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{currentTour ? `${currentTour.tour_number} – Stopps` : 'Tourdetails'}</h3>
            {currentTour && <Badge variant="secondary">{tourStops.length}</Badge>}
          </div>
          {!currentTour && <p className="py-8 text-center text-xs text-muted-foreground">Tour in der Mitte auswählen.</p>}
          {currentTour && (
            <>
              <div className="mb-3 flex gap-2">
                <Button size="sm" variant="outline" disabled={calcLoading || !tourStops.length} onClick={() => calcRoute(false)}>
                  <RouteIcon className="mr-1 h-4 w-4" />Route berechnen
                </Button>
                <Button size="sm" disabled={calcLoading || tourStops.length < 2} onClick={() => calcRoute(true)}>
                  <Wand2 className="mr-1 h-4 w-4" />Tour optimieren
                </Button>
              </div>
              <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                {tourStops.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Termine aus der linken Spalte auf die Tour ziehen.</p>}
                {tourStops.map((s: any) => {
                  const a = s.delivery_appointments;
                  return (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/stop', s.id)}
                      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/stop')) e.preventDefault(); }}
                      onDrop={(e) => {
                        const from = e.dataTransfer.getData('text/stop');
                        if (from) { e.preventDefault(); reorder(from, s.id); }
                      }}
                      className="cursor-grab rounded-lg border border-border bg-background p-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1 font-medium">
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[10px] text-primary">{s.position}</span>
                            {a?.is_vip && <Crown className="h-3 w-3 text-amber-400" />}
                            {a?.company_name || a?.customer_name || '—'}
                          </div>
                          <div className="text-muted-foreground">{a?.delivery_street}, {a?.delivery_zip} {a?.delivery_city}</div>
                          <div className="text-muted-foreground">
                            {s.planned_arrival ? `Ankunft ${format(new Date(s.planned_arrival), 'HH:mm')}` : 'Ankunft offen'}
                            {s.distance_from_prev_km != null ? ` · ${s.distance_from_prev_km} km` : ''}
                            {s.drive_minutes_from_prev != null ? ` · ${s.drive_minutes_from_prev} Min.` : ''}
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeStop(s.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded-lg border border-border p-2 text-xs text-muted-foreground">
                Gesamt: {currentTour.planned_distance_km ?? 0} km · Fahrzeit {currentTour.planned_drive_minutes ?? 0} Min. ·
                Arbeitszeit {currentTour.planned_work_minutes ?? 0} Min. · Auslastung {Math.round(Number(currentTour.utilization_pct ?? 0))} %
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
