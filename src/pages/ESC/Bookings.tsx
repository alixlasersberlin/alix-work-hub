import { useMemo } from 'react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EscStatusBadge } from '@/components/esc/StatusBadge';
import { DepartmentBadge } from '@/components/esc/DepartmentBadge';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { bookingUrl } from '@/lib/esc/public-url';
import { ExternalLink, Mail, Phone, CalendarCheck, CalendarClock, CalendarX, Inbox } from 'lucide-react';

export default function EscBookings() {
  const { appointments, updateAppointment } = useAppointments();
  const { departments } = useDepartments();

  const today = new Date();
  const publicBookings = appointments.filter((a) => a.confirmationRequired || a.status === 'angefragt' || a.status === 'bestaetigung_offen');

  const stats = useMemo(() => {
    const heute = publicBookings.filter((a) => isSameDay(new Date(a.createdAt || a.startAt), today)).length;
    const offen = publicBookings.filter((a) => a.status === 'bestaetigung_offen' || a.status === 'angefragt').length;
    const bestaetigt = publicBookings.filter((a) => a.status === 'bestaetigt').length;
    const verschoben = publicBookings.filter((a) => a.status === 'verschoben').length;
    const abgesagt = publicBookings.filter((a) => a.status === 'storniert' || a.status === 'abgelehnt').length;
    const wartend = publicBookings.filter((a) => a.status === 'angefragt').length;
    return { heute, offen, bestaetigt, verschoben, abgesagt, wartend };
  }, [publicBookings]);

  const openItems = publicBookings.filter((a) => a.status === 'angefragt' || a.status === 'bestaetigung_offen');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-semibold">Öffentliche Buchungen</h1>
        <a href={bookingUrl()} target="_blank" rel="noopener noreferrer" className="text-[12px] text-primary hover:underline flex items-center gap-1">
          Buchungsportal öffnen <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        <StatCard label="Heute eingegangen" value={stats.heute} icon={Inbox} tone="primary" />
        <StatCard label="Bestätigung offen" value={stats.offen} icon={CalendarClock} tone="warning" />
        <StatCard label="Bestätigt" value={stats.bestaetigt} icon={CalendarCheck} tone="success" />
        <StatCard label="Verschoben" value={stats.verschoben} icon={CalendarClock} />
        <StatCard label="Abgesagt" value={stats.abgesagt} icon={CalendarX} tone="destructive" />
        <StatCard label="Wartend" value={stats.wartend} icon={Inbox} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-[14px]">Offene Anfragen</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Termin</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Abteilung</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openItems.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Keine offenen Anfragen</TableCell></TableRow>}
              {openItems.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-[12px]">{format(new Date(a.startAt), 'dd.MM.yyyy HH:mm', { locale: de })}</TableCell>
                  <TableCell className="text-[13px] font-medium">{a.title}</TableCell>
                  <TableCell className="text-[12px]">
                    <div>{a.customerName || '—'}</div>
                    <div className="text-muted-foreground text-[11px] flex flex-wrap gap-2">
                      {a.customerEmail && <a href={`mailto:${a.customerEmail}`} className="hover:text-primary flex items-center gap-0.5"><Mail className="w-3 h-3" />{a.customerEmail}</a>}
                      {a.customerPhone && <a href={`tel:${a.customerPhone}`} className="hover:text-primary flex items-center gap-0.5"><Phone className="w-3 h-3" />{a.customerPhone}</a>}
                    </div>
                  </TableCell>
                  <TableCell><DepartmentBadge dept={departments.find((d) => d.id === a.departmentId)} /></TableCell>
                  <TableCell><EscStatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={async () => { await updateAppointment(a.id, { status: 'bestaetigt' }); toast.success('Angenommen'); }}>Annehmen</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { await updateAppointment(a.id, { status: 'abgelehnt' }); toast.info('Abgelehnt'); }}>Ablehnen</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone?: 'primary' | 'success' | 'warning' | 'destructive' }) {
  const toneClass =
    tone === 'success' ? 'text-emerald-500' :
    tone === 'warning' ? 'text-amber-500' :
    tone === 'destructive' ? 'text-destructive' :
    'text-primary';
  return (
    <Card>
      <CardHeader className="pb-1 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[11.5px] font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`w-4 h-4 ${toneClass}`} />
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
