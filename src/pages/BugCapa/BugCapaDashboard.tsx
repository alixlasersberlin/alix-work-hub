import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bug, ClipboardCheck, FileSearch, ListChecks } from 'lucide-react';
import { KpiTile } from '@/components/infinity/KpiTile';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';

type Counts = { bugs_open: number; capas_open: number; findings_open: number; actions_open: number };

export default function BugCapaDashboard() {
  const [loading, setLoading] = useState(true);
  const [c, setC] = useState<Counts>({ bugs_open: 0, capas_open: 0, findings_open: 0, actions_open: 0 });

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [b, cp, af, ac] = await Promise.all([
        sb.from('bugs').select('id', { count: 'exact', head: true }).not('status', 'in', '(geschlossen,erledigt)'),
        sb.from('capas').select('id', { count: 'exact', head: true }).neq('status', 'geschlossen'),
        sb.from('audit_findings').select('id', { count: 'exact', head: true }).neq('status', 'geschlossen'),
        sb.from('capa_actions').select('id', { count: 'exact', head: true }).in('status', ['offen', 'in_bearbeitung']),
      ]);
      setC({
        bugs_open: b.count ?? 0,
        capas_open: cp.count ?? 0,
        findings_open: af.count ?? 0,
        actions_open: ac.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const tiles = [
    { label: 'Offene Bugs', value: c.bugs_open, icon: Bug, accent: 'rose' as const },
    { label: 'Offene CAPAs', value: c.capas_open, icon: ClipboardCheck, accent: 'gold' as const },
    { label: 'Offene Audit-Feststellungen', value: c.findings_open, icon: FileSearch, accent: 'sky' as const },
    { label: 'Offene Maßnahmen', value: c.actions_open, icon: ListChecks, accent: 'violet' as const },
  ];

  if (loading) return <SkeletonKpiGrid count={4} />;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {tiles.map(t => (
        <KpiTile key={t.label} label={t.label} value={t.value} icon={t.icon} accent={t.accent} />
      ))}
    </div>
  );
}
