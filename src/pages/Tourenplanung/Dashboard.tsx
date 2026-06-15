import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, Truck, Clock, AlertTriangle, Users, XCircle, Timer } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';

export default function TourenDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: 0, open: 0, overdue: 0, failed: 0, technicians: 0, avgMinutes: 0,
  });

  useEffect(() => {
    (async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [{ count: todayCount }, { count: openCount }, { count: overdueCount }, { count: failedCount }, { data: techs }, { data: completed }] = await Promise.all([
        supabase.from('route_plans').select('id', { count: 'exact', head: true }).eq('planned_date', today),
        supabase.from('route_plans').select('id', { count: 'exact', head: true }).in('planning_status', ['Entwurf','Geplant','Bestätigt','offen','geplant']),
        supabase.from('route_plans').select('id', { count: 'exact', head: true }).lt('planned_date', today).not('planning_status', 'in', '("Erledigt","Storniert","erledigt","abgesagt","storniert")'),
        supabase.from('route_plans').select('id', { count: 'exact', head: true }).eq('planning_status', 'Fehlgeschlagen'),
        supabase.from('route_plans').select('assigned_employee').not('assigned_employee', 'is', null),
        supabase.from('route_plans').select('work_started_at, work_ended_at').not('work_started_at', 'is', null).not('work_ended_at', 'is', null).limit(200),
      ]);
      const techSet = new Set((techs ?? []).map((t: any) => t.assigned_employee));
      const durations = (completed ?? []).map((r: any) =>
        (new Date(r.work_ended_at).getTime() - new Date(r.work_started_at).getTime()) / 60000
      ).filter((m: number) => m > 0 && m < 24 * 60);
      const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
      setStats({
        today: todayCount ?? 0,
        open: openCount ?? 0,
        overdue: overdueCount ?? 0,
        failed: failedCount ?? 0,
        technicians: techSet.size,
        avgMinutes: avg,
      });
      setLoading(false);
    })();
  }, []);

  const kpis = [
    { label: 'Heutige Touren', value: stats.today, icon: Truck, accent: 'sky' as const },
    { label: 'Offene Touren', value: stats.open, icon: Clock, accent: 'gold' as const },
    { label: 'Überfällige Einsätze', value: stats.overdue, icon: AlertTriangle, accent: 'rose' as const },
    { label: 'Aktive Techniker', value: stats.technicians, icon: Users, accent: 'emerald' as const },
    { label: 'Fehlgeschlagene Einsätze', value: stats.failed, icon: XCircle, accent: 'rose' as const },
    { label: 'Ø Einsatzdauer (Min.)', value: stats.avgMinutes, icon: Timer, accent: 'violet' as const },
  ];

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        title="Touren-Dashboard"
        subtitle="Übersicht über Tagespläne, Auslastung und Einsatzqualität"
        icon={LayoutDashboard}
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : 'Live'} pulse={!loading} dotOnly />}
      />
      {loading ? (
        <SkeletonKpiGrid count={6} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map(k => (
            <KpiTile key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />
          ))}
        </div>
      )}
    </div>
  );
}
