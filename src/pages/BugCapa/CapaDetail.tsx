import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, CircleDot, Circle, Lock, FileDown, Sparkles, Paperclip, Trash2, Upload, History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CAPA_STEPS, evaluateCapa, progressPct, firstOpenStep, closureBlockers, trafficLight, labelize,
} from '@/lib/capa/steps';
import { logCapaChanges, logCapaEvent } from '@/lib/capa/audit';
import { Step1, Step2, Step3, Step4, Step5, Step6, Step7, Step8, Step9, Step10, Step11, Step12, Field } from './capa2/StepPanels';
import { buildCapaReport } from '@/lib/capa/report';
import { MagicCapaPanel } from './capa2/MagicCapaPanel';

export default function CapaDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, hasRole } = useAuth();
  const canApprove = hasRole('Super Admin') || hasRole('Admin') || hasRole('QM');

  const [capa, setCapa] = useState<any | null>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [closure, setClosure] = useState('');

  const actor = useMemo(() => ({
    id: user?.id,
    name: ((user as any)?.user_metadata?.full_name as string) || (user as any)?.email || 'Unbekannt',
  }), [user]);

  const load = useCallback(async () => {
    if (!id) return;
    const sb = supabase as any;
    const [c, a, t, att] = await Promise.all([
      sb.from('capas').select('*').eq('id', id).maybeSingle(),
      sb.from('capa_actions').select('*').eq('capa_id', id).order('created_at'),
      sb.from('capa_timeline').select('*').eq('capa_id', id).order('created_at', { ascending: false }).limit(300),
      sb.from('capa_attachments').select('*').eq('capa_id', id).order('created_at', { ascending: false }),
    ]);
    if (c.error || !c.data) { toast.error('CAPA nicht gefunden'); nav('/bug-capa/capa'); return; }
    setCapa(c.data); setActions(a.data ?? []); setTimeline(t.data ?? []); setAttachments(att.data ?? []);
    setClosure(c.data.closure_summary ?? '');
    setLoading(false);
  }, [id, nav]);

  useEffect(() => { load(); }, [load]);

  const checks = useMemo(() => (capa ? evaluateCapa(capa, actions) : []), [capa, actions]);
  const pct = progressPct(checks);
  const openStep = firstOpenStep(checks);

  useEffect(() => { if (capa) setStep(s => (s === 1 && capa.current_step ? capa.current_step : s)); }, [capa?.id]);

  const save = useCallback(async (patch: Record<string, any>, stepNo: number, note?: string) => {
    if (!capa) return;
    const { error } = await (supabase as any).from('capas').update({ ...patch, current_step: Math.max(capa.current_step ?? 1, stepNo), updated_by: user?.id ?? null }).eq('id', capa.id);
    if (error) { toast.error('Speichern fehlgeschlagen: ' + error.message); return; }
    await logCapaChanges(capa.id, stepNo, capa, patch, actor);
    if (note) await logCapaEvent({ capaId: capa.id, stepNo, eventType: 'schritt', note }, actor);
    toast.success('Gespeichert');
    load();
  }, [capa, user, actor, load]);

  async function markStep(stepNo: number, done: boolean) {
    if (!capa) return;
    await (supabase as any).from('capa_step_state').upsert({
      capa_id: capa.id, step_no: stepNo, status: done ? 'abgeschlossen' : 'offen',
      completed_by: done ? user?.id ?? null : null, completed_at: done ? new Date().toISOString() : null,
    }, { onConflict: 'capa_id,step_no' });
    await logCapaEvent({ capaId: capa.id, stepNo, eventType: done ? 'schritt_abgeschlossen' : 'schritt_wieder_geoeffnet' }, actor);
    load();
  }

  async function uploadFile(file: File) {
    if (!capa) return;
    const path = `${capa.id}/${step}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await supabase.storage.from('capa-evidence').upload(path, file);
    if (error) { toast.error('Upload fehlgeschlagen: ' + error.message); return; }
    await (supabase as any).from('capa_attachments').insert({
      capa_id: capa.id, step_no: step, file_path: path, file_name: file.name,
      mime_type: file.type, size_bytes: file.size, uploaded_by: user?.id ?? null,
    });
    await logCapaEvent({ capaId: capa.id, stepNo: step, eventType: 'nachweis_hochgeladen', newValue: file.name }, actor);
    toast.success('Nachweis hochgeladen');
    load();
  }

  async function openAttachment(a: any) {
    const { data, error } = await supabase.storage.from('capa-evidence').createSignedUrl(a.file_path, 300);
    if (error || !data) { toast.error('Download fehlgeschlagen'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function createFollowUp() {
    if (!capa) return;
    const { data, error } = await (supabase as any).from('capas').insert({
      title: `Folge-CAPA zu ${capa.capa_number ?? capa.title}`,
      trigger_type: capa.trigger_type, product_name: capa.product_name, description: `Folge-CAPA wegen nicht wirksamer Maßnahmen aus ${capa.capa_number ?? ''}.`,
      responsible_id: user?.id ?? null, created_by: user?.id ?? null, capa_required: true,
    }).select('id, capa_number').single();
    if (error) { toast.error('Folge-CAPA fehlgeschlagen: ' + error.message); return; }
    await logCapaEvent({ capaId: capa.id, stepNo: 12, eventType: 'folge_capa', newValue: data.capa_number }, actor);
    toast.success(`Folge-CAPA ${data.capa_number ?? ''} erstellt`);
    nav(`/bug-capa/capa/${data.id}`);
  }

  async function closeCapa() {
    if (!capa) return;
    const blockers = closureBlockers({ ...capa, closure_summary: closure }, checks);
    if (!canApprove) { toast.error('QMB-/Admin-Freigabe erforderlich'); return; }
    if (blockers.length) { toast.error(`Abschluss nicht möglich: ${blockers[0]}`); return; }
    await save({
      status: 'geschlossen', closure_summary: closure, closed_at: new Date().toISOString(),
      closure_approved_by: user?.id ?? null, closure_approved_at: new Date().toISOString(),
    }, 12, `CAPA abgeschlossen und freigegeben durch ${actor.name}`);
  }

  if (loading || !capa) return <div className="p-6 text-sm text-muted-foreground">Lade CAPA …</div>;

  const light = trafficLight(capa);
  const lightClass = light === 'rot' ? 'bg-destructive' : light === 'gelb' ? 'bg-amber-500' : 'bg-emerald-500';
  const currentCheck = checks[step - 1];
  const noCapa = capa.capa_required === false;

  const StepBody = () => {
    switch (step) {
      case 1: return <Step1 capa={capa} save={save} />;
      case 2: return <Step2 capa={capa} save={save} />;
      case 3: return <Step3 capa={capa} save={save} canApprove={canApprove} userId={user?.id} />;
      case 4: return <Step4 capa={capa} save={save} />;
      case 5: return <Step5 capa={capa} save={save} />;
      case 6: return <Step6 capa={capa} save={save} />;
      case 7: return <Step7 capa={capa} save={save} canApprove={canApprove} userId={user?.id} />;
      case 8: return <Step8 capa={capa} save={save} />;
      case 9: return <Step9 capa={capa} save={save} />;
      case 10: return <Step10 capa={capa} actions={actions} reload={load} userId={user?.id} />;
      case 11: return <Step11 capa={capa} save={save} canApprove={canApprove} userId={user?.id} />;
      case 12: return <Step12 capa={capa} save={save} onFollowUp={createFollowUp} />;
      default: return null;
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={() => nav('/bug-capa/capa')}><ArrowLeft className="h-4 w-4 mr-1" />Zurück</Button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn('h-3 w-3 rounded-full', lightClass)} />
            <h2 className="text-2xl font-bold">{capa.capa_number ?? 'CAPA'}</h2>
            <Badge variant="outline">{labelize(capa.status)}</Badge>
            <Badge variant="secondary">Risiko: {labelize(capa.risk_level)}</Badge>
            <Badge variant="secondary">Priorität: {labelize(capa.priority)}</Badge>
            {noCapa && <Badge variant="destructive">NO-CAPA-DECISION</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{capa.title}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => buildCapaReport(capa, actions, timeline, attachments)}>
            <FileDown className="h-4 w-4 mr-1" />CAPA-Bericht (PDF)
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex-1 min-w-[220px]">
            <Progress value={pct} className="h-3" />
          </div>
          <span className="font-semibold">{pct} %</span>
          <span className="text-muted-foreground">Aktuell: {openStep}. {CAPA_STEPS[openStep - 1].title}</span>
          {openStep < 12 && <span className="text-muted-foreground">Nächster Schritt: {openStep + 1}. {CAPA_STEPS[openStep].title}</span>}
          {capa.due_date && <span className="text-muted-foreground">Frist: {capa.due_date}</span>}
          {capa.vigilance_deadline_date && <span className="text-destructive">Meldefrist: {capa.vigilance_deadline_date}</span>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Vertikale 12-Schritte-Timeline (mobil scrollbar) */}
        <nav className="rounded-lg border border-border p-2 lg:sticky lg:top-4 lg:self-start">
          <ol className="flex lg:block gap-2 overflow-x-auto lg:overflow-visible">
            {CAPA_STEPS.map(s => {
              const c = checks[s.no - 1];
              const active = step === s.no;
              const Icon = c?.skipped ? Lock : c?.complete ? Check : s.no === openStep ? CircleDot : Circle;
              return (
                <li key={s.no} className="shrink-0 lg:shrink">
                  <button
                    onClick={() => setStep(s.no)}
                    className={cn(
                      'w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm min-h-[44px] transition-colors',
                      active ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', c?.complete && 'text-emerald-500', c?.skipped && 'opacity-50')} />
                    <span className="font-mono text-xs w-5">{s.no}</span>
                    <span className="truncate">{s.short}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          <Tabs defaultValue="schritt">
            <TabsList>
              <TabsTrigger value="schritt">Schritt</TabsTrigger>
              <TabsTrigger value="magic"><Sparkles className="h-4 w-4 mr-1" />Magic CAPA</TabsTrigger>
              <TabsTrigger value="nachweise"><Paperclip className="h-4 w-4 mr-1" />Nachweise</TabsTrigger>
              <TabsTrigger value="timeline"><History className="h-4 w-4 mr-1" />Timeline</TabsTrigger>
              <TabsTrigger value="abschluss">Abschluss</TabsTrigger>
            </TabsList>

            <TabsContent value="schritt" className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <h3 className="text-lg font-semibold">{step}. {CAPA_STEPS[step - 1].title}</h3>
                  {currentCheck?.skipped
                    ? <Badge variant="outline">Bei No-CAPA-Decision nicht erforderlich</Badge>
                    : currentCheck?.complete
                      ? <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">Vollständig</Badge>
                      : <Badge variant="destructive">{currentCheck?.missing.length} offene Pflichtangaben</Badge>}
                </div>
                {!currentCheck?.complete && !currentCheck?.skipped && currentCheck?.missing.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                    {currentCheck.missing.slice(0, 8).map(m => <li key={m}>{m}</li>)}
                  </ul>
                )}
                <StepBody />
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={step === 1} onClick={() => setStep(step - 1)}>Zurück</Button>
                  <Button variant="outline" size="sm" disabled={step === 12} onClick={() => setStep(step + 1)}>Weiter</Button>
                  <Button variant="ghost" size="sm" onClick={() => markStep(step, true)}>Schritt als erledigt markieren</Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="magic">
              <MagicCapaPanel capa={capa} actions={actions} checks={checks} />
            </TabsContent>

            <TabsContent value="nachweise" className="space-y-3">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span>Nachweis zu Schritt {step} hochladen</span>
                  <input type="file" className="hidden" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                </label>
                {attachments.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Nachweise.</p>}
                {attachments.map(a => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border/60 py-2 text-sm">
                    <Badge variant="outline">Schritt {a.step_no ?? '—'}</Badge>
                    <button className="underline underline-offset-2 truncate max-w-[320px]" onClick={() => openAttachment(a)}>{a.file_name}</button>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('de-DE')}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="timeline">
              <div className="rounded-lg border border-border p-4 space-y-2 max-h-[560px] overflow-auto">
                {timeline.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Ereignisse.</p>}
                {timeline.map(t => (
                  <div key={t.id} className="border-l-2 border-border pl-3 py-1.5 text-sm">
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString('de-DE')} · {t.actor_name ?? 'System'} {t.step_no ? `· Schritt ${t.step_no}` : ''}
                    </div>
                    <div className="font-medium">{labelize(t.event_type)}{t.field_name ? `: ${t.field_name}` : ''}</div>
                    {t.note && <div className="text-muted-foreground">{t.note}</div>}
                    {(t.old_value || t.new_value) && (
                      <div className="text-xs text-muted-foreground break-words">
                        <span className="line-through opacity-70">{t.old_value ?? '—'}</span> → <span>{t.new_value ?? '—'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="abschluss">
              <div className="rounded-lg border border-border p-4 space-y-4">
                <Field label="Abschlussbewertung *">
                  <Textarea rows={5} value={closure} onChange={e => setClosure(e.target.value)} />
                </Field>
                {(() => {
                  const blockers = closureBlockers({ ...capa, closure_summary: closure }, checks);
                  return blockers.length ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                      <div className="font-medium mb-1">Abschluss blockiert:</div>
                      <ul className="list-disc pl-5 space-y-0.5">{blockers.map(b => <li key={b}>{b}</li>)}</ul>
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">Alle Pflichtschritte erfüllt.</div>
                  );
                })()}
                {capa.closure_approved_at ? (
                  <Badge variant="outline">Abgeschlossen am {new Date(capa.closure_approved_at).toLocaleString('de-DE')}</Badge>
                ) : (
                  <Button onClick={closeCapa} disabled={!canApprove}>CAPA abschließen (QMB-Freigabe)</Button>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
