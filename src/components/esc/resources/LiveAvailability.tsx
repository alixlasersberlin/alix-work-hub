import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { CircleUserRound, DoorOpen, Truck, Cpu } from 'lucide-react';

// "Jetzt frei" – rein clientseitige Live-Auslastung.
export function LiveAvailability() {
  const { employees, vehicles, rooms, demoDevices, absences } = useResourceMgmt();
  const { appointments } = useAppointments();
  const now = new Date();

  const status = useMemo(() => {
    const isBusy = (predicate: (a: any) => boolean) =>
      appointments.some((a) => predicate(a) && new Date(a.startAt) <= now && new Date(a.endAt) > now);
    const empFree = employees.filter((e) => !isBusy((a) => a.employeeIds?.includes(e.id))
      && !absences.some((ab) => ab.resourceId === e.id && new Date(ab.from) <= now && new Date(ab.to) > now));
    const vFree = vehicles.filter((v) => v.status === 'available' && !isBusy((a) => a.vehicleId === v.id));
    const rFree = rooms.filter((r) => r.status === 'available' && !isBusy((a) => a.room === r.id));
    const dFree = demoDevices.filter((d) => d.status === 'available' && !isBusy((a) => a.deviceId === d.id));
    return { empFree, vFree, rFree, dFree };
  }, [employees, vehicles, rooms, demoDevices, absences, appointments]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Widget icon={CircleUserRound} label="Freie Mitarbeiter" count={status.empFree.length} preview={status.empFree.slice(0,3).map((e) => e.name)} />
      <Widget icon={Truck} label="Freie Fahrzeuge" count={status.vFree.length} preview={status.vFree.slice(0,3).map((v) => v.plate)} />
      <Widget icon={DoorOpen} label="Freie Räume" count={status.rFree.length} preview={status.rFree.slice(0,3).map((r) => r.name)} />
      <Widget icon={Cpu} label="Freie Vorführgeräte" count={status.dFree.length} preview={status.dFree.slice(0,3).map((d) => d.name)} />
    </div>
  );
}

function Widget({ icon: Icon, label, count, preview }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; count: number; preview: string[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{count}</div>
        <div className="text-[10px] text-muted-foreground truncate">{preview.join(', ') || '—'}</div>
      </CardContent>
    </Card>
  );
}
