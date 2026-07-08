import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EscStatusBadge } from '@/components/esc/StatusBadge';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { bookingUrl } from '@/lib/esc/public-url';
import { ExternalLink } from 'lucide-react';

export default function EscBookings() {
  const { appointments, updateAppointment } = useAppointments();
  const { departments } = useDepartments();
  const items = appointments.filter((a) => a.status === 'angefragt');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Buchungsanfragen</h1>
        <a href={bookingUrl()} target="_blank" rel="noopener noreferrer" className="text-[12px] text-primary hover:underline flex items-center gap-1">
          Öffentliches Buchungsportal <ExternalLink className="w-3 h-3" />
        </a>
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
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine offenen Anfragen</TableCell></TableRow>}
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-[12px]">{format(new Date(a.startAt), 'dd.MM.yyyy HH:mm', { locale: de })}</TableCell>
                <TableCell className="text-[13px] font-medium">{a.title}</TableCell>
                <TableCell className="text-[12px]">{a.customerName || '—'}<div className="text-muted-foreground text-[11px]">{a.customerEmail}</div></TableCell>
                <TableCell><DepartmentBadge dept={departments.find((d) => d.id === a.departmentId)} /></TableCell>
                <TableCell><EscStatusBadge status={a.status} /></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={async () => { await updateAppointment(a.id, { status: 'bestaetigt' }); toast.success('Anfrage angenommen'); }}>Annehmen</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await updateAppointment(a.id, { status: 'abgelehnt' }); toast.info('Abgelehnt'); }}>Ablehnen</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
