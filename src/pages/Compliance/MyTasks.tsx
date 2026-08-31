import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComplianceTask, TASK_STATUS_CLASS, TASK_STATUS_LABEL } from '@/lib/compliance/tasks';

export default function ComplianceMyTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('alle');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const [{ data: t }, { data: p }] = await Promise.all([
        (supabase as any).from('compliance_tasks').select('*')
          .or(`assignee_id.eq.${user.id},co_assignee_ids.cs.{${user.id}}`)
          .order('task_no', { ascending: true }),
        (supabase as any).from('compliance_projects').select('id, code, name'),
      ]);
      setTasks((t as ComplianceTask[]) || []);
      const map: Record<string, string> = {};
      (p || []).forEach((x: any) => { map[x.id] = x.code; });
      setProjects(map);
      setLoading(false);
    })();
  }, [user?.id]);

  const filtered = useMemo(
    () => tasks.filter((t) =>
      (status === 'alle' || t.status === status) &&
      (!q || `${t.title} ${t.category ?? ''} ${(t.ref_codes || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))),
    [tasks, status, q],
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold">Meine Aufgaben</h1>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Input className="max-w-xs" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              {Object.entries(TASK_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Aufgaben ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="text-sm text-muted-foreground py-6 text-center">Lädt…</div>}
          {!loading && filtered.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">Keine Aufgaben gefunden.</div>
          )}
          {filtered.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground tabular-nums">#{t.task_no ?? '—'}</span>
                  <span className="text-[13px] font-medium truncate">{t.title}</span>
                  {t.mandatory && <Badge variant="outline" className="text-[10px]">Pflicht</Badge>}
                  {t.priority === 'critical' && <Badge variant="outline" className="bg-red-500/15 text-red-500 text-[10px]">CRITICAL</Badge>}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {projects[t.project_id] || '—'} · {t.category || 'Allgemein'} ·{' '}
                  {t.due_date ? `fällig ${new Date(t.due_date).toLocaleDateString('de-DE')}` : 'ohne Frist'} · {t.progress} %
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={TASK_STATUS_CLASS[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
                <Button size="sm" onClick={() => navigate(`/software-compliance/aufgaben/${t.id}`)}>Öffnen</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
