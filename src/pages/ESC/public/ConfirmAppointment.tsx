import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { downloadIcs } from '@/lib/esc/ics';
import { logEscAudit } from '@/lib/esc/audit';
import { cancelUrl, rescheduleUrl } from '@/lib/esc/public-url';
import { CalendarCheck, CalendarClock, CalendarX, Download, MapPin, QrCode as QrIcon, Clock } from 'lucide-react';
import QRCode from 'qrcode';

export default function ConfirmAppointment() {
  const { token } = useParams();
  const { appointments, updateAppointment } = useAppointments();
  const { departments } = useDepartments();

  const appointment = useMemo(
    () => appointments.find((a) => a.confirmationToken === token) || appointments[0],
    [appointments, token],
  );

  const [done, setDone] = useState<null | 'confirmed' | 'cancelled'>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    QRCode.toDataURL(`https://alixworks.de/checkin/${token}`, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [token]);

  if (!appointment) {
    return (
      <BookingLayout narrow>
        <Card>
          <CardHeader><CardTitle>Termin nicht gefunden</CardTitle></CardHeader>
          <CardContent className="text-[13px] text-muted-foreground">
            Dieser Link ist ungültig oder abgelaufen. Bitte kontaktieren Sie uns.
          </CardContent>
        </Card>
      </BookingLayout>
    );
  }

  const dept = departments.find((d) => d.id === appointment.departmentId);

  const act = async (kind: 'confirmed' | 'cancelled') => {
    await updateAppointment(appointment.id, { status: kind === 'confirmed' ? 'bestaetigt' : 'storniert' });
    await logEscAudit({ entity: 'appointment', entityId: appointment.id, action: kind === 'confirmed' ? 'confirm' : 'cancel', source: 'confirmation_link' });
    setDone(kind);
    toast.success('Danke für Ihre Rückmeldung!');
  };

  return (
    <BookingLayout narrow>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <DepartmentBadge dept={dept} size="md" />
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
            <Button variant="outline" onClick={() => downloadIcs(appointment)} className="min-h-11">
              <Download className="w-4 h-4 mr-1" /> In Kalender übernehmen
            </Button>
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
