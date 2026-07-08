import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { downloadIcs } from '@/lib/esc/ics';
import { logEscAudit } from '@/lib/esc/audit';
import alixLogo from '@/assets/alix-logo-gold.png';

export default function ConfirmAppointment() {
  const { token } = useParams();
  const { appointments, updateAppointment } = useAppointments();
  const { departments } = useDepartments();

  // In Prompt 2 this resolution moves server-side (signed token → row lookup).
  const appointment = useMemo(
    () => appointments.find((a) => a.confirmationToken === token) || appointments[0],
    [appointments, token],
  );

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestDate, setSuggestDate] = useState('');
  const [done, setDone] = useState<null | 'confirmed' | 'rejected' | 'suggested'>(null);

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Termin nicht gefunden</CardTitle></CardHeader>
          <CardContent className="text-[13px] text-muted-foreground">
            Dieser Link ist ungültig oder abgelaufen. Bitte kontaktieren Sie uns.
          </CardContent>
        </Card>
      </div>
    );
  }

  const dept = departments.find((d) => d.id === appointment.departmentId);

  const act = async (kind: 'confirmed' | 'rejected' | 'suggested', suggested?: string) => {
    if (kind === 'confirmed') await updateAppointment(appointment.id, { status: 'bestaetigt' });
    else if (kind === 'rejected') await updateAppointment(appointment.id, { status: 'abgelehnt' });
    else await updateAppointment(appointment.id, { status: 'verschoben', externalNote: `Kunde schlägt vor: ${suggested}` });
    await logEscAudit({ entity: 'appointment', entityId: appointment.id, action: kind === 'confirmed' ? 'confirm' : kind === 'rejected' ? 'reject' : 'status_change', source: 'confirmation_link' });
    setDone(kind);
    toast.success('Vielen Dank für Ihre Rückmeldung!');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <img src={alixLogo} alt="AlixWorks" className="h-8" />
          <div>
            <div className="text-[14px] font-semibold">AlixWorks · Terminbestätigung</div>
            <div className="text-[11px] text-muted-foreground">alixworks.de</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DepartmentBadge dept={dept} size="md" />
              <CardTitle className="text-[16px]">{appointment.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><div className="text-muted-foreground text-[11px]">Datum & Uhrzeit</div><div>{format(new Date(appointment.startAt), 'EEEE, dd. MMMM yyyy · HH:mm', { locale: de })}–{format(new Date(appointment.endAt), 'HH:mm', { locale: de })}</div></div>
              <div><div className="text-muted-foreground text-[11px]">Ort</div><div>{appointment.location || appointment.address || '—'}</div></div>
              <div><div className="text-muted-foreground text-[11px]">Kunde</div><div>{appointment.customerName || '—'}</div></div>
              <div><div className="text-muted-foreground text-[11px]">Ansprechpartner</div><div>{appointment.customerContact || '—'}</div></div>
            </div>
            {appointment.externalNote && <div className="border-t pt-3 text-muted-foreground">{appointment.externalNote}</div>}

            {done ? (
              <div className="border-t pt-3 space-y-2">
                <div className="font-medium text-primary">
                  {done === 'confirmed' && 'Termin bestätigt. Vielen Dank!'}
                  {done === 'rejected' && 'Termin abgelehnt. Wir werden uns bei Ihnen melden.'}
                  {done === 'suggested' && 'Alternativvorschlag übermittelt. Wir melden uns kurzfristig zurück.'}
                </div>
                <Button variant="outline" onClick={() => downloadIcs(appointment)}>In Kalender übernehmen (.ics)</Button>
              </div>
            ) : (
              <div className="border-t pt-3 flex flex-wrap gap-2">
                <Button onClick={() => act('confirmed')}>Termin bestätigen</Button>
                <Button variant="outline" onClick={() => setSuggestOpen((v) => !v)}>Alternativtermin vorschlagen</Button>
                <Button variant="ghost" className="text-destructive" onClick={() => act('rejected')}>Termin ablehnen</Button>
                <Button variant="outline" onClick={() => downloadIcs(appointment)}>In Kalender übernehmen (.ics)</Button>
              </div>
            )}

            {suggestOpen && !done && (
              <div className="border-t pt-3 flex flex-wrap items-end gap-2">
                <div><Label>Wunschtermin</Label><Input type="datetime-local" value={suggestDate} onChange={(e) => setSuggestDate(e.target.value)} /></div>
                <Button onClick={() => act('suggested', suggestDate || 'nach Absprache')} disabled={!suggestDate}>Absenden</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t mt-8 py-4 text-center text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} AlixWorks · alixworks.de
      </footer>
    </div>
  );
}
