import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck, ArrowLeft, PackageCheck, ClipboardCheck, ShieldCheck, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { TOUR_STATUS_LABELS, DELIVERY_STATUS_LABELS, statusClass } from './constants';

const LOADING_STATUS_LABELS: Record<string, string> = {
  nicht_vorbereitet: 'Nicht vorbereitet',
  vorbereitet: 'Vorbereitet',
  kontrolliert: 'Kontrolliert',
  geladen: 'Geladen',
  fehlt: 'Fehlt',
  beschaedigt: 'Beschädigt',
};

export default function DispatchTourDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['dispatch', 'tour', id] });

  const { data: tour } = useQuery({
    queryKey: ['dispatch', 'tour', id, 'head'],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tours')
        .select('*, drivers:driver_id(id, full_name, license_valid_until, mobile), vehicles:vehicle_id(id, license_plate, name, max_payload_kg, hu_due_date, next_service_date, status)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: stops } = useQuery({
    queryKey: ['dispatch', 'tour', id, 'stops'],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_tour_stops')
        .select('*, delivery_appointments:appointment_id(id, customer_name, company_name, order_number, device_name, serial_number, delivery_street, delivery_zip, delivery_city, status, contact_phone)')
        .eq('tour_id', id!)
        .order('position');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: loading } = useQuery({
    queryKey: ['dispatch', 'tour', id, 'loading'],
    enabled: !!id,
    queryFn: async () => {
      const { data: list } = await supabase.from('delivery_loading_lists').select('*').eq('tour_id', id!).maybeSingle();
      if (!list) return { list: null, items: [] as any[] };
      const { data: items } = await supabase
        .from('delivery_loading_items')
        .select('*')
        .eq('loading_list_id', (list as any).id)
        .order('position');
      return { list, items: items ?? [] };
    },
  });

  const { data: checklist } = useQuery({
    queryKey: ['dispatch', 'tour', id, 'checklist'],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_checklists').select('*').eq('tour_id', id!).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: incidents } = useQuery({
    queryKey: ['dispatch', 'tour', id, 'incidents'],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_incidents').select('*').eq('tour_id', id!).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const genLoading = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delivery_generate_loading_list' as any, { p_tour_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Beladungsliste erzeugt'); invalidate(); qc.invalidateQueries({ queryKey: ['dispatch', 'tour', id, 'loading'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const seedChecklist = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delivery_seed_release_checklist' as any, { p_tour_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Checkliste angelegt'); qc.invalidateQueries({ queryKey: ['dispatch', 'tour', id, 'checklist'] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('delivery_release_tour' as any, { p_tour_id: id });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (res) => {
      if (res?.ok) { toast.success('Tour freigegeben'); }
      else toast.error(`Freigabe nicht möglich – ${res?.open_items} blockierende Punkte offen`);
      qc.invalidateQueries({ queryKey: ['dispatch', 'tour', id, 'head'] });
      qc.invalidateQueries({ queryKey: ['dispatch', 'tours'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleCheck = useMutation({
    mutationFn: async (row: any) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('delivery_checklists')
        .update({ is_done: !row.is_done, checked_by: u.user?.id ?? null, checked_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch', 'tour', id, 'checklist'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const setItemStatus = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('delivery_loading_items')
        .update({ status: status as any, checked_by: u.user?.id ?? null, checked_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch', 'tour', id, 'loading'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const warnings = useMemo(() => {
    const w: string[] = [];
    const v = tour?.vehicles;
    const d = tour?.drivers;
    const today = new Date();
    if (!d) w.push('Kein Fahrer zugewiesen');
    if (!v) w.push('Kein Fahrzeug zugewiesen');
    if (v?.hu_due_date && new Date(v.hu_due_date) < today) w.push(`HU des Fahrzeugs ${v.license_plate} ist abgelaufen`);
    if (v?.next_service_date && new Date(v.next_service_date) < today) w.push(`Wartung für ${v.license_plate} fällig`);
    if (v?.status && !['verfuegbar', 'reserviert'].includes(v.status)) w.push(`Fahrzeugstatus: ${v.status}`);
    if (d?.license_valid_until && new Date(d.license_valid_until) < today) w.push(`Führerschein von ${d.full_name} abgelaufen`);
    const weight = (loading?.items ?? []).reduce((s: number, i: any) => s + Number(i.weight_kg || 0), 0);
    if (v?.max_payload_kg && weight > Number(v.max_payload_kg)) w.push(`Zuladung überschritten (${weight} kg / ${v.max_payload_kg} kg)`);
    return w;
  }, [tour, loading]);

  const openBlocking = (checklist ?? []).filter((c: any) => c.is_blocking && !c.is_done).length;
  const loadingDone = (loading?.items ?? []).filter((i: any) => ['geladen', 'kontrolliert'].includes(i.status)).length;

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <Link to="/dispatch/touren" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="w-4 h-4" /> zurück zu den Touren
      </Link>
      <PageHeader
        title={tour?.tour_number ?? 'Tour'}
        subtitle={`${tour?.tour_date ? format(new Date(tour.tour_date), 'dd.MM.yyyy') : ''} · ${tour?.drivers?.full_name ?? 'kein Fahrer'} · ${tour?.vehicles?.license_plate ?? 'kein Fahrzeug'}`}
        icon={Truck}
        actions={
          <Button
            onClick={() => release.mutate()}
            disabled={release.isPending || openBlocking > 0 || tour?.status === 'freigegeben'}
          >
            {release.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            {tour?.status === 'freigegeben' ? 'Freigegeben' : 'Tour freigeben'}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(tour?.status)}`}>
          {TOUR_STATUS_LABELS[tour?.status] ?? tour?.status ?? '—'}
        </span>
        <Badge variant="outline">{(stops ?? []).length} Stopps</Badge>
        <Badge variant="outline">{tour?.planned_distance_km ?? 0} km</Badge>
        <Badge variant="outline">{tour?.planned_drive_minutes ?? 0} Min. Fahrzeit</Badge>
        <Badge variant="outline">Beladung {loadingDone}/{(loading?.items ?? []).length}</Badge>
        <Badge variant="outline">Checkliste offen: {openBlocking}</Badge>
      </div>

      {warnings.length > 0 && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-400 font-medium mb-1">
            <AlertTriangle className="h-4 w-4" /> Warnungen
          </div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {warnings.map(w => <li key={w}>{w}</li>)}
          </ul>
        </Card>
      )}

      <Tabs defaultValue="stopps">
        <TabsList className="mb-3">
          <TabsTrigger value="stopps">Stopps</TabsTrigger>
          <TabsTrigger value="beladung"><PackageCheck className="h-3.5 w-3.5 mr-1" />Beladung</TabsTrigger>
          <TabsTrigger value="freigabe"><ClipboardCheck className="h-3.5 w-3.5 mr-1" />Freigabe</TabsTrigger>
          <TabsTrigger value="vorfaelle">Vorfälle ({(incidents ?? []).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="stopps">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead>Gerät</TableHead>
                  <TableHead>Ankunft</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stops ?? []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.position}</TableCell>
                    <TableCell>
                      <div className="font-medium">{s.delivery_appointments?.customer_name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{s.delivery_appointments?.order_number ?? ''}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {[s.delivery_appointments?.delivery_street, `${s.delivery_appointments?.delivery_zip ?? ''} ${s.delivery_appointments?.delivery_city ?? ''}`]
                        .filter(Boolean).join(', ')}
                    </TableCell>
                    <TableCell className="text-sm">{s.delivery_appointments?.device_name ?? '—'}</TableCell>
                    <TableCell className="text-sm">{s.planned_arrival ? format(new Date(s.planned_arrival), 'HH:mm') : '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(s.delivery_appointments?.status)}`}>
                        {DELIVERY_STATUS_LABELS[s.delivery_appointments?.status] ?? s.delivery_appointments?.status ?? '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {(stops ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Stopps geplant.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="beladung">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                Beladung in umgekehrter Auslieferreihenfolge – der erste Stopp wird zuletzt geladen.
              </div>
              <Button variant="outline" size="sm" onClick={() => genLoading.mutate()} disabled={genLoading.isPending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${genLoading.isPending ? 'animate-spin' : ''}`} />
                Beladungsliste erzeugen
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Seriennr.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(loading?.items ?? []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.position}</TableCell>
                    <TableCell className="text-sm">{i.description}</TableCell>
                    <TableCell className="text-sm font-mono">{i.serial_number ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline">{LOADING_STATUS_LABELS[i.status] ?? i.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setItemStatus.mutate({ itemId: i.id, status: 'geladen' })}>Geladen</Button>
                        <Button size="sm" variant="outline" onClick={() => setItemStatus.mutate({ itemId: i.id, status: 'fehlt' })}>Fehlt</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(loading?.items ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Noch keine Beladungsliste erzeugt.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="freigabe">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">15-Punkte-Checkliste – blockierende Punkte müssen erledigt sein.</div>
              <Button variant="outline" size="sm" onClick={() => seedChecklist.mutate()} disabled={seedChecklist.isPending}>
                Checkliste anlegen
              </Button>
            </div>
            <div className="divide-y divide-border">
              {(checklist ?? []).map((c: any) => (
                <label key={c.id} className="flex items-center gap-3 py-2 cursor-pointer">
                  <Checkbox checked={c.is_done} onCheckedChange={() => toggleCheck.mutate(c)} />
                  <span className={c.is_done ? 'line-through text-muted-foreground' : ''}>{c.label}</span>
                  {c.is_blocking && <Badge variant="outline" className="ml-auto text-xs">Pflicht</Badge>}
                </label>
              ))}
              {(checklist ?? []).length === 0 && (
                <div className="py-8 text-center text-muted-foreground text-sm">Noch keine Checkliste angelegt.</div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="vorfaelle">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead>Grund</TableHead>
                  <TableHead>Beschreibung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(incidents ?? []).map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">{format(new Date(i.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                    <TableCell className="text-sm">{i.incident_type}</TableCell>
                    <TableCell className="text-sm">{i.reason_code ?? '—'}</TableCell>
                    <TableCell className="text-sm">{i.description ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {(incidents ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Keine Vorfälle erfasst.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
