import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { computeCapacity } from '@/lib/esc/ai/engine';
import { getSettings } from '@/lib/esc/ai/store';
import { cn } from '@/lib/utils';

export default function AiCapacity() {
  const { appointments } = useAppointments();
  const rows = useMemo(() => computeCapacity(appointments), [appointments]);
  const settings = getSettings();

  const color = (pct: number) => pct >= settings.utilizationCriticalAt
    ? 'bg-red-500'
    : pct >= settings.utilizationWarnAt ? 'bg-amber-500' : 'bg-emerald-500';

  const grouped: Record<string, typeof rows> = { employee: [], vehicle: [], room: [], device: [] };
  rows.forEach((r) => grouped[r.kind].push(r));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Kapazitätsanalyse</h1>
        <span className="text-[11px] text-muted-foreground ml-2">Ampelsystem: grün &lt; {settings.utilizationWarnAt}% · gelb &lt; {settings.utilizationCriticalAt}% · rot ab {settings.utilizationCriticalAt}%</span>
      </div>

      {(['employee', 'vehicle', 'room', 'device'] as const).map((k) => (
        <Card key={k}>
          <CardHeader className="pb-2"><CardTitle className="text-sm capitalize">{k === 'employee' ? 'Mitarbeiter' : k === 'vehicle' ? 'Fahrzeuge' : k === 'room' ? 'Räume' : 'Geräte'}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {grouped[k].map((r) => (
              <div key={r.id} className="space-y-1">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span>{r.name}</span>
                  <span className="font-mono text-muted-foreground">{r.utilizationPct}% · {Math.round(r.bookedMinutes)}/{r.capacityMinutes} Min</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full', color(r.utilizationPct))} style={{ width: `${Math.min(100, r.utilizationPct)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
