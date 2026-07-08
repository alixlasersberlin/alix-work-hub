import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { BookingLayout } from '@/components/esc/public/BookingLayout';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { logEscAudit } from '@/lib/esc/audit';
import { CalendarX, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function CancelAppointment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { appointments, updateAppointment } = useAppointments();
  const appointment = useMemo(
    () => appointments.find((a) => a.confirmationToken === token) || appointments[0],
    [appointments, token],
  );

  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);

  if (!appointment) {
    return (
      <BookingLayout narrow>
        <Card><CardHeader><CardTitle>Termin nicht gefunden</CardTitle></CardHeader></Card>
      </BookingLayout>
    );
  }

  const cancel = async () => {
    await updateAppointment(appointment.id, {
      status: 'storniert',
      externalNote: [appointment.externalNote, reason ? `Absagegrund: ${reason}` : ''].filter(Boolean).join('\n'),
    });
    await logEscAudit({ entity: 'appointment', entityId: appointment.id, action: 'status_change', source: 'confirmation_link' });
    setDone(true);
    toast.success('Termin abgesagt.');
  };

  return (
    <BookingLayout narrow>
      <Card>
        <CardHeader>
          <CardTitle className="text-[16px] flex items-center gap-2"><CalendarX className="w-5 h-5 text-destructive" />Termin absagen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          {done ? (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
              <div className="font-medium">Der Termin wurde abgesagt.</div>
              <p className="text-[12px] text-muted-foreground">Wir informieren unser Team automatisch.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border p-3 bg-muted/30">
                <div className="font-medium">{appointment.title}</div>
                <div className="text-muted-foreground text-[12px]">
                  {format(new Date(appointment.startAt), 'EEEE, dd. MMMM yyyy · HH:mm', { locale: de })}
                </div>
              </div>
              <p>Möchten Sie diesen Termin wirklich absagen?</p>
              <div>
                <label className="text-[12px] text-muted-foreground">Absagegrund (optional)</label>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => navigate(`/appointment/${token}`)}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
                </Button>
                <Button variant="destructive" onClick={cancel}>
                  <CalendarX className="w-4 h-4 mr-1" /> Ja, Termin absagen
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </BookingLayout>
  );
}
