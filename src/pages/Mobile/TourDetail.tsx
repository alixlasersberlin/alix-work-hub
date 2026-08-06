import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Navigation, Phone, Loader2, Play, Flag, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DELIVERY_STATUS_LABELS, statusClass } from '@/pages/Dispatch/constants';

export default function MobileTourDetail() {
  const { tourId } = useParams<{ tourId: string }>();
  const [tour, setTour] = useState<any>(null);
  const [stops, setStops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('delivery_tours').select('*, vehicles:vehicle_id(license_plate)').eq('id', tourId!).maybeSingle(),
      supabase
        .from('delivery_tour_stops')
        .select('*, delivery_appointments:appointment_id(id, customer_name, company_name, order_number, device_name, serial_number, delivery_street, delivery_zip, delivery_city, contact_phone, contact_mobile, status)')
        .eq('tour_id', tourId!)
        .order('position'),
    ]);
    setTour(t);
    setStops(s ?? []);
    setLoading(false);
  };

  useEffect(() => { if (tourId) load(); /* eslint-disable-next-line */ }, [tourId]);

  const startTour = async () => {
    setBusy(true);
    const { error } = await supabase.from('delivery_tours')
      .update({ status: 'aktiv', actual_start_at: new Date().toISOString() })
      .eq('id', tourId!);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Tour gestartet');
    load();
  };

  const endTour = async () => {
    setBusy(true);
    const { error } = await supabase.from('delivery_tours')
      .update({ status: 'abgeschlossen', actual_end_at: new Date().toISOString() })
      .eq('id', tourId!);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Tour abgeschlossen');
    load();
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;
  if (!tour) return <div className="p-6 text-sm text-muted-foreground">Tour nicht gefunden.</div>;

  return (
    <div className="p-4 space-y-3">
      <Link to="/m/tour" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="w-4 h-4" /> Touren
      </Link>
      <div>
        <h1 className="text-xl font-bold">{tour.tour_number}</h1>
        <div className="text-xs text-muted-foreground">
          {tour.tour_date ? format(new Date(tour.tour_date), 'EEEE, dd.MM.yyyy') : ''} · {stops.length} Stopps
          {tour.vehicles?.license_plate ? ` · ${tour.vehicles.license_plate}` : ''}
        </div>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1 h-11" onClick={startTour} disabled={busy || tour.status === 'aktiv' || tour.status === 'abgeschlossen'}>
          <Play className="w-4 h-4 mr-1" /> Tour starten
        </Button>
        <Button variant="outline" className="flex-1 h-11" onClick={endTour} disabled={busy || tour.status !== 'aktiv'}>
          <Flag className="w-4 h-4 mr-1" /> Tour beenden
        </Button>
      </div>

      {stops.map(s => {
        const a = s.delivery_appointments;
        const address = [a?.delivery_street, `${a?.delivery_zip ?? ''} ${a?.delivery_city ?? ''}`].filter(Boolean).join(', ');
        const phone = a?.contact_mobile || a?.contact_phone;
        return (
          <Card key={s.id} className="p-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">{s.position}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{a?.customer_name ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{a?.order_number ?? ''} · {a?.device_name ?? ''}</div>
                <div className="text-xs text-muted-foreground">{address || 'keine Adresse'}</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${statusClass(a?.status)}`}>
                {DELIVERY_STATUS_LABELS[a?.status] ?? a?.status ?? '—'}
              </span>
              {s.planned_arrival && (
                <Badge variant="outline" className="text-[10px]"><Clock className="w-3 h-3 mr-1" />{format(new Date(s.planned_arrival), 'HH:mm')}</Badge>
              )}
              {s.delay_minutes ? <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40">+{s.delay_minutes} Min.</Badge> : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button asChild size="sm" variant="outline" className="h-10">
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
                  <Navigation className="w-4 h-4 mr-1" /> Route
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-10" disabled={!phone}>
                <a href={phone ? `tel:${phone}` : undefined}><Phone className="w-4 h-4 mr-1" /> Anruf</a>
              </Button>
              <Button asChild size="sm" className="h-10">
                <Link to={`/m/tour/${tourId}/stopp/${s.id}`}>Öffnen</Link>
              </Button>
            </div>
          </Card>
        );
      })}
      {stops.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Keine Stopps geplant.</Card>}
    </div>
  );
}
