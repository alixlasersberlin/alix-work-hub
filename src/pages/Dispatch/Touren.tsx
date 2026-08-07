import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useCanDelete } from '@/hooks/useCanDelete';
import { TOUR_STATUS_LABELS, statusClass } from './constants';

export default function DispatchTouren() {
  const queryClient = useQueryClient();
  const canDelete = useCanDelete();
  const [target, setTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!target) return;
    setDeleting(true);
    await supabase.from('delivery_tour_stops').delete().eq('tour_id', target.id);
    const { error } = await supabase.from('delivery_tours').delete().eq('id', target.id);
    setDeleting(false);
    if (error) {
      toast.error('Fehler beim Löschen: ' + error.message);
      return;
    }
    toast.success(`Tour ${target.tour_number} gelöscht`);
    setTarget(null);
    queryClient.invalidateQueries({ queryKey: ['dispatch'] });
  }

  const colSpan = canDelete ? 9 : 8;

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
              {canDelete && <TableHead className="w-16 text-right">Aktion</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">Noch keine Touren angelegt.</TableCell></TableRow>
            )}
            {(data ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <Link to={`/dispatch/touren/${t.id}`} className="text-primary hover:underline">{t.tour_number}</Link>
                </TableCell>
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
                {canDelete && (
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Tour ${t.tour_number} löschen`}
                      onClick={() => setTarget(t)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!target} onOpenChange={v => !v && !deleting && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Tour löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Tour <strong>{target?.tour_number}</strong> und alle zugehörigen Stopps werden
              unwiderruflich gelöscht. Die Aufträge und Termine selbst bleiben bestehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
