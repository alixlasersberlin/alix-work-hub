import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { ResourceTimeline } from '@/components/esc/resources/ResourceTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  available: 'Verfügbar', reserved: 'Reserviert', in_transit: 'Unterwegs',
  with_customer: 'Beim Kunden', service: 'Service', fair: 'Messe', showroom: 'Showroom',
};

export default function RmDevices() {
  const { demoDevices, locations } = useResourceMgmt();
  const { appointments } = useAppointments();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><Cpu className="h-5 w-5" />Vorführ- und Ersatzgeräte</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={demoDevices.map((d) => ({ id: d.id, label: d.name, sub: `${d.model} · ${locations.find((l) => l.id === d.locationId)?.name || ''}` }))}
          appointments={appointments}
          matcher={(row, apt) => apt.deviceId === row.id}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Geräte-Status</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {demoDevices.map((d) => (
              <div key={d.id} className="border-b pb-1.5 last:border-b-0 last:pb-0 flex items-center justify-between">
                <div>
                  <div className="font-medium">{d.name}</div>
                  <div className="text-[10px] text-muted-foreground">{d.model} · {locations.find((l) => l.id === d.locationId)?.name}</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{STATUS_LABELS[d.status] || d.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
