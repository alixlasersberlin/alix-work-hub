import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Wrench, Truck, GraduationCap, MailPlus, CheckCircle2, AlertTriangle, FileWarning } from 'lucide-react';
import type { EscAppointment } from '@/lib/esc/types';
import { computeKpis } from '@/lib/esc/kpi/calculations';

interface Props { appointments: EscAppointment[]; }

export function EscTodayWidgets({ appointments }: Props) {
  const today = new Date();
  const isSameDay = (d: Date) =>
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const todays = appointments.filter((a) => isSameDay(new Date(a.startAt)));
  const kindCount = (needle: string) => todays.filter((a) => (a.kind || '').toLowerCase().includes(needle)).length;

  const kpis = computeKpis(appointments, today);
  const newBookings = appointments.filter((a) => (a as any).source === 'portal').length;
  const pendingConfirms = appointments.filter((a) => a.confirmationRequired && a.status !== 'bestaetigt').length;
  const overdueTasks = 0;
  const openReports = todays.filter((a) => (a.kind || '').toLowerCase().includes('service') && a.status !== 'abgeschlossen').length;

  const items = [
    { label: 'Sales heute', value: kindCount('sales'), icon: Calendar },
    { label: 'Service heute', value: kindCount('service'), icon: Wrench },
    { label: 'Lieferung heute', value: kindCount('lieferung'), icon: Truck },
    { label: 'Schulungen heute', value: kindCount('schulung'), icon: GraduationCap },
    { label: 'Neue Buchungen', value: newBookings, icon: MailPlus },
    { label: 'Bestätigungen offen', value: pendingConfirms, icon: CheckCircle2 },
    { label: 'Überfällige Aufgaben', value: overdueTasks, icon: AlertTriangle },
    { label: 'Offene Serviceberichte', value: openReports, icon: FileWarning },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((i) => (
        <Card key={i.label} className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{i.label}</CardTitle>
            <i.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-semibold">{i.value}</div></CardContent>
        </Card>
      ))}
      <Card className="col-span-2 md:col-span-4 border-border/60">
        <CardHeader className="pb-1"><CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">Auslastung & Kennzahlen</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <Kpi label="Ø Dauer" value={`${kpis.averageDurationMinutes} min`} />
            <Kpi label="Service-Quote" value={`${Math.round(kpis.serviceRate * 100)} %`} />
            <Kpi label="Absagen" value={`${Math.round(kpis.cancellationRate * 100)} %`} />
            <Kpi label="Auslastung" value={`${Math.round(kpis.utilization * 100)} %`} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
