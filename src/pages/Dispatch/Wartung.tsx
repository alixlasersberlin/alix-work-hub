import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wrench, Plus, AlertTriangle, Mail } from 'lucide-react';
import { differenceInDays, addMonths, format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (d?: string | null) => (d ? format(parseISO(d), 'dd.MM.yyyy') : '—');

export default function DispatchWartung() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    vehicle_id: '', maintenance_type: 'Inspektion', due_date: '', performed_at: '',
    odometer_km: '', cost: '', workshop: '', notes: '',
  });

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'wartung'],
    queryFn: async () => {
      const [v, m] = await Promise.all([
        supabase.from('vehicles').select('*').order('license_plate'),
        supabase.from('vehicle_maintenance').select('*').order('due_date', { ascending: true }).limit(500),
      ]);
      if (v.error) throw v.error;
      return { vehicles: v.data ?? [], entries: m.data ?? [] };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.vehicles.map((v: any) => {
      const nextKm = v.service_interval_km && v.last_service_km != null
        ? Number(v.last_service_km) + Number(v.service_interval_km) : null;
      const nextDate = v.service_interval_months && v.last_service_date
        ? addMonths(parseISO(v.last_service_date), Number(v.service_interval_months)) : null;
      const kmLeft = nextKm != null && v.odometer_km != null ? nextKm - Number(v.odometer_km) : null;
      const daysLeft = nextDate ? differenceInDays(nextDate, new Date()) : null;
      const hu = v.hu_due_date ? differenceInDays(parseISO(v.hu_due_date), new Date()) : null;
      const critical = (kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft <= 0) || (hu != null && hu <= 0);
      const warn = !critical && ((kmLeft != null && kmLeft <= 1500) || (daysLeft != null && daysLeft <= 30) || (hu != null && hu <= 30));
      return { v, nextKm, nextDate, kmLeft, daysLeft, hu, critical, warn };
    }).sort((a, b) => Number(b.critical) - Number(a.critical) || Number(b.warn) - Number(a.warn));
  }, [data]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vehicle_maintenance').insert({
        vehicle_id: form.vehicle_id,
        maintenance_type: form.maintenance_type,
        due_date: form.due_date || null,
        performed_at: form.performed_at || null,
        odometer_km: form.odometer_km ? Number(form.odometer_km) : null,
        cost: form.cost ? Number(form.cost) : null,
        workshop: form.workshop.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
      if (form.performed_at) {
        await supabase.from('vehicles').update({
          last_service_date: form.performed_at,
          last_service_km: form.odometer_km ? Number(form.odometer_km) : null,
        }).eq('id', form.vehicle_id);
      }
    },
    onSuccess: () => {
      toast.success('Wartung erfasst');
      setOpen(false);
      setForm({ vehicle_id: '', maintenance_type: 'Inspektion', due_date: '', performed_at: '', odometer_km: '', cost: '', workshop: '', notes: '' });
      qc.invalidateQueries({ queryKey: ['dispatch', 'wartung'] });
      qc.invalidateQueries({ queryKey: ['dispatch', 'vehicles'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Fehler beim Speichern'),
  });

  const vehicleLabel = (id: string) => {
    const v = data?.vehicles.find((x: any) => x.id === id);
    return v ? `${v.license_plate}${v.name ? ` · ${v.name}` : ''}` : '—';
  };

  const dueCount = rows.filter(r => r.critical || r.warn).length;

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader
        title="Wartung & Prüfungen"
        subtitle="Serviceintervalle, HU-Termine und Werkstatthistorie des Fuhrparks"
        icon={Wrench}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                const { data, error } = await supabase.functions.invoke('fleet-maintenance-alerts');
                setSending(false);
                if (error) toast.error('Erinnerung fehlgeschlagen: ' + error.message);
                else toast.success(`${(data as any)?.alerts ?? 0} Hinweise · ${(data as any)?.overdue ?? 0} überfällig`);
              }}
            >
              <Mail className="h-4 w-4 mr-2" />{sending ? 'Sende…' : 'Erinnerungen senden'}
            </Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Wartung erfassen</Button>
          </div>
        }
      />

      {dueCount > 0 && (
        <Card className="p-4 flex items-center gap-2 border-amber-500/40">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="text-sm">{dueCount} Fahrzeug(e) benötigen demnächst Service oder HU.</span>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Wartung erfassen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fahrzeug *</Label>
              <Select value={form.vehicle_id} onValueChange={v => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Fahrzeug wählen" /></SelectTrigger>
                <SelectContent>
                  {(data?.vehicles ?? []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.license_plate}{v.name ? ` · ${v.name}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Art</Label><Input value={form.maintenance_type} onChange={e => setForm({ ...form, maintenance_type: e.target.value })} placeholder="Inspektion, HU, Reifenwechsel…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fällig am</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label>Durchgeführt am</Label><Input type="date" value={form.performed_at} onChange={e => setForm({ ...form, performed_at: e.target.value })} /></div>
              <div><Label>Kilometerstand</Label><Input type="number" value={form.odometer_km} onChange={e => setForm({ ...form, odometer_km: e.target.value })} /></div>
              <div><Label>Kosten (€)</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
            </div>
            <div><Label>Werkstatt</Label><Input value={form.workshop} onChange={e => setForm({ ...form, workshop: e.target.value })} /></div>
            <div><Label>Notizen</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button disabled={!form.vehicle_id || create.isPending} onClick={() => create.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="faellig">
        <TabsList>
          <TabsTrigger value="faellig">Fälligkeiten</TabsTrigger>
          <TabsTrigger value="historie">Historie</TabsTrigger>
        </TabsList>

        <TabsContent value="faellig">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead className="text-right">km-Stand</TableHead>
                  <TableHead className="text-right">Nächster Service (km)</TableHead>
                  <TableHead className="text-right">Rest km</TableHead>
                  <TableHead>Nächster Service (Datum)</TableHead>
                  <TableHead>HU fällig</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
                {!isPending && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Fahrzeuge erfasst.</TableCell></TableRow>}
                {rows.map(r => (
                  <TableRow key={r.v.id}>
                    <TableCell className="font-medium">{r.v.license_plate}{r.v.name ? ` · ${r.v.name}` : ''}</TableCell>
                    <TableCell className="text-right">{r.v.odometer_km != null ? `${nf(Number(r.v.odometer_km))} km` : '—'}</TableCell>
                    <TableCell className="text-right">{r.nextKm != null ? `${nf(r.nextKm)} km` : '—'}</TableCell>
                    <TableCell className="text-right">{r.kmLeft != null ? `${nf(r.kmLeft)} km` : '—'}</TableCell>
                    <TableCell>{r.nextDate ? format(r.nextDate, 'dd.MM.yyyy') : '—'}</TableCell>
                    <TableCell>{fmt(r.v.hu_due_date)}</TableCell>
                    <TableCell>
                      {r.critical ? <Badge variant="outline" className="border-red-500/40 text-red-400">Überfällig</Badge>
                        : r.warn ? <Badge variant="outline" className="border-amber-500/40 text-amber-400">Bald fällig</Badge>
                        : <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">OK</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="historie">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fahrzeug</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead>Fällig</TableHead>
                  <TableHead>Durchgeführt</TableHead>
                  <TableHead className="text-right">km</TableHead>
                  <TableHead className="text-right">Kosten</TableHead>
                  <TableHead>Werkstatt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.entries ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Noch keine Einträge.</TableCell></TableRow>}
                {(data?.entries ?? []).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{vehicleLabel(e.vehicle_id)}</TableCell>
                    <TableCell>{e.maintenance_type ?? '—'}</TableCell>
                    <TableCell>{fmt(e.due_date)}</TableCell>
                    <TableCell>{fmt(e.performed_at)}</TableCell>
                    <TableCell className="text-right">{e.odometer_km != null ? nf(Number(e.odometer_km)) : '—'}</TableCell>
                    <TableCell className="text-right">{e.cost != null ? `${nf(Number(e.cost), 2)} €` : '—'}</TableCell>
                    <TableCell>{e.workshop ?? '—'}</TableCell>
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
