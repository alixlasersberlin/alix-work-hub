import { useState } from 'react';
import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { ResourceTimeline } from '@/components/esc/resources/ResourceTimeline';
import { RmModal } from '@/components/esc/resources/RmModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cpu, Plus, Pencil, Trash2 } from 'lucide-react';
import type { RmDemoDevice } from '@/lib/esc/resources/types';

const STATUS_LABELS: Record<string, string> = {
  available: 'Verfügbar', reserved: 'Reserviert', in_transit: 'Unterwegs',
  with_customer: 'Beim Kunden', service: 'Service', fair: 'Messe', showroom: 'Showroom',
};

const empty = (): RmDemoDevice => ({
  id: `dev-${Date.now().toString(36)}`, name: '', model: '', status: 'available',
});

export default function RmDevices() {
  const { demoDevices, locations, upsertDemoDevice, removeDemoDevice } = useResourceMgmt();
  const { appointments } = useAppointments();
  const [editing, setEditing] = useState<RmDemoDevice | null>(null);

  const save = () => { if (editing && editing.name.trim()) { upsertDemoDevice(editing); setEditing(null); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2"><Cpu className="h-5 w-5" />Vorführ- und Ersatzgeräte</h1>
        <Button size="sm" onClick={() => setEditing(empty())}><Plus className="h-4 w-4 mr-1" />Neues Gerät</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={demoDevices.map((d) => ({ id: d.id, label: d.name, sub: `${d.model} · ${locations.find((l) => l.id === d.locationId)?.name || ''}` }))}
          appointments={appointments}
          matcher={(row, apt) => apt.deviceId === row.id}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Geräte-Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {demoDevices.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Geräte angelegt.</div>}
            {demoDevices.map((d) => (
              <div key={d.id} className="border-b pb-1.5 last:border-b-0 last:pb-0 flex items-center justify-between group">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground">{d.model} · {locations.find((l) => l.id === d.locationId)?.name}</div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{STATUS_LABELS[d.status] || d.status}</span>
                  <div className="flex gap-1 opacity-100 transition">
                    <button onClick={() => setEditing({ ...d })} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => removeDemoDevice(d.id)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <RmModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && demoDevices.some((x) => x.id === editing.id) ? 'Gerät bearbeiten' : 'Neues Gerät'}
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Abbrechen</Button>
          <Button size="sm" onClick={save}>Speichern</Button>
        </>}
      >
        {editing && (
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Modell</Label><Input value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} /></div>
            <div><Label>Seriennummer</Label><Input value={editing.serialNumber || ''} onChange={(e) => setEditing({ ...editing, serialNumber: e.target.value })} /></div>
            <div><Label>Standort</Label>
              <select className="w-full h-9 px-2 rounded border bg-background" value={editing.locationId || ''}
                onChange={(e) => setEditing({ ...editing, locationId: e.target.value })}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div><Label>Status</Label>
              <select className="w-full h-9 px-2 rounded border bg-background" value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as RmDemoDevice['status'] })}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        )}
      </RmModal>
    </div>
  );
}
