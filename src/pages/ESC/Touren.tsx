import { useMemo, useState } from 'react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useEmployees } from '@/hooks/esc/useEmployees';
import { buildTours } from '@/lib/esc/tours/nearest-neighbor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Route, MapPin, Clock, User } from 'lucide-react';

export default function EscTouren() {
  const { appointments } = useAppointments();
  const { employees } = useEmployees();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const tours = useMemo(() => {
    const inRange = appointments.filter((a) => a.startAt.slice(0, 10) === date);
    return buildTours(inRange);
  }, [appointments, date]);

  const empName = (id: string) => employees.find((e) => e.id === id)?.name || (id === '_unassigned' ? 'Nicht zugewiesen' : id);
  const empColor = (id: string) => employees.find((e) => e.id === id)?.color;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" /> Tourenplanung
          </h1>
          <p className="text-xs text-muted-foreground">
            Optimierte Reihenfolge pro Techniker · Nearest-Neighbor auf PLZ-Basis · gemeinsame Farbkennung im Kalender.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Datum</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {tours.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Keine Termine an diesem Tag.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tours.map((t) => (
          <Card key={`${t.employeeId}-${t.date}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: empColor(t.employeeId) || 'hsl(var(--primary))' }}
                  />
                  <User className="w-4 h-4" /> {empName(t.employeeId)}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {t.stops.length} Stopps · ~{Math.round(t.totalLegKm)} km
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {t.stops.map((s) => (
                <div key={s.appointment.id} className="flex items-start gap-2 text-xs border rounded-md p-2">
                  <Badge variant="outline" className="text-[10px] shrink-0">#{s.order}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.appointment.title}</div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />
                        {new Date(s.appointment.startAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {s.plz && (
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />PLZ {s.plz}</span>
                      )}
                      {s.legKm != null && s.order > 1 && (
                        <span>≈ {Math.round(s.legKm)} km Fahrt</span>
                      )}
                    </div>
                    {s.appointment.address && (
                      <div className="text-[10px] text-muted-foreground truncate">{s.appointment.address}</div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
