import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Plus } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { VEHICLE_STATUS_LABELS } from './constants';

export default function DispatchFahrzeuge() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ license_plate: '', name: '', vehicle_type: '', load_volume_m3: '', max_payload_kg: '' });

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').order('license_plate');
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vehicles').insert({
        license_plate: form.license_plate.trim(),
        name: form.name.trim() || null,
        vehicle_type: form.vehicle_type.trim() || null,
        load_volume_m3: form.load_volume_m3 ? Number(form.load_volume_m3) : null,
        max_payload_kg: form.max_payload_kg ? Number(form.max_payload_kg) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fahrzeug angelegt');
      setOpen(false);
      setForm({ license_plate: '', name: '', vehicle_type: '', load_volume_m3: '', max_payload_kg: '' });
      qc.invalidateQueries({ queryKey: ['dispatch', 'vehicles'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Fehler beim Anlegen'),
  });

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Fahrzeuge"
        subtitle="Fuhrpark, Kapazitäten und Verfügbarkeit"
        icon={Truck}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Fahrzeug</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues Fahrzeug</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Kennzeichen *</Label><Input value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value })} /></div>
                <div><Label>Bezeichnung</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Typ</Label><Input placeholder="Transporter, LKW, PKW…" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Ladevolumen (m³)</Label><Input type="number" value={form.load_volume_m3} onChange={e => setForm({ ...form, load_volume_m3: e.target.value })} /></div>
                  <div><Label>Zuladung (kg)</Label><Input type="number" value={form.max_payload_kg} onChange={e => setForm({ ...form, max_payload_kg: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button disabled={!form.license_plate.trim() || create.isPending} onClick={() => create.mutate()}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kennzeichen</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Volumen</TableHead>
              <TableHead>Zuladung</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && (data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Noch keine Fahrzeuge erfasst.</TableCell></TableRow>}
            {(data ?? []).map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.license_plate}</TableCell>
                <TableCell>{v.name ?? '—'}</TableCell>
                <TableCell>{v.vehicle_type ?? '—'}</TableCell>
                <TableCell>{v.load_volume_m3 ? `${v.load_volume_m3} m³` : '—'}</TableCell>
                <TableCell>{v.max_payload_kg ? `${v.max_payload_kg} kg` : '—'}</TableCell>
                <TableCell>{VEHICLE_STATUS_LABELS[v.status] ?? v.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
