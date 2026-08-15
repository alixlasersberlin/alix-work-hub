import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Navigation, Phone, User, ClipboardList, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { mapsHref, telHref, cacheGet, cacheSet } from '@/lib/mobil/utils';

const STOP_STATES = [
  { key: 'kunde_bestaetigt', label: 'Offen' },
  { key: 'unterwegs', label: 'Unterwegs' },
  { key: 'angekommen', label: 'Angekommen' },
  { key: 'erfolgreich_ausgeliefert', label: 'Erledigt' },
  { key: 'lieferung_fehlgeschlagen', label: 'Problem' },
] as const;

export default function MobilTourDetail() {
  const { tourId } = useParams<{ tourId: string }>();
  const cacheKey = `tour:${tourId}`;
  const cached = cacheGet<{ tour: any; stops: any[] }>(cacheKey);
  const [tour, setTour] = useState<any>(cached?.tour ?? null);
  const [stops, setStops] = useState<any[]>(cached?.stops ?? []);
  const [loading, setLoading] = useState(!cached);
  const [busy, setBusy] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = async () => {
    const [{ data: t }, { data: s, error }] = await Promise.all([
      supabase.from('delivery_tours').select('*').eq('id', tourId!).maybeSingle(),
      supabase
        .from('delivery_tour_stops')
        .select(
          '*, delivery_appointments:appointment_id(id, customer_name, company_name, order_number, device_name, serial_number, delivery_street, delivery_zip, delivery_city, contact_phone, contact_mobile, status, customer_id)',
        )
        .eq('tour_id', tourId!)
        .order('position'),
    ]);
    if (error) { setOffline(true); setLoading(false); return; }
    setOffline(false);
    setTour(t);
    setStops(s ?? []);
    cacheSet(cacheKey, { tour: t, stops: s ?? [] });
    setLoading(false);
  };

  useEffect(() => { if (tourId) load(); /* eslint-disable-next-line */ }, [tourId]);

  const setStatus = async (stop: any, status: string) => {
    setBusy(stop.id);
    const { error } = await supabase.from('delivery_tour_stops').update({ stop_status: status as any }).eq('id', stop.id);
    setBusy(null);
    if (error) {
      toast.error('Keine Verbindung – Aktion wird erneut übertragen.');
      return;
    }
    setStops((prev) => prev.map((s) => (s.id === stop.id ? { ...s, stop_status: status } : s)));
    if (status === 'erfolgreich_ausgeliefert') toast.success('Stopp erledigt');
  };

  const nextStop = useMemo(
    () => stops.find((s) => s.stop_status !== 'erfolgreich_ausgeliefert' && s.stop_status !== 'abgeschlossen'),
    [stops],
  );

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  if (!tour) return <div className="p-6 text-sm text-muted-foreground">Tour nicht gefunden.</div>;

  return (
    <div className="p-4 space-y-3">
      <div>
        <h1 className="text-xl font-bold">{tour.title || tour.tour_number}</h1>
        <div className="text-sm text-muted-foreground">
          {tour.tour_date ? format(new Date(tour.tour_date), 'EEEE, dd.MM.yyyy') : ''} · {stops.length} Stopps
        </div>
      </div>
      {offline && <Card className="p-3 text-xs text-amber-500">Offline – gespeicherte Tourdaten werden angezeigt.</Card>}

      {nextStop && (
        <Card className="p-4 border-primary/40 bg-primary/5">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Nächster Stopp</div>
          <div className="font-bold">{nextStop.delivery_appointments?.company_name || nextStop.delivery_appointments?.customer_name || '—'}</div>
          <div className="text-sm text-muted-foreground">
            {nextStop.distance_from_prev_km ? `Entfernung: ${nextStop.distance_from_prev_km} km · ` : ''}
            {nextStop.drive_minutes_from_prev ? `Fahrzeit: ca. ${nextStop.drive_minutes_from_prev} Min.` : ''}
          </div>
          <Button asChild className="w-full h-12 mt-3">
            <a href={mapsHref(addrOf(nextStop))}><Navigation className="w-4 h-4 mr-2" /> Navigation starten</a>
          </Button>
        </Card>
      )}

      {stops.map((s) => {
        const a = s.delivery_appointments;
        const address = addrOf(s);
        const tel = telHref(a?.contact_mobile || a?.contact_phone);
        const done = s.stop_status === 'erfolgreich_ausgeliefert';
        return (
          <Card key={s.id} className={`p-4 space-y-3 ${done ? 'opacity-70' : ''}`}>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stopp {s.position}</div>
              <div className="text-base font-bold">{a?.company_name || a?.customer_name || '—'}</div>
              <div className="text-sm">{address || 'keine Adresse'}</div>
              <div className="text-sm text-muted-foreground">
                {s.planned_arrival ? `Geplant: ${format(new Date(s.planned_arrival), 'HH:mm')} Uhr` : ''}
                {a?.order_number ? ` · Auftrag: ${a.order_number}` : ''}
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {STOP_STATES.map((st) => (
                <Button
                  key={st.key}
                  size="sm"
                  variant={s.stop_status === st.key ? 'default' : 'outline'}
                  className="h-10 text-xs"
                  disabled={busy === s.id}
                  onClick={() => setStatus(s, st.key)}
                >
                  {st.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button asChild className="h-12" disabled={!address}>
                <a href={address ? mapsHref(address) : undefined}><Navigation className="w-4 h-4 mr-1" /> Navigation</a>
              </Button>
              <Button asChild variant="outline" className="h-12" disabled={!tel}>
                <a href={tel}><Phone className="w-4 h-4 mr-1" /> Anrufen</a>
              </Button>
              <Button asChild variant="outline" className="h-12" disabled={!a?.customer_id}>
                <Link to={a?.customer_id ? `/kunden/${a.customer_id}` : '#'}><User className="w-4 h-4 mr-1" /> Kunde</Link>
              </Button>
              <Button asChild variant="outline" className="h-12" disabled={!a?.order_number}>
                <Link to={`/mobil/suche?q=${encodeURIComponent(a?.order_number ?? '')}`}>
                  <ClipboardList className="w-4 h-4 mr-1" /> Auftrag
                </Link>
              </Button>
            </div>

            <Button
              className="w-full h-14 text-base"
              disabled={busy === s.id || done}
              onClick={() => setStatus(s, 'erfolgreich_ausgeliefert')}
            >
              {busy === s.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
              {done ? 'ERLEDIGT' : 'STOPP ERLEDIGT'}
            </Button>
          </Card>
        );
      })}

      {stops.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Keine Stopps geplant.</Card>}

      <Button asChild variant="outline" className="w-full h-12">
        <Link to="/mobil/touren">Zurück zu den Touren <ArrowRight className="w-4 h-4 ml-1" /></Link>
      </Button>
    </div>
  );
}

function addrOf(stop: any) {
  const a = stop?.delivery_appointments;
  return [a?.delivery_street, [a?.delivery_zip, a?.delivery_city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}
