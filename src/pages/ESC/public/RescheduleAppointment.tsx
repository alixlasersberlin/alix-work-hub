import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { generateSlots, nextAvailableDays, DEFAULT_BOOKING_SETTINGS } from '@/lib/esc/booking-settings';
import { format, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { logEscAudit } from '@/lib/esc/audit';
import { ArrowLeft, CalendarClock } from 'lucide-react';

export default function RescheduleAppointment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { appointments, updateAppointment } = useAppointments();

  const appointment = useMemo(
    () => appointments.find((a) => a.confirmationToken === token) || appointments[0],
    [appointments, token],
  );

  const duration = appointment ? differenceInMinutes(new Date(appointment.endAt), new Date(appointment.startAt)) : 60;
  const [dayIso, setDayIso] = useState('');
  const days = useMemo(() => nextAvailableDays(new Date(), 14), []);
  const slots = useMemo(() => (dayIso ? generateSlots(new Date(dayIso), duration, appointments) : []), [dayIso, duration, appointments]);

  if (!appointment) {
    return (
      <BookingLayout narrow>
        <Card><CardHeader><CardTitle>Termin nicht gefunden</CardTitle></CardHeader></Card>
      </BookingLayout>
    );
  }

  const pick = async (slot: Date) => {
    const newEnd = new Date(slot.getTime() + duration * 60_000);
    await updateAppointment(appointment.id, { startAt: slot.toISOString(), endAt: newEnd.toISOString(), status: 'verschoben' });
    await logEscAudit({ entity: 'appointment', entityId: appointment.id, action: 'status_change', after: { startAt: slot.toISOString() }, source: 'confirmation_link' });
    toast.success('Termin verschoben. Sie erhalten eine neue Bestätigung.');
    navigate(`/appointment/${token}`);
  };

  return (
    <BookingLayout narrow>
      <Card>
        <CardHeader>
          <CardTitle className="text-[16px] flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" />Termin verschieben</CardTitle>
          <p className="text-[12.5px] text-muted-foreground">Aktueller Termin: {format(new Date(appointment.startAt), 'EEEE, dd. MMMM yyyy · HH:mm', { locale: de })}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const active = dayIso === d.toISOString();
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setDayIso(d.toISOString())}
                  className={`min-w-[76px] rounded-lg border p-2 text-center transition ${active ? 'border-primary bg-primary/10' : 'hover:border-primary'}`}
                >
                  <div className="text-[10.5px] uppercase text-muted-foreground">{format(d, 'EE', { locale: de })}</div>
                  <div className="text-[16px] font-semibold">{format(d, 'dd')}</div>
                  <div className="text-[10.5px] text-muted-foreground">{format(d, 'MMM', { locale: de })}</div>
                </button>
              );
            })}
          </div>
          {dayIso && (
            slots.length === 0 ? (
              <div className="rounded-md border p-4 text-center bg-muted/30 text-[13px]">Für diesen Tag sind keine Zeiten verfügbar.</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {slots.map((s) => (
                  <button key={s.toISOString()} onClick={() => pick(s)} className="rounded-md border py-2 min-h-11 text-[13px] font-medium hover:border-primary transition">
                    {format(s, 'HH:mm')}
                  </button>
                ))}
              </div>
            )
          )}
          <div className="pt-2">
            <Button variant="ghost" onClick={() => navigate(`/appointment/${token}`)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Zurück zur Übersicht
            </Button>
          </div>
        </CardContent>
      </Card>
    </BookingLayout>
  );
}
