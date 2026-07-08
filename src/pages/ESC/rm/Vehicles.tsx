import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { ResourceTimeline } from '@/components/esc/resources/ResourceTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Wrench } from 'lucide-react';

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-emerald-500/15 text-emerald-600',
  assigned: 'bg-primary/15 text-primary',
  maintenance: 'bg-amber-500/15 text-amber-600',
  unavailable: 'bg-destructive/15 text-destructive',
};

export default function RmVehicles() {
  const { vehicles, locations, maintenance } = useResourceMgmt();
  const { appointments } = useAppointments();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><Truck className="h-5 w-5" />Fahrzeuge</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={vehicles.map((v) => ({ id: v.id, label: v.plate, sub: `${v.brand || ''} ${v.model || ''} · ${locations.find((l) => l.id === v.locationId)?.name || ''}`, color: v.color }))}
          appointments={appointments}
          matcher={(row, apt) => (apt as any).vehicleId === row.id}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Flotte</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {vehicles.map((v) => {
              const due = maintenance.find((m) => m.resourceId === v.id);
              return (
                <div key={v.id} className="border-b pb-2 last:border-b-0 last:pb-0 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{v.plate}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[v.status] || ''}`}>{v.status}</span>
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
    </div>
  );
}
