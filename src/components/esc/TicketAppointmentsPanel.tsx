import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { CalendarClock, ExternalLink, RefreshCw } from 'lucide-react';

type TicketEvent = {
  id: string;
  ticket_id: string | null;
  title: string;
  start_at: string;
  end_at: string | null;
  event_kind: string | null;
  appointment_status: string | null;
  confirmation_status: string | null;
  customer_name: string | null;
  customer_email: string | null;
  tickets?: { ticket_number: string | null; status: string | null; priority: string | null } | null;
};

const KIND_LABEL: Record<string, string> = {
  kundentermin: 'Kundentermin',
  beratung: 'Beratung',
  rueckruf: 'Rückruf',
  wiedervorlage: 'Wiedervorlage',
  frist: 'Frist',
  eskalation: 'Eskalation',
};

const STATUS_TONE: Record<string, string> = {
  bestaetigung_ausstehend: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  bestaetigt: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  abgelehnt: 'bg-destructive/10 text-destructive border-destructive/20',
  bestaetigung_abgelaufen: 'bg-destructive/10 text-destructive border-destructive/20',
  geplant: 'bg-primary/10 text-primary border-primary/20',
};

export function TicketAppointmentsPanel() {
  const [rows, setRows] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('esc_events')
      .select('id, ticket_id, title, start_at, end_at, event_kind, appointment_status, confirmation_status, customer_name, customer_email, tickets:ticket_id(ticket_number, status, priority)')
      .eq('source', 'ticket')
      .gte('start_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order('start_at', { ascending: true })
      .limit(100);
    if (!error && data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[14px] flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          Ticket-Termine
          <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termin</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Keine Ticket-Termine</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-[12px] whitespace-nowrap">
                  {format(new Date(r.start_at), 'dd.MM. HH:mm', { locale: de })}
                </TableCell>
                <TableCell className="text-[12px] font-mono">{r.tickets?.ticket_number ?? '—'}</TableCell>
                <TableCell className="text-[13px]">{r.title}</TableCell>
                <TableCell className="text-[12px]">{r.customer_name ?? '—'}</TableCell>
                <TableCell className="text-[12px]">{KIND_LABEL[r.event_kind ?? ''] ?? r.event_kind ?? '—'}</TableCell>
                <TableCell>
                  <span className={`text-[11px] px-2 py-0.5 rounded-md border ${STATUS_TONE[r.appointment_status ?? ''] ?? 'bg-muted text-muted-foreground'}`}>
                    {r.appointment_status ?? '—'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {r.ticket_id && (
                    <Button asChild size="sm" variant="ghost">
                      <Link to={`/tickets/${r.ticket_id}`}>Öffnen <ExternalLink className="w-3 h-3 ml-1" /></Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
