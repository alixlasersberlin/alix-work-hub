import { useState } from 'react';
import type { EscAppointment } from '@/lib/esc/types';
import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { checkAssignment } from '@/lib/esc/resources/availability';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, User, Truck, DoorOpen, Cpu } from 'lucide-react';
import { toast } from 'sonner';

// Drag & drop disposition board. HTML5 DnD keeps the surface dependency-free.
export function DispatchBoard({ appointments }: { appointments: EscAppointment[] }) {
  const { employees, vehicles, rooms, demoDevices, absences } = useResourceMgmt();
  const [assignments, setAssignments] = useState<Record<string, {
    employeeIds: string[]; vehicleId?: string; roomId?: string; deviceId?: string;
  }>>({});

  const drop = (aptId: string, kind: 'employee' | 'vehicle' | 'room' | 'device', targetId: string) => {
    const apt = appointments.find((a) => a.id === aptId);
    if (!apt) return;
    const current = assignments[aptId] || { employeeIds: [] };
    const merged = kind === 'employee'
      ? { ...current, employeeIds: [...new Set([...current.employeeIds, targetId])] }
      : kind === 'vehicle' ? { ...current, vehicleId: targetId }
      : kind === 'room'    ? { ...current, roomId: targetId }
      :                      { ...current, deviceId: targetId };

    const conflicts = checkAssignment(
      {
        employeeIds: merged.employeeIds,
        vehicleId: merged.vehicleId,
        roomId: merged.roomId,
        demoDeviceId: merged.deviceId,
        from: apt.startAt, to: apt.endAt,
      },
      { appointments, employees, vehicles, rooms, demoDevices, absences },
    );

    const errors = conflicts.filter((c) => c.severity === 'error');
    if (errors.length) {
      toast.error(`Konflikt: ${errors[0].message}`);
      return;
    }
    if (conflicts.length) toast.warning(conflicts[0].message);
    setAssignments((prev) => ({ ...prev, [aptId]: merged }));
    toast.success('Ressource zugeordnet');
  };

  const openApts = appointments.filter((a) => !assignments[a.id]?.employeeIds.length);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Offene Termine · {openApts.length}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {openApts.map((a) => (
            <div key={a.id}
                 draggable
                 onDragStart={(e) => e.dataTransfer.setData('esc/apt', a.id)}
                 className="rounded-md border p-2 text-xs cursor-grab hover:bg-accent">
              <div className="font-medium truncate">{a.title}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(a.startAt).toLocaleString('de-DE')}</div>
              {a.kind && <Badge variant="outline" className="text-[9px] mt-1">{a.kind}</Badge>}
            </div>
          ))}
          {openApts.length === 0 && <div className="text-xs text-muted-foreground">Alle Termine zugeordnet.</div>}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <ResPool title="Mitarbeiter" icon={User} onDrop={(id, aptId) => drop(aptId, 'employee', id)}
                 items={employees.map((e) => ({ id: e.id, label: e.name, sub: e.role, color: e.color }))} />
        <ResPool title="Fahrzeuge" icon={Truck} onDrop={(id, aptId) => drop(aptId, 'vehicle', id)}
                 items={vehicles.map((v) => ({ id: v.id, label: `${v.plate}`, sub: `${v.brand || ''} ${v.model || ''}`, color: v.color }))} />
        <ResPool title="Räume" icon={DoorOpen} onDrop={(id, aptId) => drop(aptId, 'room', id)}
                 items={rooms.map((r) => ({ id: r.id, label: r.name, sub: `${r.capacity || '?'} Plätze` }))} />
        <ResPool title="Vorführgeräte" icon={Cpu} onDrop={(id, aptId) => drop(aptId, 'device', id)}
                 items={demoDevices.map((d) => ({ id: d.id, label: d.name, sub: d.status }))} />
      </div>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Zugewiesene Termine</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs">
            {Object.entries(assignments).map(([aptId, a]) => {
              const apt = appointments.find((x) => x.id === aptId);
              if (!apt) return null;
              return (
                <div key={aptId} className="flex items-center gap-2 border-b py-1">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  <span className="font-medium truncate">{apt.title}</span>
                  <span className="text-muted-foreground">
                    {a.employeeIds.length ? `👤 ${a.employeeIds.length}` : ''}
                    {a.vehicleId ? ' · 🚚' : ''}
                    {a.roomId ? ' · 🚪' : ''}
                    {a.deviceId ? ' · 🖥️' : ''}
                  </span>
                </div>
              );
            })}
            {!Object.keys(assignments).length && (
              <div className="flex items-center gap-2 text-muted-foreground"><AlertCircle className="h-3 w-3" />Noch keine Zuordnungen</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResPool({ title, icon: Icon, items, onDrop }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { id: string; label: string; sub?: string; color?: string }[];
  onDrop: (id: string, aptId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-xs flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-1.5">
        {items.map((i) => (
          <div key={i.id}
               onDragOver={(e) => e.preventDefault()}
               onDrop={(e) => { e.preventDefault(); const aptId = e.dataTransfer.getData('esc/apt'); if (aptId) onDrop(i.id, aptId); }}
               className="rounded-md border p-2 text-[11px] hover:border-primary/60 transition">
            <div className="font-medium truncate flex items-center gap-1.5">
              {i.color && <span className="w-2 h-2 rounded-full" style={{ background: i.color }} />}
              {i.label}
            </div>
            {i.sub && <div className="text-[10px] text-muted-foreground truncate">{i.sub}</div>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
