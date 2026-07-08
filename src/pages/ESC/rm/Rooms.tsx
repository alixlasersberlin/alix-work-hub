import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { ResourceTimeline } from '@/components/esc/resources/ResourceTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DoorOpen } from 'lucide-react';

export default function RmRooms() {
  const { rooms, locations } = useResourceMgmt();
  const { appointments } = useAppointments();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold flex items-center gap-2"><DoorOpen className="h-5 w-5" />Räume</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={rooms.map((r) => ({ id: r.id, label: r.name, sub: `${locations.find((l) => l.id === r.locationId)?.name || ''} · ${r.capacity || '?'} Plätze` }))}
          appointments={appointments}
          matcher={(row, apt) => apt.room === row.id}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Räume &amp; Ausstattung</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            {rooms.map((r) => (
              <div key={r.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                <div className="font-medium">{r.name}</div>
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
    </div>
  );
}
