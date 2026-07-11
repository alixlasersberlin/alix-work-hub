import { useState } from 'react';
import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { ResourceTimeline } from '@/components/esc/resources/ResourceTimeline';
import { RmModal } from '@/components/esc/resources/RmModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Wrench, Plus, Pencil, Trash2 } from 'lucide-react';
import type { RmVehicle } from '@/lib/esc/resources/types';

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-600',
  assigned: 'bg-primary/15 text-primary',
  maintenance: 'bg-amber-500/15 text-amber-600',
  unavailable: 'bg-destructive/15 text-destructive',
};

const empty = (): RmVehicle => ({
  id: `veh-${Date.now().toString(36)}`, plate: '', status: 'available',
});

export default function RmVehicles() {
  const { vehicles, locations, maintenance, upsertVehicle, removeVehicle } = useResourceMgmt();
  const { appointments } = useAppointments();
  const [editing, setEditing] = useState<RmVehicle | null>(null);

  const save = () => { if (editing && editing.plate.trim()) { upsertVehicle(editing); setEditing(null); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2"><Truck className="h-5 w-5" />Fahrzeuge</h1>
        <Button size="sm" onClick={() => setEditing(empty())}><Plus className="h-4 w-4 mr-1" />Neues Fahrzeug</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={vehicles.map((v) => ({ id: v.id, label: v.plate, sub: `${v.brand || ''} ${v.model || ''} · ${locations.find((l) => l.id === v.locationId)?.name || ''}`, color: v.color }))}
          appointments={appointments}
          matcher={(row, apt) => (apt as any).vehicleId === row.id}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Flotte</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {vehicles.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Fahrzeuge angelegt.</div>}
            {vehicles.map((v) => {
              const due = maintenance.find((m) => m.resourceId === v.id);
              return (
                <div key={v.id} className="border-b pb-2 last:border-b-0 last:pb-0 text-xs group">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{v.plate}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[v.status] || ''}`}>{v.status}</span>
                      <div className="flex gap-1 opacity-100 transition">
                        <button onClick={() => setEditing({ ...v })} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => removeVehicle(v.id)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {v.brand} {v.model} · {v.year} · {v.mileageKm ? `${v.mileageKm.toLocaleString('de-DE')} km` : ''}
                  </div>
                  <div className="text-[10px] text-muted-foreground">TÜV: {v.tuvUntil || '—'} · Wartung: {v.nextServiceAt || '—'}</div>
                  {due && <Badge variant="outline" className="text-[9px] mt-1"><Wrench className="h-3 w-3 mr-1" />{due.title}</Badge>}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <RmModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && vehicles.some((x) => x.id === editing.id) ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Abbrechen</Button>
          <Button size="sm" onClick={save}>Speichern</Button>
        </>}
      >
        {editing && (
          <div className="space-y-3">
            <div><Label>Kennzeichen</Label><Input value={editing.plate} onChange={(e) => setEditing({ ...editing, plate: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Marke</Label><Input value={editing.brand || ''} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
              <div><Label>Modell</Label><Input value={editing.model || ''} onChange={(e) => setEditing({ ...editing, model: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Baujahr</Label><Input type="number" value={editing.year ?? ''} onChange={(e) => setEditing({ ...editing, year: e.target.value ? Number(e.target.value) : undefined })} /></div>
              <div><Label>Kilometerstand</Label><Input type="number" value={editing.mileageKm ?? ''} onChange={(e) => setEditing({ ...editing, mileageKm: e.target.value ? Number(e.target.value) : undefined })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>TÜV bis</Label><Input type="date" value={editing.tuvUntil || ''} onChange={(e) => setEditing({ ...editing, tuvUntil: e.target.value })} /></div>
              <div><Label>Nächste Wartung</Label><Input type="date" value={editing.nextServiceAt || ''} onChange={(e) => setEditing({ ...editing, nextServiceAt: e.target.value })} /></div>
            </div>
            <div><Label>Standort</Label>
              <select className="w-full h-9 px-2 rounded border bg-background" value={editing.locationId || ''}
                onChange={(e) => setEditing({ ...editing, locationId: e.target.value })}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div><Label>Status</Label>
              <select className="w-full h-9 px-2 rounded border bg-background" value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as RmVehicle['status'] })}>
                <option value="available">verfügbar</option>
                <option value="assigned">zugewiesen</option>
                <option value="maintenance">Wartung</option>
                <option value="unavailable">nicht verfügbar</option>
              </select>
            </div>
            <div><Label>Farbe</Label><Input type="color" value={editing.color || '#0ea5e9'} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></div>
          </div>
        )}
      </RmModal>
    </div>
  );
}
