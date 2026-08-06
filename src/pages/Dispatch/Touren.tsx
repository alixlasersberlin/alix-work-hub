import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TOUR_STATUS_LABELS, statusClass } from './constants';

export default function DispatchTouren() {
  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'tours'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tours')
        .select('id, tour_number, tour_date, title, status, planned_distance_km, planned_drive_minutes, planned_start_time, drivers:driver_id(full_name), vehicles:vehicle_id(license_plate)')
        .order('tour_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader title="Touren" subtitle="Tagesplanung, Auslastung und Freigabe der Touren" icon={Truck} />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tour-Nr.</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Fahrer</TableHead>
              <TableHead>Fahrzeug</TableHead>
              <TableHead>km</TableHead>
              <TableHead>Fahrzeit</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Noch keine Touren angelegt.</TableCell></TableRow>
            )}
            {(data ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.tour_number}</TableCell>
                <TableCell>{t.tour_date ? format(new Date(t.tour_date), 'dd.MM.yyyy') : '—'}</TableCell>
                <TableCell>{t.title ?? '—'}</TableCell>
                <TableCell>{t.drivers?.full_name ?? '—'}</TableCell>
                <TableCell>{t.vehicles?.license_plate ?? '—'}</TableCell>
                <TableCell>{t.planned_distance_km ?? '—'}</TableCell>
                <TableCell>{t.planned_drive_minutes ? `${t.planned_drive_minutes} Min.` : '—'}</TableCell>
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
    </div>
  );
}
