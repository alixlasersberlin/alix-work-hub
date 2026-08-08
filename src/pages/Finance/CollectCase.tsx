import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Mail, Sparkles, Ban, ShieldCheck, Send, History, Gavel,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';

const fmt = (n: any, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(Number(n ?? 0));

const AMPEL: Record<string, string> = {
  gruen: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  gelb: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  rot: 'bg-red-500/15 text-red-400 border-red-500/30',
  schwarz: 'bg-foreground/15 text-foreground border-foreground/30',
};

export default function FinanceCollectCase() {
  const { caseId } = useParams();
  const [c, setC] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [mailOpen, setMailOpen] = useState(false);
  const [mailStage, setMailStage] = useState('');
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailHtml, setMailHtml] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    const [a, b, e, bl, st] = await Promise.all([
      supabase.from('collect_cases' as any).select('*').eq('id', caseId).maybeSingle(),
      supabase.from('collect_case_items' as any).select('*').eq('case_id', caseId).order('due_date', { ascending: true }),
      supabase.from('collect_events' as any).select('*').eq('case_id', caseId).order('occurred_at', { ascending: false }).limit(100),
      supabase.from('collect_blocks' as any).select('*').eq('case_id', caseId).eq('active', true),
      supabase.from('collect_stage_config' as any).select('*').eq('active', true).order('day_offset', { ascending: true }),
    ]);
    setC(a.data);
    setItems((b.data as any) ?? []);
    setEvents((e.data as any) ?? []);
    setBlocks((bl.data as any) ?? []);
    setStages((st.data as any) ?? []);
    setMailStage((a.data as any)?.stage_code ?? '');
    setMailTo((a.data as any)?.customer_email ?? '');
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId]);

  const preview = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('collect-send-dunning', {
      body: { case_id: caseId, stage_code: mailStage, preview: true },
    });
    setBusy(false);
    if (error) { toast({ title: 'Vorschau fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    setMailSubject((data as any)?.subject ?? '');
    setMailHtml((data as any)?.html ?? '');
    setMailOpen(true);
  };

  const send = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke('collect-send-dunning', {
      body: { case_id: caseId, stage_code: mailStage, to_email: mailTo, subject: mailSubject, body_html: mailHtml },
    });
    setBusy(false);
    if (error) { toast({ title: 'Versand fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Mahnung versendet', description: mailTo });
    setMailOpen(false);
    load();
  };

  const score = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke('collect-ai-score', { body: { case_id: caseId } });
    setBusy(false);
    if (error) { toast({ title: 'KI-Bewertung fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    load();
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase.from('collect_cases' as any).update({ status }).eq('id', caseId!);
    if (error) { toast({ title: 'Statusänderung fehlgeschlagen', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('collect_events' as any).insert({ case_id: caseId, event_type: 'status_change', subject: `Status: ${status}` });
    load();
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await supabase.from('collect_events' as any).insert({ case_id: caseId, event_type: 'note', subject: 'Notiz', body: note.trim() });
    setNote('');
    load();
  };

  const releaseBlock = async (id: string) => {
    await supabase.from('collect_blocks' as any).update({ active: false, released_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  if (loading) return <div className="space-y-4"><SkeletonTable /></div>;
  if (!c) return <div className="p-6 text-muted-foreground">Fall nicht gefunden.</div>;

  const cur = c.currency ?? 'EUR';
  const total = Number(c.open_amount ?? 0) + Number(c.fee_amount ?? 0) + Number(c.interest_amount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.customer_name ?? 'Forderungsfall'}
        subtitle={`Verzug ${c.max_days_overdue ?? 0} Tage · Stufe ${c.stage_code ?? '–'}`}
        icon={AlertTriangle}
        meta={<Badge variant="outline" className={AMPEL[c.ampel ?? 'gruen']}>{c.status}</Badge>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/finance/collect"><ArrowLeft className="h-4 w-4 mr-2" />Zurück</Link>
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={score}>
              <Sparkles className="h-4 w-4 mr-2" />KI-Bewertung
            </Button>
            <Button size="sm" disabled={busy} onClick={preview}>
              <Mail className="h-4 w-4 mr-2" />Mahnung erstellen
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Offene Posten</div>
          <div className="font-display text-xl font-semibold">{fmt(c.open_amount, cur)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Überfällig</div>
          <div className="font-display text-xl font-semibold text-red-400">{fmt(c.overdue_amount, cur)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Gebühren + Zinsen</div>
          <div className="font-display text-xl font-semibold">{fmt(Number(c.fee_amount ?? 0) + Number(c.interest_amount ?? 0), cur)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Gesamtforderung</div>
          <div className="font-display text-xl font-semibold">{fmt(total, cur)}</div>
        </div>
      </div>

      {(c.ai_recommendation || c.risk_score != null) && (
        <DataCard title="KI-Einschätzung" icon={<Sparkles className="h-4 w-4 text-primary" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><div className="text-xs text-muted-foreground">Risiko-Score</div><div className="text-lg font-semibold">{c.risk_score ?? '–'} / 100 ({c.risk_class ?? '–'})</div></div>
            <div><div className="text-xs text-muted-foreground">Zahlungswahrscheinlichkeit</div><div className="text-lg font-semibold">{c.pay_probability_pct ?? '–'}%</div></div>
            <div><div className="text-xs text-muted-foreground">Empfehlung</div><div className="text-sm">{c.ai_recommendation ?? '–'}</div></div>
          </div>
          {c.ai_reasoning && <p className="mt-3 text-xs text-muted-foreground">{c.ai_reasoning}</p>}
        </DataCard>
      )}

      <DataCard title={`Offene Positionen (${items.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-left font-medium">Beleg</th>
                <th className="py-2 text-left font-medium">Datum</th>
                <th className="py-2 text-left font-medium">Fällig</th>
                <th className="py-2 text-right font-medium">Verzug</th>
                <th className="py-2 text-right font-medium">Offen</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i, idx) => (
                <tr key={i.id} className={`border-b border-border/50 ${idx % 2 ? 'bg-muted/20' : ''}`}>
                  <td className="py-2">{i.invoice_number ?? '–'}</td>
                  <td className="py-2">{i.invoice_date ?? '–'}</td>
                  <td className="py-2">{i.due_date ?? '–'}</td>
                  <td className="py-2 text-right">{i.days_overdue ?? 0} T</td>
                  <td className="py-2 text-right">{fmt(i.balance, i.currency ?? cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Eskalation & Sperren" icon={<Gavel className="h-4 w-4" />}>
          <div className="flex flex-wrap gap-2">
            {['active', 'payment_plan', 'kulanz', 'inkasso', 'anwalt', 'insolvenz', 'closed'].map((s) => (
              <Button key={s} size="sm" variant={c.status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>
                {s}
              </Button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {blocks.length === 0 && <p className="text-sm text-muted-foreground">Keine aktiven Sperren.</p>}
            {blocks.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                <span className="flex items-center gap-2"><Ban className="h-3.5 w-3.5 text-red-400" />{b.block_type}</span>
                <Button size="sm" variant="ghost" onClick={() => releaseBlock(b.id)}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />Freigeben
                </Button>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="Notiz hinzufügen">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Gesprächsnotiz, Zahlungszusage, Absprache …" />
          <Button className="mt-3" size="sm" onClick={addNote} disabled={!note.trim()}>
            <Send className="h-4 w-4 mr-2" />Speichern
          </Button>
        </DataCard>
      </div>

      <DataCard title={`Verlauf (${events.length})`} icon={<History className="h-4 w-4" />}>
        <div className="space-y-2">
          {events.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Ereignisse.</p>}
          {events.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(e.occurred_at ?? e.created_at).toLocaleString('de-DE')}</span>
                <span className="flex gap-2">
                  <Badge variant="outline">{e.event_type}</Badge>
                  {e.stage_code && <Badge variant="outline">{e.stage_code}</Badge>}
                </span>
              </div>
              {e.subject && <div className="mt-1 text-sm font-medium">{e.subject}</div>}
              {e.body && e.event_type !== 'email_sent' && <div className="text-sm text-muted-foreground">{e.body}</div>}
            </div>
          ))}
        </div>
      </DataCard>

      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Mahnung versenden</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Mahnstufe</label>
                <Select value={mailStage} onValueChange={(v) => setMailStage(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Empfänger</label>
                <Input value={mailTo} onChange={(e) => setMailTo(e.target.value)} placeholder="kunde@example.com" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Betreff</label>
              <Input value={mailSubject} onChange={(e) => setMailSubject(e.target.value)} />
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-border bg-background p-3">
              <div dangerouslySetInnerHTML={{ __html: mailHtml }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={preview} disabled={busy}>Neu generieren</Button>
            <Button onClick={send} disabled={busy || !mailTo}>
              <Mail className="h-4 w-4 mr-2" />Versenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
