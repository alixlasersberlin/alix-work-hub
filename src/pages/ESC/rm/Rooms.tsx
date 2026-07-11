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
import { DoorOpen, Plus, Pencil, Trash2 } from 'lucide-react';
import type { RmRoom } from '@/lib/esc/resources/types';

const empty = (): RmRoom => ({
  id: `room-${Date.now().toString(36)}`, name: '', amenities: [], status: 'available',
});

export default function RmRooms() {
  const { rooms, locations, upsertRoom, removeRoom } = useResourceMgmt();
  const { appointments } = useAppointments();
  const [editing, setEditing] = useState<RmRoom | null>(null);

  const save = () => { if (editing && editing.name.trim()) { upsertRoom(editing); setEditing(null); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2"><DoorOpen className="h-5 w-5" />Räume</h1>
        <Button size="sm" onClick={() => setEditing(empty())}><Plus className="h-4 w-4 mr-1" />Neuer Raum</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={rooms.map((r) => ({ id: r.id, label: r.name, sub: `${locations.find((l) => l.id === r.locationId)?.name || ''} · ${r.capacity || '?'} Plätze` }))}
          appointments={appointments}
          matcher={(row, apt) => apt.room === row.id}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Räume &amp; Ausstattung</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {rooms.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Räume angelegt.</div>}
            {rooms.map((r) => (
              <div key={r.id} className="border-b pb-2 last:border-b-0 last:pb-0 group">
                <div className="flex items-start justify-between">
                  <div className="font-medium">{r.name}</div>
                  <div className="flex gap-1 opacity-100 transition">
                    <button onClick={() => setEditing({ ...r })} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => removeRoom(r.id)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {locations.find((l) => l.id === r.locationId)?.name || '—'} · {r.capacity || '?'} Plätze · {r.status}
                  {r.accessible ? ' · barrierefrei' : ''}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.amenities.map((a) => <Badge key={a} variant="outline" className="text-[9px]">{a}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <RmModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && rooms.some((x) => x.id === editing.id) ? 'Raum bearbeiten' : 'Neuer Raum'}
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Abbrechen</Button>
          <Button size="sm" onClick={save}>Speichern</Button>
        </>}
      >
        {editing && (
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Standort</Label>
                <select className="w-full h-9 px-2 rounded border bg-background" value={editing.locationId || ''}
                  onChange={(e) => setEditing({ ...editing, locationId: e.target.value })}>
                  <option value="">—</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div><Label>Kapazität</Label><Input type="number" value={editing.capacity ?? ''} onChange={(e) => setEditing({ ...editing, capacity: e.target.value ? Number(e.target.value) : undefined })} /></div>
            </div>
            <div><Label>Ausstattung (kommagetrennt)</Label>
              <Input value={editing.amenities.join(', ')} onChange={(e) => setEditing({ ...editing, amenities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <div><Label>Status</Label>
              <select className="w-full h-9 px-2 rounded border bg-background" value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as RmRoom['status'] })}>
                <option value="available">verfügbar</option>
                <option value="blocked">gesperrt</option>
                <option value="maintenance">Wartung</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!editing.accessible} onChange={(e) => setEditing({ ...editing, accessible: e.target.checked })} />
              barrierefrei
            </label>
          </div>
        )}
      </RmModal>
    </div>
  );
}
