import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import SignaturePad from '@/components/finance/SignaturePad';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Lock, ShieldCheck, History, AlertTriangle, CheckCircle2, Unlock, FileDown, Archive, Mail } from 'lucide-react';
import { STAGES, STATUS_UI, OVERALL_UI, type ApprovalStage } from '@/lib/delivery-approval/config';
import {
  ensureApproval, fetchEvents, saveChecks, approveStage, unlockApproval,
  stageChecks, stageStatus, isStageUnlocked, missingRequiredChecks, missingStages, slaLevel,
  type DeliveryApproval, type ApprovalEvent,
} from '@/lib/delivery-approval/api';
import { downloadDeliveryApprovalPdf } from '@/lib/delivery-approval/protokoll-pdf';
import { archiveApprovalPdf, mailApprovalPdf } from '@/lib/delivery-approval/archive';
import { autoFinalizeRelease } from '@/lib/delivery-approval/autofinalize';

import { supabase } from '@/integrations/supabase/client';

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function StageCard({
  stage, approval, reload, orderNumber,
}: {
  stage: ApprovalStage;
  approval: DeliveryApproval;
  reload: () => void;
  orderNumber?: string | null;
}) {
  const def = STAGES.find((s) => s.stage === stage)!;
  const { user, profile, hasAnyRole } = useAuth();
  const status = stageStatus(approval, stage);
  const unlocked = isStageUnlocked(approval, stage);
  const mayApprove = hasAnyRole(def.roles);

  const [checks, setChecks] = useState<Record<string, boolean>>(stageChecks(approval, stage));
  const [comment, setComment] = useState<string>((approval as any)[`${stage}_comment`] ?? '');
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChecks(stageChecks(approval, stage));
    setComment((approval as any)[`${stage}_comment`] ?? '');
  }, [approval, stage]);

  const missing = missingRequiredChecks(stage, checks);
  const done = def.checks.filter((c) => checks[c.key]).length;
  const ui = STATUS_UI[status];
  const sla = status === 'approved' ? 'ok' : slaLevel(approval.created_at);

  const groups = useMemo(() => {
    const map = new Map<string, typeof def.checks>();
    for (const c of def.checks) {
      const g = c.group ?? 'Prüfpunkte';
      if (!map.has(g)) map.set(g, [] as any);
      (map.get(g) as any).push(c);
    }
    return Array.from(map.entries());
  }, [def]);

  const userName = profile?.full_name || user?.email || 'Unbekannt';

  const onSave = async () => {
    setBusy(true);
    try { await saveChecks(approval, stage, checks, comment); toast.success('Zwischenstand gespeichert'); reload(); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const onApprove = async () => {
    if (!unlocked) { toast.error('Vorherige Freigabestufe ist noch nicht abgeschlossen.'); return; }
    if (!mayApprove) { toast.error(`Freigabe nur durch: ${def.roles.join(', ')}`); return; }
    if (missing.length > 0) { toast.error(`Fehlende Pflichtprüfpunkte: ${missing.join(', ')}`); return; }
    if (!signature) { toast.error('Bitte zuerst digital unterschreiben.'); return; }
    setBusy(true);
    try {
      const updated = await approveStage({ approval, stage, checks, comment, signature, userId: user?.id ?? null, userName, orderNumber });
      toast.success(`${def.title} freigegeben`);
      setSignature(null);
      if (updated && ['released', 'delivered', 'completed'].includes(updated.overall_status)) {
        toast.info('Protokoll wird archiviert und versendet…');
        void autoFinalizeRelease(updated);
      }
      reload();
    } catch (e: any) { toast.error(e?.message ?? 'Freigabe fehlgeschlagen'); }
    finally { setBusy(false); }
  };



  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-3 w-3 rounded-full ${ui.dot}`} />
        <div className="font-semibold">{def.order}. {def.title}</div>
        <Badge variant="outline" className={ui.text}>{ui.label}</Badge>
        <span className="text-xs text-muted-foreground">· {def.responsible}</span>
        <span className="ml-auto text-xs text-muted-foreground">{done}/{def.checks.length} Prüfpunkte</span>
      </div>

      {status !== 'approved' && sla !== 'ok' && (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          SLA überschritten ({sla === 'reminder' ? '24 h' : sla === 'lead' ? '48 h – Leitung informiert' : '72 h – Operations informiert'})
        </div>
      )}

      {!unlocked && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Vorherige Freigabestufe ist noch nicht abgeschlossen.
        </div>
      )}

      {status === 'approved' ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Genehmigt von {(approval as any)[`${stage}_by_name`] || '—'} am {fmt((approval as any)[`${stage}_at`])}
          </div>
          {(approval as any)[`${stage}_comment`] && (
            <div className="text-xs text-muted-foreground">Kommentar: {(approval as any)[`${stage}_comment`]}</div>
          )}
          {(approval as any)[`${stage}_signature`] && (
            <img src={(approval as any)[`${stage}_signature`]} alt={`Unterschrift ${def.title}`} className="h-16 rounded border border-border bg-white" />
          )}
          <div className="grid gap-1 sm:grid-cols-2">
            {def.checks.map((c) => (
              <div key={c.key} className="text-xs text-muted-foreground">
                {checks[c.key] ? '✓' : '—'} {c.label}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={!unlocked || !mayApprove ? 'opacity-70' : ''}>
          <div className="space-y-3">

            {groups.map(([g, list]) => (
              <div key={g}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">{g}</div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {list.map((c) => (
                    <label key={c.key} className="flex items-start gap-2 rounded-md p-2 hover:bg-accent/30 cursor-pointer min-h-11">
                      <Checkbox
                        checked={!!checks[c.key]}
                        onCheckedChange={(v) => setChecks((prev) => ({ ...prev, [c.key]: !!v }))}
                      />
                      <span className="text-sm leading-tight">
                        {c.label}{c.required && <span className="text-destructive"> *</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Kommentar (optional)"
              rows={2}
            />

            <div>
              <div className="text-xs text-muted-foreground mb-1">Digitale Unterschrift *</div>
              <SignaturePad onChange={setSignature} height={140} />
            </div>

            {missing.length > 0 && (
              <div className="text-xs text-amber-400">
                Fehlende Pflichtprüfpunkte: {missing.join(', ')}
              </div>
            )}
            {missing.length === 0 && !signature && (
              <div className="text-xs text-amber-400">Bitte noch digital unterschreiben.</div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onSave} disabled={busy}>Zwischenstand speichern</Button>
              <Button onClick={onApprove} disabled={busy}>
                <ShieldCheck className="h-4 w-4 mr-1" />
                {def.title} genehmigen
              </Button>
            </div>

          </div>
        </div>
      )}

      {!mayApprove && status !== 'approved' && (
        <div className="text-xs text-muted-foreground">
          Freigabe nur durch: {def.roles.filter((r) => r !== 'Super Admin').join(', ')}
        </div>
      )}
    </Card>
  );
}

export default function DeliveryApprovalPanel({ orderId, orderNumber }: { orderId: string; orderNumber?: string | null }) {
  const { user, profile, hasRole } = useAuth();
  const [approval, setApproval] = useState<DeliveryApproval | null>(null);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState('buchhaltung@alix-operation.de');
  const [busyDoc, setBusyDoc] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const a = await ensureApproval(orderId);
      setApproval(a);
      setEvents(await fetchEvents(orderId));
    } catch (e: any) {
      toast.error(e.message ?? 'Freigaben konnten nicht geladen werden');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orderId]);

  // Realtime: Statuswechsel anderer Abteilungen sofort übernehmen
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`delivery-approval-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_approvals', filter: `order_id=eq.${orderId}` },
        () => { void load(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'delivery_approval_events', filter: `order_id=eq.${orderId}` },
        () => { void fetchEvents(orderId).then(setEvents); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    /* eslint-disable-next-line */
  }, [orderId]);

  if (loading || !approval) return <div className="p-6 text-sm text-muted-foreground">Freigaben werden geladen…</div>;

  const overall = OVERALL_UI[approval.overall_status];
  const missing = missingStages(approval);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`h-3.5 w-3.5 rounded-full ${overall.dot}`} />
          <div className="font-semibold">Gesamtstatus: <span className={overall.text}>{overall.label}</span></div>
          {approval.released_at && (
            <span className="text-xs text-muted-foreground">freigegeben am {fmt(approval.released_at)}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              try {
                downloadDeliveryApprovalPdf({ approval, events, orderNumber });
                toast.success('Freigabeprotokoll erstellt');
              } catch (e: any) { toast.error(e.message ?? 'PDF konnte nicht erstellt werden'); }
            }}
          >
            <FileDown className="h-4 w-4 mr-1" />Protokoll (PDF)
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busyDoc}
            onClick={async () => {
              setBusyDoc(true);
              try {
                await archiveApprovalPdf({ approval, events, orderNumber });
                toast.success('Protokoll in AlixDocs archiviert');
                void fetchEvents(orderId).then(setEvents);
              } catch (e: any) { toast.error(e.message ?? 'Archivierung fehlgeschlagen'); }
              finally { setBusyDoc(false); }
            }}
          >
            <Archive className="h-4 w-4 mr-1" />In AlixDocs archivieren
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMailOpen(true)}>
            <Mail className="h-4 w-4 mr-1" />Protokoll per E-Mail
          </Button>
          {hasRole('Super Admin') && missing.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setUnlockOpen(true)}>
              <Unlock className="h-4 w-4 mr-1" />Entsperren
            </Button>
          )}
        </div>
        {missing.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            Fehlende Freigaben: {missing.map((m) => `• ${m}`).join('  ')}
          </div>
        )}
      </Card>

      {STAGES.map((s) => (
        <StageCard key={s.stage} stage={s.stage} approval={approval} reload={load} orderNumber={orderNumber} />
      ))}

      <Card className="p-4">
        <div className="flex items-center gap-2 font-semibold mb-2"><History className="h-4 w-4" />Historie (revisionssicher)</div>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">Noch keine Einträge.</div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((e) => (
              <div key={e.id} className="py-2 text-xs">
                <div className="font-medium">
                  {fmt(e.created_at)} · {e.stage} · {e.old_status ?? '—'} → {e.new_status ?? '—'}
                </div>
                <div className="text-muted-foreground">
                  {e.user_name ?? 'Unbekannt'}{e.ip_address ? ` · IP ${e.ip_address}` : ''}{e.comment ? ` · ${e.comment}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={unlockOpen} onOpenChange={setUnlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Freigabe entsperren (Super Admin)</DialogTitle></DialogHeader>
          <Separator />
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Die Entsperrung wird revisionssicher protokolliert.</div>
            <Input value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="Begründung (min. 5 Zeichen)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockOpen(false)}>Abbrechen</Button>
            <Button
              disabled={unlockReason.trim().length < 5}
              onClick={async () => {
                try {
                  await unlockApproval(approval, unlockReason.trim(), user?.id ?? null, profile?.full_name || user?.email || 'Super Admin');
                  toast.success('Freigabe entsperrt');
                  setUnlockOpen(false); setUnlockReason('');
                  load();
                } catch (e: any) { toast.error(e.message); }
              }}
            >Entsperren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Freigabeprotokoll versenden</DialogTitle></DialogHeader>
          <Separator />
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Das PDF wird als Anhang versendet – BCC automatisch an k.trinh@alix-operation.de.
            </div>
            <Input
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
              placeholder="Empfänger (mehrere mit Komma trennen)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMailOpen(false)}>Abbrechen</Button>
            <Button
              disabled={busyDoc || !mailTo.trim()}
              onClick={async () => {
                setBusyDoc(true);
                try {
                  await mailApprovalPdf({
                    approval, events, orderNumber,
                    to: mailTo.split(',').map((s) => s.trim()).filter(Boolean),
                  });
                  toast.success('Protokoll versendet');
                  setMailOpen(false);
                  void fetchEvents(orderId).then(setEvents);
                } catch (e: any) { toast.error(e.message ?? 'Versand fehlgeschlagen'); }
                finally { setBusyDoc(false); }
              }}
            >Senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
