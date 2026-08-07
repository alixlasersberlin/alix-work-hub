import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Trash2, Loader2, Search, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useCanDelete } from '@/hooks/useCanDelete';
import { TOUR_STATUS_LABELS, statusClass } from './constants';
import { downloadToursPdf } from '@/lib/dispatch/tour-pdf';

export default function DispatchTouren() {
  const queryClient = useQueryClient();
  const canDelete = useCanDelete();
  const [target, setTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'tours'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tours')
        .select('id, tour_number, tour_date, title, status, planned_distance_km, planned_drive_minutes, planned_start_time, drivers:driver_id(full_name), vehicles:vehicle_id(license_plate)')
        .order('tour_date', { ascending: false })
        .order('planned_start_time', { ascending: true, nullsFirst: false })
        .order('tour_number', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const tourIds = useMemo(() => (data ?? []).map((t: any) => t.id), [data]);

  const { data: stops } = useQuery({
    queryKey: ['dispatch', 'tour-stops', tourIds.length],
    enabled: tourIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tour_stops')
        .select('id, tour_id, position, planned_arrival, stop_status, distance_from_prev_km, notes, appointment:appointment_id(order_number, customer_name, company_name, device_name, serial_number, contact_name, contact_phone, delivery_street, delivery_zip, delivery_city, planned_date)')
        .in('tour_id', tourIds)
        .order('position');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const stopsByTour = useMemo(() => {
    const map: Record<string, any[]> = {};
    (stops ?? []).forEach((s: any) => { (map[s.tour_id] ||= []).push(s); });
    return map;
  }, [stops]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((t: any) => {
      const own = [t.tour_number, t.title, t.drivers?.full_name, t.vehicles?.license_plate]
        .some(v => String(v ?? '').toLowerCase().includes(s));
      if (own) return true;
      return (stopsByTour[t.id] ?? []).some((st: any) =>
        [st.appointment?.order_number, st.appointment?.company_name, st.appointment?.customer_name, st.appointment?.device_name, st.appointment?.delivery_city]
          .some(v => String(v ?? '').toLowerCase().includes(s)));
    });
  }, [data, search, stopsByTour]);

  const allSelected = filtered.length > 0 && filtered.every((t: any) => selected.includes(t.id));
  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () =>
    setSelected(allSelected ? [] : filtered.map((t: any) => t.id));

  function exportPdf(ids: string[]) {
    const entries = ids
      .map(id => (data ?? []).find((t: any) => t.id === id))
      .filter(Boolean)
      .map((t: any) => ({ tour: t, stops: stopsByTour[t.id] ?? [] }));
    if (!entries.length) { toast.error('Keine Tour ausgewählt'); return; }
    downloadToursPdf(entries);
    toast.success(entries.length === 1 ? 'Tourenplan als PDF erstellt' : `${entries.length} Touren als PDF erstellt`);
  }

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

  const colSpan = canDelete ? 11 : 10;

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Touren"
        subtitle="Tagesplanung, Auslastung und Freigabe der Touren"
        icon={Truck}
        actions={
          <Button
            variant="outline"
            className="gap-2"
            disabled={selected.length === 0}
            onClick={() => exportPdf(selected)}
          >
            <FileDown className="w-4 h-4" /> PDF ({selected.length})
          </Button>
        }
      />

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Suche nach Auftragsnummer, Kunde, Gerät, Tour, Fahrer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Alle Touren markieren" />
              </TableHead>
              <TableHead>Tour-Nr.</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Aufträge</TableHead>
              <TableHead>Fahrer</TableHead>
              <TableHead>Fahrzeug</TableHead>
              <TableHead>km</TableHead>
              <TableHead>Fahrzeit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24 text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && filtered.length === 0 && (
              <TableRow><TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">Keine Touren gefunden.</TableCell></TableRow>
            )}
            {filtered.map((t: any) => {
              const list = stopsByTour[t.id] ?? [];
              const orders = list.map((s: any) => s.appointment?.order_number).filter(Boolean);
              return (
                <TableRow key={t.id} data-state={selected.includes(t.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(t.id)}
                      onCheckedChange={() => toggle(t.id)}
                      aria-label={`Tour ${t.tour_number} markieren`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link to={`/dispatch/touren/${t.id}`} className="text-primary hover:underline">{t.tour_number}</Link>
                  </TableCell>
                  <TableCell>{t.tour_date ? format(new Date(t.tour_date), 'dd.MM.yyyy') : '—'}</TableCell>
                  <TableCell>{t.title ?? '—'}</TableCell>
                  <TableCell className="max-w-[220px]">
                    {orders.length ? (
                      <span className="text-sm">
                        <span className="font-mono">{orders.slice(0, 2).join(', ')}</span>
                        {orders.length > 2 && <span className="text-muted-foreground"> +{orders.length - 2}</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">{list.length ? `${list.length} Stopps` : '—'}</span>
                    )}
                  </TableCell>
                  <TableCell>{t.drivers?.full_name ?? '—'}</TableCell>
                  <TableCell>{t.vehicles?.license_plate ?? '—'}</TableCell>
                  <TableCell>{t.planned_distance_km ?? '—'}</TableCell>
                  <TableCell>{t.planned_drive_minutes ? `${t.planned_drive_minutes} Min.` : '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(t.status)}`}>
                      {TOUR_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Tour ${t.tour_number} als PDF`}
                      title="Tourenplan als PDF"
                      onClick={() => exportPdf([t.id])}
                    >
                      <FileDown className="w-4 h-4" />
                    </Button>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Tour ${t.tour_number} löschen`}
                        onClick={() => setTarget(t)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
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
