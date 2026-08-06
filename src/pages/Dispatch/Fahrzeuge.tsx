import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Truck, Plus, Pencil, Leaf } from 'lucide-react';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { VEHICLE_STATUS_LABELS } from './constants';

export const FUEL_TYPES: { value: string; label: string; co2: number; unit: string }[] = [
  { value: 'diesel', label: 'Diesel', co2: 250, unit: 'l/100 km' },
  { value: 'benzin', label: 'Benzin', co2: 230, unit: 'l/100 km' },
  { value: 'electric', label: 'Elektro', co2: 60, unit: 'kWh/100 km' },
  { value: 'hybrid', label: 'Hybrid', co2: 150, unit: 'l/100 km' },
  { value: 'lpg', label: 'LPG / CNG', co2: 190, unit: 'kg/100 km' },
];

export const DEFAULT_CO2 = (fuel?: string | null) =>
  FUEL_TYPES.find(f => f.value === (fuel ?? 'diesel'))?.co2 ?? 250;

const emptyForm = {
  license_plate: '', name: '', vehicle_type: '',
  load_volume_m3: '', max_payload_kg: '',
  fuel_type: 'diesel', consumption_per_100km: '', co2_g_per_km: '',
  cost_per_km: '', fixed_cost_per_day: '',
  telematics_provider: '', telematics_device_id: '',
  service_interval_km: '', service_interval_months: '',
  last_service_km: '', last_service_date: '',
  odometer_km: '',
};

const num = (v: string) => (v === '' ? null : Number(v));

export default function DispatchFahrzeuge() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data, isPending } = useQuery({
    queryKey: ['dispatch', 'vehicles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').order('license_plate');
      if (error) throw error;
      return data ?? [];
    },
  });

  const openNew = () => { setEditId(null); setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (v: any) => {
    setEditId(v.id);
    setForm({
      license_plate: v.license_plate ?? '', name: v.name ?? '', vehicle_type: v.vehicle_type ?? '',
      load_volume_m3: v.load_volume_m3?.toString() ?? '', max_payload_kg: v.max_payload_kg?.toString() ?? '',
      fuel_type: v.fuel_type ?? (v.is_electric ? 'electric' : 'diesel'),
      consumption_per_100km: v.consumption_per_100km?.toString() ?? '',
      co2_g_per_km: v.co2_g_per_km?.toString() ?? '',
      cost_per_km: v.cost_per_km?.toString() ?? '',
      fixed_cost_per_day: v.fixed_cost_per_day?.toString() ?? '',
      telematics_provider: v.telematics_provider ?? '', telematics_device_id: v.telematics_device_id ?? '',
      service_interval_km: v.service_interval_km?.toString() ?? '',
      service_interval_months: v.service_interval_months?.toString() ?? '',
      last_service_km: v.last_service_km?.toString() ?? '',
      last_service_date: v.last_service_date ?? '',
      odometer_km: v.odometer_km?.toString() ?? '',
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        license_plate: form.license_plate.trim(),
        name: form.name.trim() || null,
        vehicle_type: form.vehicle_type.trim() || null,
        load_volume_m3: num(form.load_volume_m3),
        max_payload_kg: num(form.max_payload_kg),
        fuel_type: form.fuel_type,
        is_electric: form.fuel_type === 'electric',
        consumption_per_100km: num(form.consumption_per_100km),
        co2_g_per_km: num(form.co2_g_per_km),
        cost_per_km: num(form.cost_per_km),
        fixed_cost_per_day: num(form.fixed_cost_per_day),
        telematics_provider: form.telematics_provider.trim() || null,
        telematics_device_id: form.telematics_device_id.trim() || null,
        service_interval_km: num(form.service_interval_km),
        service_interval_months: num(form.service_interval_months),
        last_service_km: num(form.last_service_km),
        last_service_date: form.last_service_date || null,
        odometer_km: num(form.odometer_km),
      };
      const { error } = editId
        ? await supabase.from('vehicles').update(payload).eq('id', editId)
        : await supabase.from('vehicles').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? 'Fahrzeug aktualisiert' : 'Fahrzeug angelegt');
      setOpen(false); setEditId(null); setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ['dispatch', 'vehicles'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Fehler beim Speichern'),
  });

  const fuelMeta = FUEL_TYPES.find(f => f.value === form.fuel_type);

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-4">
      <PageHeader
        title="Fahrzeuge"
        subtitle="Fuhrpark, Kapazitäten, Verbrauch, Kostensätze und Telematik"
        icon={Truck}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Fahrzeug</Button>}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Kennzeichen *</Label><Input value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value })} /></div>
              <div><Label>Bezeichnung</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Typ</Label><Input placeholder="Transporter, LKW, PKW…" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} /></div>
              <div><Label>Kilometerstand</Label><Input type="number" value={form.odometer_km} onChange={e => setForm({ ...form, odometer_km: e.target.value })} /></div>
              <div><Label>Ladevolumen (m³)</Label><Input type="number" value={form.load_volume_m3} onChange={e => setForm({ ...form, load_volume_m3: e.target.value })} /></div>
              <div><Label>Zuladung (kg)</Label><Input type="number" value={form.max_payload_kg} onChange={e => setForm({ ...form, max_payload_kg: e.target.value })} /></div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="text-sm font-medium flex items-center gap-2"><Leaf className="h-4 w-4 text-emerald-400" /> Verbrauch & CO₂</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Kraftstoffart</Label>
                  <Select value={form.fuel_type} onValueChange={v => setForm({ ...form, fuel_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Verbrauch ({fuelMeta?.unit})</Label><Input type="number" step="0.1" value={form.consumption_per_100km} onChange={e => setForm({ ...form, consumption_per_100km: e.target.value })} /></div>
                <div>
                  <Label>CO₂ (g/km)</Label>
                  <Input type="number" placeholder={`Standard ${fuelMeta?.co2}`} value={form.co2_g_per_km} onChange={e => setForm({ ...form, co2_g_per_km: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="text-sm font-medium">Kostensätze</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Kosten pro km (€)</Label><Input type="number" step="0.01" value={form.cost_per_km} onChange={e => setForm({ ...form, cost_per_km: e.target.value })} /></div>
                <div><Label>Fixkosten pro Tag (€)</Label><Input type="number" step="0.01" value={form.fixed_cost_per_day} onChange={e => setForm({ ...form, fixed_cost_per_day: e.target.value })} /></div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="text-sm font-medium">Wartungsintervalle</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Intervall (km)</Label><Input type="number" value={form.service_interval_km} onChange={e => setForm({ ...form, service_interval_km: e.target.value })} /></div>
                <div><Label>Intervall (Monate)</Label><Input type="number" value={form.service_interval_months} onChange={e => setForm({ ...form, service_interval_months: e.target.value })} /></div>
                <div><Label>Letzter Service (km)</Label><Input type="number" value={form.last_service_km} onChange={e => setForm({ ...form, last_service_km: e.target.value })} /></div>
                <div><Label>Letzter Service (Datum)</Label><Input type="date" value={form.last_service_date} onChange={e => setForm({ ...form, last_service_date: e.target.value })} /></div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="text-sm font-medium">Telematik</div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Anbieter</Label><Input placeholder="Webfleet, Bosch…" value={form.telematics_provider} onChange={e => setForm({ ...form, telematics_provider: e.target.value })} /></div>
                <div><Label>Geräte-ID</Label><Input value={form.telematics_device_id} onChange={e => setForm({ ...form, telematics_device_id: e.target.value })} /></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!form.license_plate.trim() || save.isPending} onClick={() => save.mutate()}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kennzeichen</TableHead>
              <TableHead>Bezeichnung</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Antrieb</TableHead>
              <TableHead className="text-right">Verbrauch</TableHead>
              <TableHead className="text-right">CO₂ g/km</TableHead>
              <TableHead className="text-right">€/km</TableHead>
              <TableHead className="text-right">Zuladung</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isPending && (data ?? []).length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Noch keine Fahrzeuge erfasst.</TableCell></TableRow>}
            {(data ?? []).map((v: any) => {
              const meta = FUEL_TYPES.find(f => f.value === (v.fuel_type ?? (v.is_electric ? 'electric' : 'diesel')));
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.license_plate}</TableCell>
                  <TableCell>{v.name ?? '—'}</TableCell>
                  <TableCell>{v.vehicle_type ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={meta?.value === 'electric' ? 'border-emerald-500/40 text-emerald-400' : ''}>
                      {meta?.label ?? '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{v.consumption_per_100km ? `${v.consumption_per_100km} ${meta?.unit}` : '—'}</TableCell>
                  <TableCell className="text-right">{v.co2_g_per_km ?? meta?.co2 ?? '—'}</TableCell>
                  <TableCell className="text-right">{v.cost_per_km != null ? `${Number(v.cost_per_km).toFixed(2)} €` : '—'}</TableCell>
                  <TableCell className="text-right">{v.max_payload_kg ? `${v.max_payload_kg} kg` : '—'}</TableCell>
                  <TableCell>{VEHICLE_STATUS_LABELS[v.status] ?? v.status}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
