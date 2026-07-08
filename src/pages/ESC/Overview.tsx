import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, CalendarDays, CheckCircle2, Clock, Truck, GraduationCap, Wrench, AlertTriangle, Sparkles } from 'lucide-react';
import { useAppointments } from '@/hooks/esc/useAppointments';
import { useDepartments } from '@/hooks/esc/useDepartments';
import { isSameDay, addDays, isBefore } from 'date-fns';
import { AgendaView } from '@/components/esc/views/AgendaView';
import { EscTodayWidgets } from '@/components/esc/dashboard/EscTodayWidgets';
import { Link } from 'react-router-dom';

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[12px] font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="w-4 h-4 text-primary/70" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export default function EscOverview() {
  const { appointments } = useAppointments();
  const { departments } = useDepartments();
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const stats = useMemo(() => {
    const heute = appointments.filter((a) => isSameDay(new Date(a.startAt), today));
    const morgen = appointments.filter((a) => isSameDay(new Date(a.startAt), tomorrow));
    const offen = appointments.filter((a) => a.status === 'bestaetigung_offen' || a.status === 'angefragt');
    const anfragen = appointments.filter((a) => a.status === 'angefragt');
    const service = appointments.filter((a) => a.departmentId === 'service');
    const lieferung = appointments.filter((a) => a.departmentId === 'delivery');
    const schulung = appointments.filter((a) => ['training', 'nisv-virt', 'nisv-pres'].includes(a.departmentId));
    const nisv = appointments.filter((a) => a.departmentId === 'nisv-virt' || a.departmentId === 'nisv-pres');
    const ueberfaellig = appointments.filter((a) => isBefore(new Date(a.endAt), today) && a.status !== 'abgeschlossen' && a.status !== 'storniert');
    return { heute: heute.length, morgen: morgen.length, offen: offen.length, anfragen: anfragen.length, service: service.length, lieferung: lieferung.length, schulung: schulung.length, nisv: nisv.length, ueberfaellig: ueberfaellig.length };
  }, [appointments]);

  const upcoming = useMemo(
    () => appointments.filter((a) => new Date(a.startAt) >= today).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 8),
    [appointments],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Übersicht</h1>
        <Link to="/esc/kalender" className="text-[12px] text-primary hover:underline">Kalender öffnen →</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi icon={CalendarDays} label="Termine heute" value={stats.heute} />
        <Kpi icon={CalendarClock} label="Termine morgen" value={stats.morgen} />
        <Kpi icon={Clock} label="Offene Bestätigungen" value={stats.offen} />
        <Kpi icon={Sparkles} label="Neue Buchungsanfragen" value={stats.anfragen} />
        <Kpi icon={AlertTriangle} label="Überfällig" value={stats.ueberfaellig} />
        <Kpi icon={Wrench} label="Serviceeinsätze" value={stats.service} />
        <Kpi icon={Truck} label="Lieferungen" value={stats.lieferung} />
        <Kpi icon={GraduationCap} label="Schulungen" value={stats.schulung} />
        <Kpi icon={CheckCircle2} label="NiSV-Termine" value={stats.nisv} />
      </div>

      <div>
        <h2 className="text-[13px] font-semibold text-muted-foreground mb-2">Heute im Überblick</h2>
        <EscTodayWidgets appointments={appointments} />
      </div>

      <div>
        <h2 className="text-[13px] font-semibold text-muted-foreground mb-2">Nächste Termine</h2>
        <AgendaView appointments={upcoming} departments={departments} />
      </div>
    </div>
  );
}
