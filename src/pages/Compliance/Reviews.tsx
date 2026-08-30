import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logCompliance, useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ComplianceTask, ComplianceTaskStep } from '@/lib/compliance/tasks';

export default function ComplianceReviews() {
  const { user } = useAuth();
  const c = useComplianceProfile();
  const [tasks, setTasks] = useState<ComplianceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ComplianceTask | null>(null);
  const [steps, setSteps] = useState<ComplianceTaskStep[]>([]);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('compliance_tasks').select('*').eq('status', 'in_review').order('submitted_at', { ascending: true });
    setTasks((data as ComplianceTask[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (t: ComplianceTask) => {
    setActive(t); setComment('');
    const { data } = await (supabase as any)
      .from('compliance_task_steps').select('*').eq('task_id', t.id).order('step_no', { ascending: true });
    setSteps((data as ComplianceTaskStep[]) || []);
  };

  const decide = async (decision: 'approve' | 'changes' | 'reject') => {
    if (!active) return;
    if (decision !== 'approve' && !comment.trim()) { toast.error('Bitte einen Kommentar angeben.'); return; }
    const status = decision === 'approve' ? 'done' : 'rejected';
    await (supabase as any).from('compliance_tasks').update({
      status,
      reviewer_id: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      review_comment: comment || null,
      completed_at: decision === 'approve' ? new Date().toISOString() : null,
      progress: decision === 'approve' ? 100 : active.progress,
    }).eq('id', active.id);
    await logCompliance(`task_review_${decision}`, { comment }, { projectId: active.project_id, taskId: active.id });
    toast.success(decision === 'approve' ? 'Aufgabe freigegeben' : 'An Bearbeiter zurückgegeben');
    setActive(null);
    load();
  };

  if (!c.canReview) return <div className="text-sm text-muted-foreground">Für Reviews nicht berechtigt.</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-xl font-semibold">Meine Reviews</h1>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{tasks.length} Aufgaben warten auf Review</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <div className="py-6 text-center text-sm text-muted-foreground">Lädt…</div>}
          {!loading && tasks.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Keine offenen Reviews.</div>}
          {tasks.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div>
                <div className="text-[13px] font-medium">{t.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  Eingereicht: {t.submitted_at ? new Date(t.submitted_at).toLocaleString('de-DE') : '—'} · {t.category || 'Allgemein'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {t.priority === 'critical' && <Badge variant="outline" className="bg-red-500/15 text-red-500">CRITICAL</Badge>}
                <Button size="sm" onClick={() => open(t)}>REVIEW STARTEN</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[55vh] overflow-auto">
            {active?.purpose && <p className="text-[12px] text-muted-foreground">{active.purpose}</p>}
            {steps.map((s) => (
              <div key={s.id} className="rounded-md border border-border p-3">
                <div className="text-[12px] font-medium">Schritt {s.step_no} · {s.label}</div>
                <div className="text-[12px] mt-1 whitespace-pre-wrap">{s.value || '—'}</div>
                {s.file_url && <a href={s.file_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">Nachweis öffnen</a>}
              </div>
            ))}
            <div>
              <div className="text-[12px] mb-1">Kommentar (Pflicht bei Ablehnung)</div>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => decide('changes')}>REQUEST CHANGES</Button>
            <Button variant="destructive" onClick={() => decide('reject')}>REJECT</Button>
            <Button onClick={() => decide('approve')}>APPROVE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
