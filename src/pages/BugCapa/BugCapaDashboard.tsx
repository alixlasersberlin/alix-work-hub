import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bug, ClipboardCheck, FileSearch, ListChecks } from 'lucide-react';

type Counts = { bugs_open: number; capas_open: number; findings_open: number; actions_open: number };

export default function BugCapaDashboard() {
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
    })();
  }, []);

  const tiles = [
    { label: 'Offene Bugs', value: c.bugs_open, icon: Bug },
    { label: 'Offene CAPAs', value: c.capas_open, icon: ClipboardCheck },
    { label: 'Offene Audit-Feststellungen', value: c.findings_open, icon: FileSearch },
    { label: 'Offene Maßnahmen', value: c.actions_open, icon: ListChecks },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {tiles.map(t => (
        <Card key={t.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t.label}</CardTitle>
            <t.icon className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{t.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
