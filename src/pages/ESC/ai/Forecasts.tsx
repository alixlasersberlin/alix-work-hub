import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Info } from 'lucide-react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { computeForecast } from '@/lib/esc/ai/engine';
import { getSettings } from '@/lib/esc/ai/store';

export default function AiForecasts() {
  const { appointments } = useAppointments();
  const settings = getSettings();
  const points = useMemo(() => computeForecast(appointments, settings.forecastHorizonDays), [appointments, settings.forecastHorizonDays]);
  const max = Math.max(1, ...points.map((p) => p.expected));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <LineChart className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">Prognosen</h1>
      </div>
      <div className="text-[12px] text-muted-foreground flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5" />
        Schätzungen auf Basis historischer Termindichte pro Wochentag – keine automatische Planung.
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Erwartete Termine · nächste {settings.forecastHorizonDays} Tage</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 md:grid-cols-14 gap-1 items-end h-40">
            {points.map((p) => (
              <div key={p.date} className="flex flex-col items-center gap-1" title={`${p.date}: ~${p.expected}`}>
                <div className="w-full bg-primary/60 rounded-sm" style={{ height: `${(p.expected / max) * 100}%`, minHeight: 2 }} />
                <div className="text-[9px] text-muted-foreground rotate-45 origin-left w-6">{p.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
