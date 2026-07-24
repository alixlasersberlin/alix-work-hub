import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCreditPermissions } from '@/hooks/useCreditPermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, ArrowUpCircle, Trash2, Sparkles } from 'lucide-react';
import type { CreditAssessment, CreditScoreFactor, CreditAmpel } from '@/lib/credit/types';

const AMPEL_COLOR: Record<CreditAmpel, string> = {
  gruen: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  gelb: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  rot: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const CAT_LABEL: Record<string, string> = {
  schufa: 'SCHUFA', einkommen: 'Einkommen', beschaeftigung: 'Beschäftigung',
  unternehmen: 'Unternehmen', historie: 'Gerätehistorie', alixsmart: 'AlixSmart',
  zahlungsverhalten: 'Zahlungsverhalten', dokumente: 'Dokumente', ki: 'KI-Analyse',
};

export default function CreditDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { canWrite, canDelete, canDecide } = useCreditPermissions();
  const [a, setA] = useState<CreditAssessment | null>(null);
  const [factors, setFactors] = useState<CreditScoreFactor[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    const [{ data: aRow }, { data: f }, { data: l }] = await Promise.all([
      supabase.from('credit_assessments' as any).select('*').eq('id', id).maybeSingle(),
      supabase.from('credit_score_factors' as any).select('*').eq('assessment_id', id).order('category'),
      supabase.from('credit_decision_log' as any).select('*').eq('assessment_id', id).order('created_at', { ascending: false }).limit(50),
    ]);
    setA(aRow as unknown as CreditAssessment | null);
    setFactors((f ?? []) as unknown as CreditScoreFactor[]);
    setLog(l ?? []);
  };
  useEffect(() => { load(); }, [id]);

  const recalc = async () => {
    setBusy(true);
    toast.loading('Score wird berechnet …', { id: 'r' });
    const { error } = await supabase.functions.invoke('credit-score-calculate', { body: { assessment_id: id, run_ai: true } });
    setBusy(false);
    if (error) toast.error('Fehler: ' + error.message, { id: 'r' });
    else { toast.success('Score neu berechnet.', { id: 'r' }); await load(); }
  };

  const decide = async (decision: 'approve' | 'approve_conditions' | 'reject' | 'escalate' | 'cancel') => {
    setBusy(true);
    const { error } = await supabase.functions.invoke('credit-decision', { body: { assessment_id: id, decision, reason } });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success('Entscheidung gespeichert.'); setReason(''); await load(); }
  };

  const del = async () => {
    if (!confirm('Bonitätsprüfung endgültig löschen?')) return;
    const { error } = await supabase.from('credit_assessments' as any).delete().eq('id', id!);
    if (error) toast.error(error.message);
    else { toast.success('Gelöscht.'); nav('/bonitaet'); }
  };

  if (!a) return <div className="p-8 text-center text-muted-foreground">Lade …</div>;

  const snap = a.customer_snapshot as any;
  const rec = a.recommendation as any;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav('/bonitaet')}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <div className="text-xs uppercase tracking-[2px] text-primary/80">Bonitätsprüfung</div>
            <h1 className="text-2xl font-display font-bold">{snap.company_name || snap.name || '—'}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          {canWrite && <Button variant="outline" onClick={recalc} disabled={busy} className="gap-2"><RefreshCw className="w-4 h-4" /> Neu berechnen</Button>}
          {canDelete && <Button variant="destructive" size="icon" onClick={del}><Trash2 className="w-4 h-4" /></Button>}
        </div>
      </div>

      {/* Ampel-Karte */}
      <Card className={`border-2 ${a.ampel ? AMPEL_COLOR[a.ampel] : ''}`}>
        <CardContent className="pt-6 grid md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Score</div>
            <div className="text-5xl font-display font-bold">{a.score ?? '—'}<span className="text-lg text-muted-foreground">/1000</span></div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Ampel</div>
            <div className="text-2xl font-display font-bold uppercase">{a.ampel ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">{rec?.band_label ?? ''}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Ausfallwahrscheinlichkeit</div>
            <div className="text-3xl font-display font-bold">{a.default_probability_pct ?? '—'}%</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Status / Stufe</div>
            <div className="text-lg font-semibold">{a.status}</div>
            <div className="text-xs text-muted-foreground">Freigabe: {a.workflow_stage}</div>
          </div>
        </CardContent>
      </Card>

      {/* Empfehlung */}
      {rec?.band_label && (
        <Card>
          <CardHeader><CardTitle>Empfehlung</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-4">
            <Kv label="Anzahlung" value={`${rec.downpayment_pct}%`} />
            <Kv label="Laufzeit" value={`${rec.term_months} Monate`} />
            <Kv label="Max. Kredit" value={`${Number(rec.max_credit).toLocaleString('de-DE')} €`} />
            <Kv label="Freigabestufe" value={rec.decision_stage} />
          </CardContent>
        </Card>
      )}

      {/* Flags */}
      {(a.flags ?? []).length > 0 && (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardHeader><CardTitle className="text-orange-400">Risiko-Hinweise</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {a.flags.map((f, i) => <Badge key={i} variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">{f}</Badge>)}
          </CardContent>
        </Card>
      )}

      {/* KI-Analyse */}
      {a.ai_summary && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> KI-Risikoanalyse</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{a.ai_summary}</p><div className="text-xs text-muted-foreground mt-2">{a.ai_model}</div></CardContent>
        </Card>
      )}

      {/* Faktoren */}
      <Card>
        <CardHeader><CardTitle>Score-Faktoren</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {factors.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Faktoren berechnet.</div>}
          {factors.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <div>
                <div className="text-sm font-medium">{CAT_LABEL[f.category] ?? f.category}</div>
                <div className="text-xs text-muted-foreground">{f.label}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{Number(f.points) > 0 ? '+' : ''}{f.points}</div>
                <div className="text-xs text-muted-foreground">Gewicht {f.weight_pct}%</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Entscheidung */}
      <Card>
        <CardHeader><CardTitle>Entscheidung</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Begründung (optional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => decide('approve')} disabled={busy || !canDecide(a.workflow_stage)} className="gap-2 bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4" /> Freigeben</Button>
            <Button onClick={() => decide('approve_conditions')} disabled={busy || !canDecide(a.workflow_stage)} variant="outline" className="gap-2"><CheckCircle2 className="w-4 h-4" /> Mit Auflagen</Button>
            <Button onClick={() => decide('escalate')} disabled={busy || !canDecide(a.workflow_stage)} variant="outline" className="gap-2"><ArrowUpCircle className="w-4 h-4" /> Eskalieren</Button>
            <Button onClick={() => decide('reject')} disabled={busy || !canDecide(a.workflow_stage)} variant="destructive" className="gap-2"><XCircle className="w-4 h-4" /> Ablehnen</Button>
          </div>
          {!canDecide(a.workflow_stage) && <div className="text-xs text-orange-400">Deine Rolle darf diese Freigabestufe ({a.workflow_stage}) nicht entscheiden.</div>}
        </CardContent>
      </Card>

      {/* Audit */}
      <Card>
        <CardHeader><CardTitle>Entscheidungshistorie</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {log.length === 0 && <div className="text-muted-foreground">Keine Einträge.</div>}
          {log.map((l) => (
            <div key={l.id} className="flex items-start gap-3 border-b border-border pb-2">
              <div className="text-xs text-muted-foreground w-32 shrink-0">{new Date(l.created_at).toLocaleString('de-DE')}</div>
              <div className="flex-1">
                <div><strong>{l.action}</strong> {l.from_status ? `(${l.from_status} → ${l.to_status})` : ''}</div>
                {l.reason && <div className="text-xs text-muted-foreground">{l.reason}</div>}
                {l.actor_email && <div className="text-xs text-muted-foreground">von {l.actor_email}</div>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="text-lg font-semibold">{value}</div></div>;
}
