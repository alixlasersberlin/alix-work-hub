import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

declare global { interface Window { google?: any; initDispatchMap?: () => void } }

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve();
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
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
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initDispatchMap`;
    s.onerror = () => reject(new Error('Google Maps konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

function addressString(a: any): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  return a.raw || [a.street, a.zip, a.city].filter(Boolean).join(', ');
}

export default function TourenKarte() {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tech, setTech] = useState('all');
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('route_plans')
        .select('*')
        .eq('planned_date', date)
        .order('time_window_start', { ascending: true, nullsFirst: true });
      setTours(data ?? []);
      setLoading(false);
    })();
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 51.1657, lng: 10.4515 },
          zoom: 6,
        });
        const filtered = tours.filter(t => tech === 'all' || t.assigned_employee === tech);
        if (filtered.length === 0) return;
        const geocoder = new window.google.maps.Geocoder();
        const bounds = new window.google.maps.LatLngBounds();
        const path: any[] = [];
        for (let i = 0; i < filtered.length; i++) {
          const t = filtered[i];
          const addr = addressString(t.location_address);
          if (!addr) continue;
          try {
            const res: any = await new Promise((resolve, reject) => {
              geocoder.geocode({ address: addr }, (r: any, st: any) =>
                st === 'OK' ? resolve(r) : reject(st));
            });
            const loc = res[0].geometry.location;
            new window.google.maps.Marker({
              map, position: loc,
              label: { text: String(i + 1), color: '#000' },
              title: `${t.tour_type || 'Tour'} · ${t.contact_name || ''}`,
            });
            bounds.extend(loc);
            path.push(loc);
          } catch { /* skip geocode failures */ }
        }
        if (path.length > 1) {
          new window.google.maps.Polyline({ map, path, strokeColor: '#facc15', strokeWeight: 3 });
        }
        if (!bounds.isEmpty()) map.fitBounds(bounds);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Fehler');
      }
    })();
    return () => { cancelled = true; };
  }, [tours, tech]);

  const techs = Array.from(new Set(tours.map(t => t.assigned_employee).filter(Boolean))) as string[];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          Kartenansicht
        </h1>
        <div className="flex gap-2">
          <input type="date" className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm" value={date} onChange={e => setDate(e.target.value)} />
          <Select value={tech} onValueChange={setTech}>
            <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Techniker</SelectItem>
              {techs.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive p-3 mb-3 text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card overflow-hidden card-glow">
        <div ref={mapRef} className="w-full" style={{ height: '70vh' }} />
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-2">
        {tours.filter(t => tech === 'all' || t.assigned_employee === tech).map((t, i) => (
          <button
            key={t.id}
            onClick={() => navigate(`/tourenplanung/${t.id}`)}
            className="text-left rounded-lg border border-border bg-card p-3 hover:border-primary"
          >
            <div className="text-sm font-bold">{i + 1}. {t.tour_type || 'Tour'} · {t.contact_name || 'Kunde'}</div>
            <div className="text-xs text-muted-foreground">{addressString(t.location_address)}</div>
            <div className="text-xs text-muted-foreground">
              {t.time_window_start?.slice(0,5)}–{t.time_window_end?.slice(0,5)} · {t.assigned_employee || '—'} · {t.planning_status}
            </div>
          </button>
        ))}
        {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/>Laden …</div>}
      </div>
    </div>
  );
}
