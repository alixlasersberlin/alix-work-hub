import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Package, Truck, CheckCircle2, Clock } from 'lucide-react';
import { DELIVERY_STATUS_LABELS } from '@/pages/Dispatch/constants';

type Tracking = {
  appointment: any;
  stop: any;
  events: { event_type: string; message: string | null; eta: string | null; created_at: string }[];
};

const EVENT_LABELS: Record<string, string> = {
  geplant: 'Termin geplant',
  bestaetigt: 'Termin bestätigt',
  unterwegs: 'Fahrzeug unterwegs',
  naechster_stopp: 'Sie sind der nächste Stopp',
  angekommen: 'Fahrzeug vor Ort',
  zugestellt: 'Lieferung abgeschlossen',
  verspaetung: 'Verspätung',
  hinweis: 'Hinweis',
};

function fmtDate(d?: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}
function fmtTime(t?: string | null) {
  if (!t) return null;
  return new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function Lieferstatus() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Tracking | null>(null);

  async function load() {
    const { data: res, error: err } = await supabase.functions.invoke('delivery-tracking', { body: { token } });
    if (err || (res as any)?.error) setError((res as any)?.error ?? 'Dieser Link ist ungültig oder abgelaufen.');
    else setData(res as Tracking);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center text-muted-foreground">{error}</CardContent>
        </Card>
      </div>
    );
  }

  const a = data.appointment;
  const delivered = !!a.delivered_at || a.status === 'erfolgreich_ausgeliefert';
  const eta = data.stop?.actual_arrival || data.stop?.planned_arrival || data.events.find(e => e.eta)?.eta;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="h-5 w-5 text-primary" /> Ihre Lieferung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={delivered ? 'default' : 'secondary'}>
                {DELIVERY_STATUS_LABELS[a.status as keyof typeof DELIVERY_STATUS_LABELS] ?? a.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Auftrag</span>
              <span className="font-medium">{a.order_number ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Termin</span>
              <span className="font-medium">
                {fmtDate(a.planned_date)}
                {a.time_window_start ? ` · ${a.time_window_start.slice(0, 5)}–${(a.time_window_end ?? '').slice(0, 5)}` : ''}
              </span>
            </div>
            {eta && !delivered && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Voraussichtliche Ankunft</span>
                <span className="font-medium flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {fmtTime(eta)} Uhr
                </span>
              </div>
            )}
            {a.device_name && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Package className="h-3.5 w-3.5" /> Gerät</span>
                <span className="font-medium">{a.device_name}</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Adresse</span>
              <span className="font-medium text-right">
                {[a.street, [a.zip, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sendungsverlauf</CardTitle>
          </CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sobald Ihre Lieferung unterwegs ist, sehen Sie hier den aktuellen Stand.</p>
            ) : (
              <ol className="relative border-l border-border pl-5 space-y-4">
                {data.events.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary/15">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    </span>
                    <p className="text-sm font-medium">{EVENT_LABELS[e.event_type] ?? e.event_type}</p>
                    {e.message && <p className="text-xs text-muted-foreground">{e.message}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {delivered && <RatingCard token={token!} appointmentId={a.id} tourId={data.stop?.tour_id ?? null} />}

        <p className="text-center text-xs text-muted-foreground">Diese Seite aktualisiert sich automatisch.</p>
      </div>
    </div>
  );
}

function RatingCard({ token, appointmentId, tourId }: { token: string; appointmentId?: string | null; tourId?: string | null }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!rating) return;
    setSaving(true);
    const { error } = await supabase.from('delivery_ratings').insert({
      token,
      appointment_id: appointmentId ?? null,
      tour_id: tourId ?? null,
      rating,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (!error) setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          Vielen Dank für Ihre Bewertung!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Wie zufrieden waren Sie mit der Lieferung?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} Sterne`}>
              <Star className={`h-7 w-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
        <Textarea
          placeholder="Ihr Kommentar (optional)"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
        />
        <Button className="w-full" disabled={!rating || saving} onClick={submit}>
          Bewertung absenden
        </Button>
      </CardContent>
    </Card>
  );
}

