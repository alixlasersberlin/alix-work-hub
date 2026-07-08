import { useResourceMgmt } from '@/hooks/esc/useResourceMgmt';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { ResourceTimeline } from '@/components/esc/resources/ResourceTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function RmEmployees() {
  const { employees, qualifications, locations } = useResourceMgmt();
  const { appointments } = useAppointments();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Mitarbeiterplanung</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <ResourceTimeline
          rows={employees.map((e) => ({ id: e.id, label: e.name, sub: `${e.role || ''} · ${locations.find((l) => l.id === e.locationId)?.name || ''}`, color: e.color }))}
          appointments={appointments}
          matcher={(row, apt) => apt.employeeIds.includes(row.id)}
        />
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Team &amp; Qualifikationen</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {employees.map((e) => (
              <div key={e.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                <div className="text-sm font-medium">{e.name}</div>
                <div className="text-[11px] text-muted-foreground">{e.role} · {locations.find((l) => l.id === e.locationId)?.name || '—'}</div>
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
    </div>
  );
}
