import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { AddToCalendarMenu } from '@/components/esc/AddToCalendarMenu';
import { cancelUrl, rescheduleUrl } from '@/lib/esc/public-url';
import { CalendarCheck, CalendarClock, CalendarX, Download, MapPin, QrCode as QrIcon, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import type { EscAppointment } from '@/lib/esc/types';

export default function ConfirmAppointment() {
  const { token } = useParams();
  const [appointment, setAppointment] = useState<EscAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState<null | 'confirmed' | 'cancelled'>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); setLoadError('Ungültiger Link.'); return; }
    let active = true;
    void supabase.functions.invoke('public-appointment-action', { body: { token, action: 'lookup' } })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data?.appointment) setLoadError(data?.error || 'Dieser Link ist ungültig oder abgelaufen.');
        else setAppointment(data.appointment as EscAppointment);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    QRCode.toDataURL(`${origin}/checkin/${token}`, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [token]);

  if (loading) {
    return <BookingLayout narrow><Card><CardContent className="p-6 text-sm text-muted-foreground">Termin wird geladen…</CardContent></Card></BookingLayout>;
  }

  if (!appointment || loadError) {
    return (
      <BookingLayout narrow>
        <Card>
          <CardHeader><CardTitle>Termin nicht gefunden</CardTitle></CardHeader>
          <CardContent className="text-[13px] text-muted-foreground">
             {loadError || 'Dieser Link ist ungültig oder abgelaufen. Bitte kontaktieren Sie uns.'}
          </CardContent>
        </Card>
      </BookingLayout>
    );
  }

  const isTicket = /^Ticket-Anfrage/i.test(appointment.externalNote || '') || appointment.title?.toLowerCase().includes('ticket');

  const act = async (kind: 'confirmed' | 'cancelled') => {
    const action = kind === 'confirmed' ? 'confirm' : 'cancel';
    const { data, error } = await supabase.functions.invoke('public-appointment-action', { body: { token, action } });
    if (error || data?.error) {
      toast.error(data?.error || 'Rückmeldung konnte nicht gespeichert werden.');
      return;
    }
    setDone(kind);
    toast.success('Danke für Ihre Rückmeldung!');
  };

  if (isTicket) {
    return (
      <BookingLayout narrow>
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-[17px]">Ihre Anfrage ist eingegangen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[13.5px]">
            <div className="rounded-md border p-4 bg-primary/5">
              <div className="text-[14px] font-medium mb-1">Vielen Dank!</div>
              <div className="text-[12.5px] text-muted-foreground">
                Wir haben Ihre Anfrage erhalten und melden uns zeitnah per E-Mail bei Ihnen.
                Ein Termin ist für diese Anfrage nicht erforderlich.
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Row icon={CalendarCheck} label="Anfrage" value={appointment.title || 'Ticket-Anfrage'} />
              <Row icon={CalendarClock} label="Status" value={appointment.status} />
            </div>
            {appointment.externalNote && (
              <div className="rounded-md border p-3 bg-muted/30 text-[12.5px] whitespace-pre-line">
                {appointment.externalNote.replace(/^Ticket-Anfrage\s*\n?/i, '')}
              </div>
            )}
          </CardContent>
        </Card>
      </BookingLayout>
    );
  }

  return (
    <BookingLayout narrow>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-[17px]">{appointment.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13.5px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Row icon={CalendarCheck} label="Datum" value={format(new Date(appointment.startAt), 'EEEE, dd. MMMM yyyy', { locale: de })} />
            <Row icon={Clock} label="Uhrzeit" value={`${format(new Date(appointment.startAt), 'HH:mm')} – ${format(new Date(appointment.endAt), 'HH:mm')}`} />
            <Row icon={MapPin} label="Standort" value={appointment.location || appointment.address || '—'} />
            <Row icon={CalendarClock} label="Status" value={appointment.status} />
          </div>
          {appointment.externalNote && (
            <div className="rounded-md border p-3 bg-muted/30 text-[12.5px] whitespace-pre-line">{appointment.externalNote}</div>
          )}

          {done ? (
            <div className="rounded-md border p-4 text-center bg-primary/5">
              <div className="text-[14px] font-medium mb-1">
                {done === 'confirmed' ? 'Termin bestätigt' : 'Termin abgesagt'}
              </div>
              <div className="text-[12px] text-muted-foreground">Wir haben Ihre Rückmeldung gespeichert.</div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button className="flex-1 min-h-11" onClick={() => act('confirmed')}><CalendarCheck className="w-4 h-4 mr-1" />Termin bestätigen</Button>
              <Button variant="outline" className="flex-1 min-h-11" asChild>
                <a href={rescheduleUrl(token || '')}><CalendarClock className="w-4 h-4 mr-1" />Verschieben</a>
              </Button>
              <Button variant="ghost" className="flex-1 min-h-11 text-destructive" asChild>
                <a href={cancelUrl(token || '')}><CalendarX className="w-4 h-4 mr-1" />Absagen</a>
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t">
            <AddToCalendarMenu appointment={appointment} variant="outline" size="default" />

            {qrDataUrl && (
              <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground">
                <img src={qrDataUrl} alt="QR-Code für Check-in" className="w-20 h-20 rounded border bg-white p-1" />
                <div>
                  <div className="flex items-center gap-1 text-foreground font-medium"><QrIcon className="w-3.5 h-3.5" /> Check-in QR-Code</div>
                  <div>Bringen Sie diesen Code zum Termin mit.</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </BookingLayout>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border p-2 bg-card">
      <Icon className="w-4 h-4 text-primary mt-0.5" />
      <div>
        <div className="text-[10.5px] uppercase text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
