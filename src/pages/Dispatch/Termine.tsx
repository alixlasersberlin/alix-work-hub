import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarClock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DELIVERY_STATUS_LABELS, DELIVERY_TYPE_LABELS, READINESS_LABELS, readinessClass, statusClass } from './constants';

export default function DispatchTermine() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('alle');
  const [readiness, setReadiness] = useState('alle');

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'appointments', status, readiness],
    queryFn: async () => {
      let q = supabase
        .from('delivery_appointments')
        .select('id, order_number, customer_name, company_name, delivery_zip, delivery_city, appointment_type, status, readiness, planned_date, time_window_start, time_window_end, device_name, is_vip')
        .order('planned_date', { ascending: true, nullsFirst: false })
        .limit(300);
      if (status !== 'alle') q = q.eq('status', status as never);
      if (readiness !== 'alle') q = q.eq('readiness', readiness as never);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter(r =>
    !term ||
    [r.order_number, r.customer_name, r.company_name, r.delivery_city, r.delivery_zip, r.device_name]
      .some(v => (v ?? '').toString().toLowerCase().includes(term))
  );

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader title="Liefertermine" subtitle="Alle geplanten und offenen Liefer- und Servicetermine" icon={CalendarClock} />

      <Card className="p-4 mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Auftrag, Kunde, Ort, Gerät…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-64"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Status</SelectItem>
            {Object.entries(DELIVERY_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={readiness} onValueChange={setReadiness}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Ampel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Ampeln</SelectItem>
            {Object.entries(READINESS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termin</TableHead>
              <TableHead>Auftrag</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Ort</TableHead>
              <TableHead>Art</TableHead>
              <TableHead>Ampel</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Lädt…</TableCell></TableRow>
            )}
            {!isPending && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Liefertermine gefunden.</TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  {r.planned_date ? format(new Date(r.planned_date), 'dd.MM.yyyy') : <span className="text-muted-foreground">offen</span>}
                  {r.time_window_start && <span className="text-muted-foreground ml-2 text-xs">{r.time_window_start.slice(0, 5)}–{(r.time_window_end ?? '').slice(0, 5)}</span>}
                </TableCell>
                <TableCell className="font-medium">{r.order_number ?? '—'}</TableCell>
                <TableCell>
                  {r.is_vip && <span className="mr-1">👑</span>}
                  {r.company_name || r.customer_name || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{[r.delivery_zip, r.delivery_city].filter(Boolean).join(' ') || '—'}</TableCell>
                <TableCell>{DELIVERY_TYPE_LABELS[r.appointment_type] ?? r.appointment_type}</TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${readinessClass(r.readiness)}`}>
                    {READINESS_LABELS[r.readiness] ?? r.readiness}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(r.status)}`}>
                    {DELIVERY_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
