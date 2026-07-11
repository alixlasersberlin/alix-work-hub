import { FieldMapPlaceholder } from '@/components/esc/resources/FieldMap';
import { RmQuickActions } from '@/components/esc/resources/RmQuickActions';
import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RmField() {
  const { employees, vehicles, locations } = useResourceMgmt();
  const { appointments } = useAppointments();
  const today = new Date().toDateString();
  const todays = appointments.filter((a) => new Date(a.startAt).toDateString() === today);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Außendienst</h1>
      <RmQuickActions />
      <FieldMapPlaceholder />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Techniker im Einsatz (heute)</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {employees.slice(0, 4).map((e) => (
              <div key={e.id} className="flex justify-between"><span>{e.name}</span><span className="text-muted-foreground">{locations.find((l) => l.id === e.locationId)?.name || '—'}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Fahrzeuge unterwegs</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {vehicles.map((v) => (
              <div key={v.id} className="flex justify-between"><span>{v.plate}</span><span className="text-muted-foreground">{v.status}</span></div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Heutige Einsätze</CardTitle></CardHeader>
          <CardContent className="text-xs space-y-1">
            {todays.length === 0 && <div className="text-muted-foreground">Keine Einsätze heute.</div>}
            {todays.slice(0, 6).map((a) => (
              <div key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.title}</span><span className="text-muted-foreground">{a.location || a.address || '—'}</span></div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
