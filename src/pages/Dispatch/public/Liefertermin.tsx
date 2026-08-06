import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { CalendarCheck, CalendarX, CalendarClock, PhoneCall, Loader2, MapPin, Package } from 'lucide-react';
import { toast } from 'sonner';
import { DELIVERY_TYPE_LABELS } from '@/pages/Dispatch/constants';

type Appt = {
  id: string; order_number: string | null; customer_name: string | null; company_name: string | null;
  contact_name: string | null; contact_phone: string | null; appointment_type: string | null;
  planned_date: string | null; time_window_start: string | null; time_window_end: string | null;
  promised_window: string | null; device_name: string | null; scope_of_delivery: string | null;
  requires_training: boolean | null; delivery_street: string | null; delivery_zip: string | null;
  delivery_city: string | null; delivery_country: string | null; already_answered: boolean;
};

type Mode = 'confirm' | 'reject' | 'alternative' | 'callback';

function fmtDate(d?: string | null) {
  if (!d) return 'wird noch mitgeteilt';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

export default function LieferterminBestaetigung() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appt, setAppt] = useState<Appt | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Mode | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [correctedAddress, setCorrectedAddress] = useState('');
  const [comment, setComment] = useState('');
  const [altDate, setAltDate] = useState('');
  const [altStart, setAltStart] = useState('');
  const [altEnd, setAltEnd] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('delivery-confirmation-submit', {
        body: { action: 'get', token },
      });
      if (cancelled) return;
      if (error || (data as any)?.error) {
        setError((data as any)?.error ?? 'Dieser Link ist ungültig oder abgelaufen.');
      } else {
        const a = (data as any).appointment as Appt;
        setAppt(a);
        setContactName(a.contact_name ?? '');
        setContactPhone(a.contact_phone ?? '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  async function submit(response: Mode) {
    if (response === 'alternative' && !altDate) { toast.error('Bitte Wunschdatum angeben'); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke('delivery-confirmation-submit', {
      body: {
        action: 'submit', token, response,
        contactName, contactPhone, correctedAddress, comment,
        alternativeDate: altDate || null, alternativeStart: altStart || null, alternativeEnd: altEnd || null,
        callbackRequested: response === 'callback',
      },
    });
    setSending(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error ?? 'Übermittlung fehlgeschlagen'); return; }
    setDone(response);
  }

  const window = appt?.time_window_start
    ? `${appt.time_window_start.slice(0, 5)} – ${(appt.time_window_end ?? '').slice(0, 5)} Uhr`
    : appt?.promised_window || 'wird noch mitgeteilt';

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <h1 className="text-center text-xl font-semibold tracking-tight">Ihr Liefertermin</h1>

        {loading && (
          <Card><CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Termin wird geladen …
          </CardContent></Card>
        )}

        {!loading && error && (
          <Card><CardHeader><CardTitle className="text-base">Link nicht gültig</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{error}</CardContent></Card>
        )}

        {!loading && appt && done && (
          <Card><CardHeader><CardTitle className="text-base">Vielen Dank!</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                {done === 'confirm' && 'Ihr Liefertermin ist bestätigt. Sie erhalten rechtzeitig eine Erinnerung.'}
                {done === 'reject' && 'Ihre Absage wurde übermittelt. Wir melden uns bei Ihnen.'}
                {done === 'alternative' && 'Ihr Terminwunsch wurde übermittelt. Wir prüfen ihn und melden uns.'}
                {done === 'callback' && 'Ihr Rückrufwunsch wurde übermittelt. Wir rufen Sie zeitnah an.'}
              </p>
            </CardContent></Card>
        )}

        {!loading && appt && !done && (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">
                {DELIVERY_TYPE_LABELS[appt.appointment_type ?? ''] ?? 'Auslieferung'}
                {appt.order_number ? ` · Auftrag ${appt.order_number}` : ''}
              </CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Datum</span><span className="font-medium">{fmtDate(appt.planned_date)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted-foreground">Zeitfenster</span><span className="font-medium">{window}</span></div>
                <Separator />
                <div className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{[appt.delivery_street, `${appt.delivery_zip ?? ''} ${appt.delivery_city ?? ''}`.trim(), appt.delivery_country].filter(Boolean).join(', ')}</span></div>
                {appt.device_name && (
                  <div className="flex gap-2"><Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{appt.device_name}</span></div>
                )}
                {appt.scope_of_delivery && <p className="text-muted-foreground">{appt.scope_of_delivery}</p>}
              </CardContent>
            </Card>

            {appt.already_answered ? (
              <Card><CardContent className="py-6 text-sm text-muted-foreground">
                Zu diesem Termin liegt bereits eine Rückmeldung vor. Bei Änderungen kontaktieren Sie uns bitte direkt.
              </CardContent></Card>
            ) : (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Ihre Rückmeldung</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button variant={mode === 'confirm' ? 'default' : 'outline'} onClick={() => setMode('confirm')}><CalendarCheck className="mr-2 h-4 w-4" />Termin passt</Button>
                    <Button variant={mode === 'alternative' ? 'default' : 'outline'} onClick={() => setMode('alternative')}><CalendarClock className="mr-2 h-4 w-4" />Anderer Termin</Button>
                    <Button variant={mode === 'callback' ? 'default' : 'outline'} onClick={() => setMode('callback')}><PhoneCall className="mr-2 h-4 w-4" />Rückruf</Button>
                    <Button variant={mode === 'reject' ? 'destructive' : 'outline'} onClick={() => setMode('reject')}><CalendarX className="mr-2 h-4 w-4" />Termin absagen</Button>
                  </div>

                  {mode && (
                    <div className="space-y-3 pt-2">
                      {mode === 'alternative' && (
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1"><Label>Wunschdatum</Label><Input type="date" value={altDate} onChange={e => setAltDate(e.target.value)} /></div>
                          <div className="space-y-1"><Label>von</Label><Input type="time" value={altStart} onChange={e => setAltStart(e.target.value)} /></div>
                          <div className="space-y-1"><Label>bis</Label><Input type="time" value={altEnd} onChange={e => setAltEnd(e.target.value)} /></div>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label>Ansprechpartner vor Ort</Label><Input value={contactName} onChange={e => setContactName(e.target.value)} /></div>
                        <div className="space-y-1"><Label>Telefon</Label><Input value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1"><Label>Adresskorrektur (optional)</Label><Input value={correctedAddress} onChange={e => setCorrectedAddress(e.target.value)} placeholder="Nur ausfüllen, wenn die Lieferadresse abweicht" /></div>
                      <div className="space-y-1"><Label>Bemerkung</Label><Textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="z. B. Hinweise zur Anlieferung, Aufzug, Parkmöglichkeit" /></div>
                      <Button className="w-full" disabled={sending} onClick={() => submit(mode)}>
                        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Rückmeldung senden
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">Alix · Auslieferung &amp; Service</p>
      </div>
    </div>
  );
}
