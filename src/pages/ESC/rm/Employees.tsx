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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { RmEmployeeExt } from '@/lib/esc/resources/types';

const empty = (): RmEmployeeExt => ({
  id: `emp-${Date.now().toString(36)}`, name: '', role: '', locationId: '',
  qualifications: [], shifts: [], active: true,
});

export default function RmEmployees() {
  const { employees, qualifications, locations, upsertEmployee, removeEmployee } = useResourceMgmt();
  const { appointments } = useAppointments();
  const [editing, setEditing] = useState<RmEmployeeExt | null>(null);

  const save = () => { if (editing && editing.name.trim()) { upsertEmployee(editing); setEditing(null); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Mitarbeiterplanung</h1>
        <Button size="sm" onClick={() => setEditing(empty())}><Plus className="h-4 w-4 mr-1" />Neuer Mitarbeiter</Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={employees.map((e) => ({ id: e.id, label: e.name, sub: `${e.role || ''} · ${locations.find((l) => l.id === e.locationId)?.name || ''}`, color: e.color }))}
          appointments={appointments}
          matcher={(row, apt) => apt.employeeIds.includes(row.id)}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Team &amp; Qualifikationen</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {employees.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Mitarbeiter angelegt.</div>}
            {employees.map((e) => (
              <div key={e.id} className="border-b pb-2 last:border-b-0 last:pb-0 group">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{e.name}</div>
                    <div className="text-[11px] text-muted-foreground">{e.role} · {locations.find((l) => l.id === e.locationId)?.name || '—'}</div>
                  </div>
                  <div className="flex gap-1 opacity-100 transition">
                    <button onClick={() => setEditing({ ...e })} className="p-1 rounded hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => removeEmployee(e.id)} className="p-1 rounded hover:bg-muted text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {e.qualifications.map((q) => {
                    const qq = qualifications.find((x) => x.id === q);
                    return <Badge key={q} variant="secondary" className="text-[9px]">{qq?.name || q}</Badge>;
                  })}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Max {e.maxAppointmentsPerDay || '—'} Termine/Tag · max {e.maxTravelMinutes || '—'} min Fahrzeit
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <RmModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && employees.some((x) => x.id === editing.id) ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}
        footer={<>
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Abbrechen</Button>
          <Button size="sm" onClick={save}>Speichern</Button>
        </>}
      >
        {editing && (
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Rolle</Label><Input value={editing.role || ''} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></div>
            <div><Label>Standort</Label>
              <select className="w-full h-9 px-2 rounded border bg-background" value={editing.locationId || ''}
                onChange={(e) => setEditing({ ...editing, locationId: e.target.value })}>
                <option value="">—</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div><Label>Qualifikationen</Label>
              <div className="flex flex-wrap gap-1">
                {qualifications.map((q) => {
                  const active = editing.qualifications.includes(q.id);
                  return (
                    <button key={q.id} type="button"
                      onClick={() => setEditing({
                        ...editing,
                        qualifications: active ? editing.qualifications.filter((x) => x !== q.id) : [...editing.qualifications, q.id],
                      })}
                      className={`text-[10px] px-2 py-0.5 rounded border ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted'}`}>
                      {q.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Max Termine/Tag</Label><Input type="number" value={editing.maxAppointmentsPerDay ?? ''} onChange={(e) => setEditing({ ...editing, maxAppointmentsPerDay: e.target.value ? Number(e.target.value) : undefined })} /></div>
              <div><Label>Max Fahrzeit (min)</Label><Input type="number" value={editing.maxTravelMinutes ?? ''} onChange={(e) => setEditing({ ...editing, maxTravelMinutes: e.target.value ? Number(e.target.value) : undefined })} /></div>
            </div>
            <div><Label>Farbe</Label><Input type="color" value={editing.color || '#3b82f6'} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></div>
          </div>
        )}
      </RmModal>
    </div>
  );
}
