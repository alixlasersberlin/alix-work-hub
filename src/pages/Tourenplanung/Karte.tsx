import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, Truck, Package, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { downloadToursPdf } from '@/lib/dispatch/tour-pdf';

declare global { interface Window { google?: any; initDispatchMap?: () => void } }

const TOUR_COLORS = ['#facc15', '#38bdf8', '#a78bfa', '#34d399', '#fb7185', '#f97316'];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    // The BYOK connection is the second linked Google Maps connection and
    // therefore receives the `_1` suffix. Prefer it over Lovable's managed key
    // so Maps also works on app.alixwork.de.
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY_1
      || import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID_1
      || import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error('Google Maps Browser-Key fehlt'));
    const id = 'gmaps-js';
    if (document.getElementById(id)) {
      const i = setInterval(() => { if (window.google?.maps) { clearInterval(i); resolve(); } }, 100);
      return;
    }
    window.initDispatchMap = () => resolve();
    const s = document.createElement('script');
    s.id = id;
    s.async = true;
    const channelParam = channel ? `&channel=${encodeURIComponent(channel)}` : '';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=initDispatchMap${channelParam}`;
    s.onerror = () => reject(new Error('Google Maps konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

function addressString(a: any): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return a.raw || [a.street, a.zip, a.city].filter(Boolean).join(', ');
}

function apptAddress(a: any): string {
  return [a?.delivery_street, [a?.delivery_zip, a?.delivery_city].filter(Boolean).join(' '), a?.delivery_country]
    .filter(Boolean).join(', ');
}

function hhmm(v?: string | null) {
  if (!v) return null;
  const dt = new Date(v);
  if (!Number.isNaN(dt.getTime()) && String(v).includes('T')) {
    return dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }
  return String(v).slice(0, 5);
}

export default function TourenKarte() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tech, setTech] = useState('all');
  const [driver, setDriver] = useState('all');
  const [tours, setTours] = useState<any[]>([]);
  const [dayTours, setDayTours] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [plans, dt, appts] = await Promise.all([
        supabase.from('route_plans').select('*').eq('planned_date', date)
          .order('time_window_start', { ascending: true, nullsFirst: true }),
        supabase.from('delivery_tours')
          .select('id, tour_number, title, status, tour_date, planned_start_time, planned_distance_km, planned_drive_minutes, drivers:driver_id(id, full_name), vehicles:vehicle_id(license_plate), stops:delivery_tour_stops(id, position, planned_arrival, stop_status, appointment:appointment_id(id, order_number, customer_name, company_name, device_name, serial_number, contact_name, contact_phone, delivery_street, delivery_zip, delivery_city, delivery_country, delivery_lat, delivery_lng, time_window_start, time_window_end))')
          .eq('tour_date', date)
          .order('tour_number'),
        supabase.from('delivery_appointments')
          .select('id, order_id, order_number, customer_name, company_name, device_name, serial_number, status, appointment_type, contact_name, contact_phone, delivery_street, delivery_zip, delivery_city, delivery_country, delivery_lat, delivery_lng, time_window_start, time_window_end, is_vip')
          .eq('planned_date', date)
          .order('time_window_start', { ascending: true, nullsFirst: true }),
      ]);
      if (cancelled) return;
      setTours(plans.data ?? []);
      setDayTours(dt.data ?? []);
      setAppointments(appts.data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [date]);

  const drivers = useMemo(() => {
    const map = new Map<string, string>();
    dayTours.forEach((t: any) => { if (t.drivers?.id) map.set(t.drivers.id, t.drivers.full_name ?? 'Fahrer'); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [dayTours]);

  const visibleTours = useMemo(
    () => dayTours.filter((t: any) => driver === 'all' || t.drivers?.id === driver),
    [dayTours, driver],
  );

  const tourApptIds = useMemo(() => {
    const s = new Set<string>();
    dayTours.forEach((t: any) => (t.stops ?? []).forEach((st: any) => st.appointment?.id && s.add(st.appointment.id)));
    return s;
  }, [dayTours]);

  const unassignedAppointments = useMemo(
    () => appointments.filter((a: any) => !tourApptIds.has(a.id)),
    [appointments, tourApptIds],
  );

  const visiblePlans = useMemo(
    () => tours.filter(t => tech === 'all' || t.assigned_employee === tech),
    [tours, tech],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;
        const g = window.google.maps;
        const map = new g.Map(mapRef.current, { center: { lat: 51.1657, lng: 10.4515 }, zoom: 6 });
        const bounds = new g.LatLngBounds();
        const geocoder = new g.Geocoder();

        const geocode = async (addr: string) => {
          if (!addr) return null;
          try {
            const res: any = await new Promise((resolve, reject) => {
              geocoder.geocode({ address: addr }, (r: any, st: any) => (st === 'OK' ? resolve(r) : reject(st)));
            });
            return res[0].geometry.location;
          } catch { return null; }
        };

        // 1) Touren des Tages (Fahrer-Route)
        for (let ti = 0; ti < visibleTours.length; ti++) {
          const t = visibleTours[ti];
          const color = TOUR_COLORS[ti % TOUR_COLORS.length];
          const stops = (t.stops ?? []).slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
          const path: any[] = [];
          for (let i = 0; i < stops.length; i++) {
            const a = stops[i].appointment;
            if (!a) continue;
            const pos = a.delivery_lat && a.delivery_lng
              ? new g.LatLng(Number(a.delivery_lat), Number(a.delivery_lng))
              : await geocode(apptAddress(a));
            if (!pos || cancelled) continue;
            new g.Marker({
              map, position: pos,
              label: { text: String(stops[i].position ?? i + 1), color: '#000', fontWeight: 'bold' },
              icon: { path: g.SymbolPath.CIRCLE, scale: 12, fillColor: color, fillOpacity: 1, strokeColor: '#111', strokeWeight: 1 },
              title: `${t.tour_number} · ${a.order_number ?? 'Auftrag'} · ${a.company_name || a.customer_name || ''}`,
            });
            bounds.extend(pos);
            path.push(pos);
          }
          if (path.length > 1) new g.Polyline({ map, path, strokeColor: color, strokeWeight: 4, strokeOpacity: 0.9 });
        }

        // 2) Aufträge des Tages ohne Tourzuordnung
        for (const a of unassignedAppointments) {
          const pos = a.delivery_lat && a.delivery_lng
            ? new g.LatLng(Number(a.delivery_lat), Number(a.delivery_lng))
            : await geocode(apptAddress(a));
          if (!pos || cancelled) continue;
          new g.Marker({
            map, position: pos,
            icon: { path: g.SymbolPath.CIRCLE, scale: 8, fillColor: '#94a3b8', fillOpacity: 0.9, strokeColor: '#111', strokeWeight: 1 },
            title: `Ohne Tour · ${a.order_number ?? ''} · ${a.company_name || a.customer_name || ''}`,
          });
          bounds.extend(pos);
        }

        // 3) Tourenplanung (route_plans)
        for (let i = 0; i < visiblePlans.length; i++) {
          const t = visiblePlans[i];
          const pos = await geocode(addressString(t.location_address));
          if (!pos || cancelled) continue;
          new g.Marker({
            map, position: pos,
            label: { text: String(i + 1), color: '#000' },
            title: `${t.tour_type || 'Tour'} · ${t.contact_name || ''}`,
          });
          bounds.extend(pos);
        }

        if (!cancelled && !bounds.isEmpty()) map.fitBounds(bounds);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Fehler');
      }
    })();
    return () => { cancelled = true; };
  }, [visibleTours, unassignedAppointments, visiblePlans]);

  const techs = Array.from(new Set(tours.map(t => t.assigned_employee).filter(Boolean))) as string[];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        icon={MapPin}
        title="Kartenansicht"
        subtitle="Aufträge des Tages und Fahrer-Touren auf der Karte"
        noBreadcrumbs
        actions={
          <>
            <input type="date" className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm" value={date} onChange={e => setDate(e.target.value)} />
            <Select value={driver} onValueChange={setDriver}>
              <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Fahrer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Fahrer</SelectItem>
                {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tech} onValueChange={setTech}>
              <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Techniker</SelectItem>
                {techs.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-3 mb-3 text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
        <div ref={mapRef} className="w-full" style={{ height: '70vh' }} />
      </div>

      {loading && (
        <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Laden …
        </div>
      )}

      {/* Touren des Fahrers */}
      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
          <Truck className="w-4 h-4" /> Touren am {format(new Date(date), 'dd.MM.yyyy')} ({visibleTours.length})
        </h2>
        {visibleTours.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Tour für diesen Tag/Fahrer geplant.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleTours.map((t: any, ti: number) => {
              const stops = (t.stops ?? []).slice().sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
              const color = TOUR_COLORS[ti % TOUR_COLORS.length];
              return (
                <div key={t.id} className="rounded-lg border border-border bg-card p-3">
                  <button
                    onClick={() => navigate(`/dispatch/touren/${t.id}`)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
                      {t.tour_number}{t.title ? ` · ${t.title}` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[t.drivers?.full_name ?? 'Ohne Fahrer', t.vehicles?.license_plate, t.planned_start_time ? `${String(t.planned_start_time).slice(0, 5)} Uhr` : null,
                        t.planned_distance_km != null ? `${t.planned_distance_km} km` : null, t.status].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                  <ol className="mt-2 space-y-1">
                    {stops.length === 0 && <li className="text-xs text-muted-foreground">Keine Stopps zugeordnet.</li>}
                    {stops.map((s: any, i: number) => (
                      <li key={s.id} className="text-xs text-muted-foreground">
                        <span className="font-mono text-primary">{s.position ?? i + 1}.</span>{' '}
                        <span className="font-mono">{s.appointment?.order_number ?? 'Ohne Auftrag'}</span>
                        {' · '}{s.appointment?.company_name || s.appointment?.customer_name || 'Kunde'}
                        {s.appointment ? ` · ${apptAddress(s.appointment)}` : ''}
                        {hhmm(s.planned_arrival) ? ` · ${hhmm(s.planned_arrival)}` : ''}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Aufträge des Tages ohne Tour */}
      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
          <Package className="w-4 h-4" /> Aufträge des Tages ohne Tour ({unassignedAppointments.length})
        </h2>
        {unassignedAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Alle Aufträge des Tages sind einer Tour zugeordnet.</p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            {unassignedAppointments.map((a: any) => (
              <div key={a.id} className="rounded-lg border border-border bg-card p-3">
                <div className="text-sm font-bold">
                  {a.is_vip ? '👑 ' : ''}<span className="font-mono">{a.order_number ?? 'Ohne Auftrag'}</span> · {a.company_name || a.customer_name || 'Kunde'}
                </div>
                <div className="text-xs text-muted-foreground">{apptAddress(a) || 'Keine Lieferadresse'}</div>
                <div className="text-xs text-muted-foreground">
                  {[a.device_name, a.serial_number, [hhmm(a.time_window_start), hhmm(a.time_window_end)].filter(Boolean).join('–'), a.status]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tourenplanung (route_plans) */}
      {visiblePlans.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Tourenplanung ({visiblePlans.length})
          </h2>
          <div className="grid gap-2 lg:grid-cols-2">
            {visiblePlans.map((t, i) => (
              <button
                key={t.id}
                onClick={() => navigate(`/tourenplanung/${t.id}`)}
                className="text-left rounded-lg border border-border bg-card p-3 hover:border-primary"
              >
                <div className="text-sm font-bold">{i + 1}. {t.tour_type || 'Tour'} · {t.contact_name || 'Kunde'}</div>
                <div className="text-xs text-muted-foreground">{addressString(t.location_address)}</div>
                <div className="text-xs text-muted-foreground">
                  {t.time_window_start?.slice(0, 5)}–{t.time_window_end?.slice(0, 5)} · {t.assigned_employee || '—'} · {t.planning_status}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
