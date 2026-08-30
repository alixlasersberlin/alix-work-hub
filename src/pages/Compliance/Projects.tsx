import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ComplianceTask, mandatoryProgress } from '@/lib/compliance/tasks';

interface Project { id: string; code: string; name: string; description: string | null; status: string; safety_class: string | null }

export default function ComplianceProjects() {
  const c = useComplianceProfile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: t }] = await Promise.all([
        (supabase as any).from('compliance_projects').select('*').order('code'),
        (supabase as any).from('compliance_tasks').select('*'),
      ]);
      setProjects((p as Project[]) || []);
      setTasks((t as ComplianceTask[]) || []);
      setLoading(false);
    })();
  }, []);

  const byProject = useMemo(() => {
    const map: Record<string, ComplianceTask[]> = {};
    tasks.forEach((t) => { (map[t.project_id] ||= []).push(t); });
    return map;
  }, [tasks]);

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold">Projekte</h1>
      {loading && <div className="text-sm text-muted-foreground">Lädt…</div>}
      {!loading && projects.length === 0 && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Ihnen ist derzeit kein Projekt zugeordnet.</CardContent></Card>
      )}
      {projects.map((p) => {
        const list = byProject[p.id] || [];
        const prog = mandatoryProgress(list);
        const blockers = list.filter((t) => t.priority === 'critical' && t.status !== 'done').length;
        const overdue = list.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
        return (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-[15px]">{p.code} · {p.name}</CardTitle>
                <Badge variant="outline">{p.status}</Badge>
                {p.safety_class && <Badge variant="outline">Safety Class {p.safety_class}</Badge>}
              </div>
              {p.description && <div className="text-[12px] text-muted-foreground">{p.description}</div>}
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={prog.pct} className="h-2" />
              <div className="text-[12px] text-muted-foreground">
                {prog.done} / {prog.total} Pflichtaufgaben abgeschlossen · {prog.pct} %
              </div>
              {c.isLead && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[12px]">
                  <div><span className="text-muted-foreground">Aufgaben: </span>{list.length}</div>
                  <div><span className="text-muted-foreground">Zur Prüfung: </span>{list.filter((t) => t.status === 'in_review').length}</div>
                  <div><span className="text-muted-foreground">Zurückgestellt: </span>{list.filter((t) => t.status === 'deferred').length}</div>
                  <div><span className="text-muted-foreground">Blocker: </span>{blockers}</div>
                  <div><span className="text-muted-foreground">Überfällig: </span>{overdue}</div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
