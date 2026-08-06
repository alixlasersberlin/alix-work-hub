import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Archive, FileDown, History, Search } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TOUR_STATUS_LABELS, DELIVERY_STATUS_LABELS, statusClass } from './constants';
import { exportCsv, exportXlsx, planPdf } from '@/lib/dispatch/exports';

export default function DispatchArchiv() {
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: tours, isPending } = useQuery({
    queryKey: ['dispatch', 'archive-tours', from, to, q],
    queryFn: async () => {
      let query = supabase.from('delivery_tours')
        .select('id, tour_number, title, tour_date, status, planned_distance_km, actual_distance_km, planned_drive_minutes, utilization_pct, released_at, archived_at, drivers:driver_id(full_name), vehicles:vehicle_id(license_plate)')
        .in('status', ['abgeschlossen', 'archiviert', 'storniert'])
        .gte('tour_date', from).lte('tour_date', to)
        .order('tour_date', { ascending: false }).limit(500);
      if (q.trim()) query = query.ilike('tour_number', `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: history } = useQuery({
    queryKey: ['dispatch', 'archive-history', from, to],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_status_history')
        .select('id, from_status, to_status, changed_by_name, source, note, created_at, appointment_id, tour_id')
        .gte('created_at', `${from}T00:00:00Z`).lte('created_at', `${to}T23:59:59Z`)
        .order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const rows = () => (tours ?? []).map((t: any) => ({
    Tour: t.tour_number, Datum: t.tour_date, Bezeichnung: t.title ?? '',
    Fahrer: t.drivers?.full_name ?? '', Fahrzeug: t.vehicles?.license_plate ?? '',
    Plan_km: t.planned_distance_km ?? '', Ist_km: t.actual_distance_km ?? '',
    Auslastung: t.utilization_pct ?? '', Status: t.status,
    Freigegeben_am: t.released_at ?? '', Archiviert_am: t.archived_at ?? '',
  }));

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Tourenarchiv"
        subtitle="Revisionssichere Historie abgeschlossener Touren inklusive Statusprotokoll"
        icon={Archive}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-[150px]" />
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-[150px]" />
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Tour-Nr." className="pl-8 w-[160px]" />
            </div>
            <Button variant="outline" size="sm" onClick={() => planPdf('Tourenarchiv', `${from} – ${to}`, (tours ?? []) as any[])}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => exportXlsx(rows(), `Tourenarchiv_${from}_${to}`, 'Archiv')}><FileDown className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(rows(), `Tourenarchiv_${from}_${to}`)}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
          </div>
        }
      />

      <Tabs defaultValue="touren">
        <TabsList className="mb-3">
          <TabsTrigger value="touren">Touren ({(tours ?? []).length})</TabsTrigger>
          <TabsTrigger value="protokoll"><History className="h-3.5 w-3.5 mr-1" />Statusprotokoll</TabsTrigger>
        </TabsList>

        <TabsContent value="touren">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tour-Nr.</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Fahrer</TableHead>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Plan / Ist km</TableHead>
                  <TableHead>Auslastung</TableHead>
                  <TableHead>Freigegeben</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
                {!isPending && (tours ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Keine archivierten Touren im Zeitraum.</TableCell></TableRow>
                )}
                {(tours ?? []).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link to={`/dispatch/touren/${t.id}`} className="text-primary hover:underline">{t.tour_number}</Link>
                    </TableCell>
                    <TableCell>{t.tour_date ? format(new Date(t.tour_date), 'dd.MM.yyyy') : '—'}</TableCell>
                    <TableCell>{t.drivers?.full_name ?? '—'}</TableCell>
                    <TableCell>{t.vehicles?.license_plate ?? '—'}</TableCell>
                    <TableCell>{t.planned_distance_km ?? 0} / {t.actual_distance_km ?? 0}</TableCell>
                    <TableCell>{t.utilization_pct != null ? `${t.utilization_pct} %` : '—'}</TableCell>
                    <TableCell>{t.released_at ? format(new Date(t.released_at), 'dd.MM.yyyy HH:mm') : '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(t.status)}`}>
                        {TOUR_STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="protokoll">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Von</TableHead>
                  <TableHead>Nach</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Notiz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(history ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Einträge im Zeitraum.</TableCell></TableRow>
                )}
                {(history ?? []).map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell>{format(new Date(h.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                    <TableCell className="text-muted-foreground">{DELIVERY_STATUS_LABELS[h.from_status] ?? h.from_status ?? '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(h.to_status)}`}>
                        {DELIVERY_STATUS_LABELS[h.to_status] ?? h.to_status ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>{h.changed_by_name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{h.source ?? '—'}</TableCell>
                    <TableCell className="max-w-[320px] truncate">{h.note ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
