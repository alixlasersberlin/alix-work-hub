import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EscStatusBadge } from '@/components/esc/StatusBadge';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { confirmUrl } from '@/lib/esc/public-url';
import { Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { sendAppointmentConfirmationMail, ESC_CONFIRMATION_COPY } from '@/lib/esc/confirmation-mail';

export default function EscConfirmations() {
  const { appointments } = useAppointments();
  const { departments } = useDepartments();
  const [sending, setSending] = useState<string | null>(null);
  const items = appointments.filter((a) => a.confirmationRequired && a.status !== 'bestaetigt' && a.status !== 'abgelehnt' && a.status !== 'storniert');

  const copyLink = (token?: string) => {
    if (!token) { toast.error('Kein Token vorhanden'); return; }
    navigator.clipboard.writeText(confirmUrl(token));
    toast.success('Bestätigungslink kopiert');
  };

  const sendMail = async (a: (typeof items)[number]) => {
    setSending(a.id);
    const res = await sendAppointmentConfirmationMail(a);
    setSending(null);
    if (res.ok) toast.success(`E-Mail versendet · Kopie an ${ESC_CONFIRMATION_COPY}`);
    else toast.error(res.error || 'Versand fehlgeschlagen');
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Offene Bestätigungen</h1>
      <div className="text-[12px] text-muted-foreground">
        Terminbestätigungen gehen an die hinterlegte Kunden-E-Mail, Kopie immer an <span className="text-foreground font-medium">{ESC_CONFIRMATION_COPY}</span>.
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Abteilung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine offenen Bestätigungen</TableCell></TableRow>}
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-[12px]">{format(new Date(a.startAt), 'dd.MM.yyyy HH:mm', { locale: de })}</TableCell>
                <TableCell className="text-[13px] font-medium">{a.title}</TableCell>
                <TableCell className="text-[12px]">{a.customerName || '—'}<div className="text-muted-foreground text-[11px]">{a.customerEmail}</div></TableCell>
                <TableCell><DepartmentBadge dept={departments.find((d) => d.id === a.departmentId)} /></TableCell>
                <TableCell><EscStatusBadge status={a.status} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => copyLink(a.confirmationToken)}><Copy className="w-3.5 h-3.5 mr-1" />Link</Button>
                  <Button size="sm" variant="ghost" disabled={sending === a.id} onClick={() => sendMail(a)}><Mail className="w-3.5 h-3.5 mr-1" />{sending === a.id ? 'Sende…' : 'Senden'}</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
