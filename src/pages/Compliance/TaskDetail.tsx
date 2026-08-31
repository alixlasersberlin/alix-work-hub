import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, Loader2, PauseCircle, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logCompliance, useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ComplianceTask, ComplianceTaskStep, DEFER_REASONS, TASK_STATUS_CLASS, TASK_STATUS_LABEL,
} from '@/lib/compliance/tasks';
import AiAssistField from '@/components/compliance/AiAssistField';

export default function ComplianceTaskDetail() {
  const { taskId } = useParams();
  const { user } = useAuth();
  const c = useComplianceProfile();
  const navigate = useNavigate();

  const [task, setTask] = useState<ComplianceTask | null>(null);
  const [steps, setSteps] = useState<ComplianceTaskStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [guided, setGuided] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [deferOpen, setDeferOpen] = useState(false);
  const [deferReason, setDeferReason] = useState(DEFER_REASONS[0]);
  const [deferComment, setDeferComment] = useState('');
  const [deferUntil, setDeferUntil] = useState('');
  const dirty = useRef(false);

  const readOnly = c.isReadOnly || task?.status === 'done' || task?.status === 'in_review';

  const load = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    const { data: t } = await (supabase as any).from('compliance_tasks').select('*').eq('id', taskId).maybeSingle();
    const { data: s } = await (supabase as any)
      .from('compliance_task_steps').select('*').eq('task_id', taskId).order('step_no', { ascending: true });
    setTask((t as ComplianceTask) || null);
    setSteps((s as ComplianceTaskStep[]) || []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const totalSteps = steps.length;
  const doneSteps = steps.filter((s) => s.done || (s.value && s.value.trim())).length;
  const pct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : task?.progress ?? 0;

  const persist = useCallback(async (silent = true): Promise<boolean> => {
    if (!task || readOnly) return false;
    setSaving(true);
    const updates = steps.map((s) => ({
      id: s.id,
      value: s.value,
      file_url: s.file_url,
      done: !!(s.value && s.value.trim()) || s.done,
    }));
    try {
      for (const u of updates) {
        const { data, error } = await (supabase as any)
          .from('compliance_task_steps')
          .update({ value: u.value, file_url: u.file_url, done: u.done })
          .eq('id', u.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Keine Berechtigung zum Speichern dieser Aufgabe.');
      }
      const { data: td, error: te } = await (supabase as any).from('compliance_tasks').update({
        progress: pct,
        status: task.status === 'ready' || task.status === 'rejected' ? 'in_progress' : task.status,
        last_saved_at: new Date().toISOString(),
      }).eq('id', task.id).select('id');
      if (te) throw te;
      if (!td || td.length === 0) throw new Error('Keine Berechtigung zum Speichern dieser Aufgabe.');
    } catch (e: any) {
      setSaving(false);
      toast.error(`Speichern fehlgeschlagen: ${e?.message || 'Unbekannter Fehler'}`);
      return false;
    }
    setSaving(false);
    setSavedAt(new Date());
    dirty.current = false;
    if (!silent) toast.success('Zwischengespeichert');
    await logCompliance('task_saved', { progress: pct }, { projectId: task.project_id, taskId: task.id });
    return true;
  }, [task, steps, pct, readOnly]);

  // Autosave nach Feldänderung / Schrittwechsel
  useEffect(() => {
    if (!dirty.current) return;
    const id = setTimeout(() => { persist(true); }, 1200);
    return () => clearTimeout(id);
  }, [steps, cursor, persist]);

  const setStepValue = (id: string, value: string) => {
    dirty.current = true;
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, value } : s)));
  };
  const setStepFile = (id: string, url: string) => {
    dirty.current = true;
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, file_url: url } : s)));
  };

  const submit = async () => {
    if (!task) return;
    const missing = steps.filter((s) => s.required && !(s.value && s.value.trim()) && !s.file_url);
    if (missing.length) {
      toast.error(`Bitte alle Pflichtangaben ausfüllen (${missing.length} offen).`);
      return;
    }
    const ok = await persist(true);
    if (!ok) return;
    const { data, error } = await (supabase as any).from('compliance_tasks').update({
      status: 'in_review', submitted_at: new Date().toISOString(), progress: 100,
    }).eq('id', task.id).select('id');
    if (error || !data || data.length === 0) {
      toast.error(`Einreichen fehlgeschlagen: ${error?.message || 'Keine Berechtigung.'}`);
      return;
    }
    await logCompliance('task_submitted', {}, { projectId: task.project_id, taskId: task.id });
    toast.success('Aufgabe zur Prüfung eingereicht');
    navigate('/software-compliance/aufgaben');
  };


  const defer = async () => {
    if (!task) return;
    if (!deferComment.trim()) { toast.error('Bitte einen Kommentar angeben.'); return; }
    await (supabase as any).from('compliance_tasks').update({
      status: 'deferred',
      defer_reason: deferReason,
      defer_comment: deferComment,
      defer_until: deferUntil || null,
    }).eq('id', task.id);
    await logCompliance('task_deferred', { reason: deferReason }, { projectId: task.project_id, taskId: task.id });
    setDeferOpen(false);
    toast.success('Aufgabe zurückgestellt – sie bleibt offen.');
    navigate('/software-compliance/aufgaben');
  };

  const current = steps[cursor];
  const stepList = useMemo(() => (guided && current ? [current] : steps), [guided, current, steps]);

  if (loading) return <div className="text-sm text-muted-foreground">Lädt…</div>;
  if (!task) return <div className="text-sm text-muted-foreground">Aufgabe nicht gefunden oder kein Zugriff.</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/software-compliance/aufgaben')}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
      </Button>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{task.title}</CardTitle>
            <Badge variant="outline" className={TASK_STATUS_CLASS[task.status]}>{TASK_STATUS_LABEL[task.status]}</Badge>
          </div>
          {task.task_no != null && (
            <div className="text-[11px] text-muted-foreground">AUFGABE {task.task_no}</div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {task.purpose && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Warum ist diese Aufgabe notwendig?</div>
              <p className="text-[13px] mt-1">{task.purpose}</p>
            </div>
          )}
          <div className="space-y-1">
            <Progress value={pct} className="h-2" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{doneSteps} von {totalSteps} Schritten · {pct} %</span>
              <span>
                {savedAt ? `Gespeichert um ${savedAt.toLocaleTimeString('de-DE')}` : task.last_saved_at ? `Zuletzt gespeichert: ${new Date(task.last_saved_at).toLocaleString('de-DE')}` : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            Compliance Details
          </button>
          {showDetails && (
            <div className="rounded-md bg-muted/40 p-3 text-[11px] font-mono space-y-1">
              <div>Kategorie: {task.category || '—'}</div>
              <div>Referenzen: {(task.ref_codes || []).join(', ') || '—'}</div>
              <div>Pflichtaufgabe: {task.mandatory ? 'ja' : 'nein'}</div>
              {task.review_comment && <div>Review: {task.review_comment}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch id="guided" checked={guided} onCheckedChange={(v) => { setGuided(v); setCursor(0); }} />
          <Label htmlFor="guided" className="text-[12px]">Geführter Modus</Label>
        </div>
        {guided && totalSteps > 0 && (
          <div className="text-[12px] text-muted-foreground">Schritt {cursor + 1} von {totalSteps}</div>
        )}
      </div>

      {stepList.map((s) => (
        <Card key={s.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-[13px]">
              SCHRITT {s.step_no} · {s.label} {s.required && <span className="text-destructive">*</span>}
            </CardTitle>
            {s.hint && <div className="text-[11px] text-muted-foreground">{s.hint}</div>}
          </CardHeader>
          <CardContent className="space-y-2">
            {s.input_type === 'file' ? (
              <>
                <Input
                  placeholder="Link zum Nachweis (URL)"
                  value={s.file_url || ''}
                  disabled={readOnly}
                  onChange={(e) => setStepFile(s.id, e.target.value)}
                />
                <Textarea
                  rows={3}
                  placeholder="Beschreibung / Kommentar zum Nachweis"
                  value={s.value || ''}
                  disabled={readOnly}
                  onChange={(e) => setStepValue(s.id, e.target.value)}
                />
              </>
            ) : s.input_type === 'number' ? (
              <Input
                type="number"
                value={s.value || ''}
                disabled={readOnly}
                onChange={(e) => setStepValue(s.id, e.target.value)}
              />
            ) : (
              <Textarea
                rows={4}
                value={s.value || ''}
                disabled={readOnly}
                onChange={(e) => setStepValue(s.id, e.target.value)}
              />
            )}
            {s.input_type !== 'number' && (
              <AiAssistField
                value={s.value || ''}
                onChange={(v) => setStepValue(s.id, v)}
                taskId={task.id}
                stepId={s.id}
                hint={`${s.label}${s.hint ? ` – ${s.hint}` : ''}`}
                disabled={readOnly}
              />
            )}
          </CardContent>
        </Card>
      ))}

      {totalSteps === 0 && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Für diese Aufgabe wurden noch keine Schritte definiert.</CardContent></Card>
      )}

      {guided && totalSteps > 1 && (
        <div className="flex justify-between">
          <Button variant="outline" disabled={cursor === 0} onClick={() => setCursor((i) => i - 1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zurück
          </Button>
          <Button variant="outline" disabled={cursor >= totalSteps - 1} onClick={() => setCursor((i) => i + 1)}>
            Weiter <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => persist(false)} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} ZWISCHENSPEICHERN
          </Button>
          <Button variant="outline" onClick={() => setDeferOpen(true)}>
            <PauseCircle className="w-4 h-4 mr-1" /> ZURÜCKSTELLEN
          </Button>
          <Button onClick={submit}><Send className="w-4 h-4 mr-1" /> ZUR PRÜFUNG EINREICHEN</Button>
        </div>
      )}

      <Dialog open={deferOpen} onOpenChange={setDeferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Warum kann diese Aufgabe aktuell nicht abgeschlossen werden?</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Grund</Label>
              <Select value={deferReason} onValueChange={setDeferReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEFER_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kommentar (Pflicht)</Label>
              <Textarea rows={3} value={deferComment} onChange={(e) => setDeferComment(e.target.value)} />
              <AiAssistField
                value={deferComment}
                onChange={setDeferComment}
                taskId={task.id}
                hint={`Begründung für die Zurückstellung. Grund: ${deferReason}`}
                modes={['draft', 'improve', 'shorten']}
              />
            </div>
            <div>
              <Label>Wiedervorlage (optional)</Label>
              <Input type="date" value={deferUntil} onChange={(e) => setDeferUntil(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeferOpen(false)}>Abbrechen</Button>
            <Button onClick={defer}>Zurückstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
