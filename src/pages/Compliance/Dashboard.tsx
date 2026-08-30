import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, PauseCircle, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ComplianceTask, TASK_STATUS_CLASS, TASK_STATUS_LABEL, mandatoryProgress, pickNextTask } from '@/lib/compliance/tasks';

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export default function ComplianceDashboard() {
  const { user } = useAuth();
  const c = useComplianceProfile();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: p }] = await Promise.all([
        (supabase as any).from('compliance_tasks').select('*').eq('assignee_id', user.id).order('task_no', { ascending: true }),
        (supabase as any).from('compliance_projects').select('id, code, name'),
      ]);
      setTasks((t as ComplianceTask[]) || []);
      const map: Record<string, string> = {};
      (p || []).forEach((x: any) => { map[x.id] = `${x.code} · ${x.name}`; });
      setProjects(map);
      setLoading(false);
    })();
  }, [user?.id]);

  const next = useMemo(() => pickNextTask(tasks), [tasks]);
  const stats = useMemo(() => ({
    open: tasks.filter((t) => ['ready', 'in_progress', 'rejected'].includes(t.status)).length,
    supplier: tasks.filter((t) => t.status === 'waiting_supplier').length,
    review: tasks.filter((t) => t.status === 'in_review').length,
    done: tasks.filter((t) => t.status === 'done').length,
    deferred: tasks.filter((t) => t.status === 'deferred').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
  }), [tasks]);
  const progress = useMemo(() => mandatoryProgress(tasks), [tasks]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold">
          {greeting()}, {c.profile?.full_name || c.profile?.email}
        </h1>
        <p className="text-[12px] text-muted-foreground">Ihre Aufgaben im Software-&amp;-Compliance-Workspace.</p>
      </div>

      <Card className="border-primary/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-[12px] uppercase tracking-wider text-muted-foreground">
            {next && next.status === 'in_progress' ? 'Sie haben hier aufgehört' : 'Ihre nächste erforderliche Aufgabe'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Lädt…</div>
          ) : !next ? (
            <div className="text-sm text-muted-foreground">Aktuell sind Ihnen keine offenen Aufgaben zugewiesen.</div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-lg font-semibold">{next.title}</div>
                <Badge variant="outline" className={TASK_STATUS_CLASS[next.status]}>{TASK_STATUS_LABEL[next.status]}</Badge>
                {next.priority === 'critical' && <Badge variant="outline" className="bg-red-500/15 text-red-500">CRITICAL</Badge>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                <div><div className="text-muted-foreground">Projekt</div><div>{projects[next.project_id] || '—'}</div></div>
                <div><div className="text-muted-foreground">Fällig</div><div>{next.due_date ? new Date(next.due_date).toLocaleDateString('de-DE') : '—'}</div></div>
                <div><div className="text-muted-foreground">Fortschritt</div><div>{next.progress} %</div></div>
                <div><div className="text-muted-foreground">Kategorie</div><div>{next.category || '—'}</div></div>
              </div>
              <Progress value={next.progress} className="h-1.5" />
              <div className="flex gap-2">
                <Button onClick={() => navigate(`/software-compliance/aufgaben/${next.id}`)}>
                  AUFGABE FORTSETZEN <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <Button variant="outline" asChild><Link to="/software-compliance/aufgaben">ZUR ÜBERSICHT</Link></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Clock, label: 'Offene Aufgaben', value: stats.open },
          { icon: Truck, label: 'Wartet auf Lieferant', value: stats.supplier },
          { icon: AlertTriangle, label: 'Zur Prüfung', value: stats.review },
          { icon: CheckCircle2, label: 'Abgeschlossen', value: stats.done },
        ].map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-1 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="w-4 h-4 text-primary/70" />
            </CardHeader>
            <CardContent><div className="text-2xl font-semibold">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ihr Fortschritt</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progress.pct} className="h-2" />
          <div className="text-[12px] text-muted-foreground">
            {progress.done} von {progress.total} Pflichtaufgaben abgeschlossen · {progress.pct} %
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[12px]">
            <div>{tasks.length} zugewiesen</div>
            <div>{stats.done} erledigt</div>
            <div>{stats.inProgress} in Bearbeitung</div>
            <div>{stats.supplier} warten extern</div>
            <div className="flex items-center gap-1"><PauseCircle className="w-3.5 h-3.5" />{stats.deferred} zurückgestellt</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
