import { CapacityHeatmap } from '@/components/esc/resources/CapacityHeatmap';
import { LiveAvailability } from '@/components/esc/resources/LiveAvailability';
import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RmCapacity() {
  const { employees, maintenance } = useResourceMgmt();
  const { appointments } = useAppointments();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Kapazitäten &amp; Auslastung</h1>
      <LiveAvailability />
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">Heatmap – nächste 14 Tage</CardTitle></CardHeader>
        <CardContent><CapacityHeatmap employees={employees} appointments={appointments} /></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1"><CardTitle className="text-sm">Wartungshinweise</CardTitle></CardHeader>
        <CardContent className="text-xs space-y-1">
          {maintenance.length === 0 && <div className="text-muted-foreground">Alle Ressourcen aktuell.</div>}
          {maintenance.map((m) => (
            <div key={m.id} className="flex justify-between border-b py-1 last:border-b-0">
              <span>{m.title}</span>
              <span className="text-muted-foreground">{new Date(m.dueAt).toLocaleDateString('de-DE')} · {m.severity}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
