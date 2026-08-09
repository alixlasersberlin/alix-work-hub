import { useEffect, useState } from 'react';
import { Phone, MessageSquare, HandCoins, CalendarClock, CreditCard, Gavel, Scale, Plus, Check, FileText, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

const fmt = (n: any, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(Number(n ?? 0));

const OUTCOMES: Record<string, string> = {
  paid: 'Bezahlt',
  promised: 'Zahlung versprochen',
  no_answer: 'Nicht erreichbar',
  callback: 'Rückruf vereinbart',
  wrong_number: 'Falsche Nummer',
};

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

export default function CollectCaseActions({ c, items, onChange, customerPhone }: { c: any; items: any[]; onChange: () => void; customerPhone?: string | null }) {
  const caseId = c.id as string;
  const cur = c.currency ?? 'EUR';

  const [calls, setCalls] = useState<any[]>([]);
  const [promises, setPromises] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [limit, setLimit] = useState<any>(null);
  const [legal, setLegal] = useState<any[]>([]);

  const [callOpen, setCallOpen] = useState(false);
  const [outcome, setOutcome] = useState('promised');
  const [callNote, setCallNote] = useState('');
  const [followup, setFollowup] = useState('3');

  const [promiseOpen, setPromiseOpen] = useState(false);
  const [pAmount, setPAmount] = useState('');
  const [pDate, setPDate] = useState(inDays(7));
  const [pNote, setPNote] = useState('');

  const [planOpen, setPlanOpen] = useState(false);
  const [down, setDown] = useState('0');
  const [months, setMonths] = useState('6');
  const [start, setStart] = useState(inDays(14));
  const [iban, setIban] = useState('');

  const [smsTo, setSmsTo] = useState('');
  const [smsText, setSmsText] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);

  const [limitOpen, setLimitOpen] = useState(false);
  const [limitValue, setLimitValue] = useState('20000');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const planDoc = async (planId: string, send: boolean) => {
    setBusyPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('collect-document-generate', {
        body: { case_id: caseId, doc_type: 'ratenvereinbarung', plan_id: planId, send },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) throw new Error(res.error);
      if (res?.url) window.open(res.url, '_blank');
      toast({ title: send ? 'Ratenvereinbarung versendet' : 'Ratenvereinbarung erstellt' });
      onChange(); load();
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setBusyPlan(null);
    }
  };

  const load = async () => {
    const [ca, pr, pl, li, lg] = await Promise.all([
      supabase.from('collect_calls' as any).select('*').eq('case_id', caseId).order('created_at', { ascending: false }).limit(20),
      supabase.from('collect_promises' as any).select('*').eq('case_id', caseId).order('promised_date', { ascending: false }),
      supabase.from('collect_payment_plans' as any).select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
      c.customer_id
        ? supabase.from('collect_credit_limits' as any).select('*').eq('customer_id', c.customer_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase.from('collect_legal_cases' as any).select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
    ]);
    setCalls((ca.data as any) ?? []);
    setPromises((pr.data as any) ?? []);
    setPlans((pl.data as any) ?? []);
    setLimit((li as any).data ?? null);
    setLegal((lg.data as any) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId]);

  const totalOpen = Number(c.open_amount ?? 0) + Number(c.fee_amount ?? 0) + Number(c.interest_amount ?? 0);

  const saveCall = async () => {
    const fu = followup === '0' ? null : inDays(Number(followup));
    const { error } = await supabase.from('collect_calls' as any).insert({
      case_id: caseId, customer_id: c.customer_id, phone: c.customer_phone,
      outcome, note: callNote || null, followup_date: fu,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('collect_events' as any).insert({
      case_id: caseId, event_type: 'call', subject: `Telefonat: ${OUTCOMES[outcome]}`, body: callNote || null,
    });
    await supabase.from('collect_cases' as any).update({ last_contact_at: new Date().toISOString() }).eq('id', caseId);
    if (fu) {
      await supabase.from('collect_tasks' as any).insert({
        case_id: caseId, customer_id: c.customer_id, customer_name: c.customer_name,
        task_type: 'followup', title: `Wiedervorlage: ${c.customer_name ?? 'Kunde'}`,
        description: callNote || null, due_date: fu, priority: 60, source: 'call',
        amount: c.overdue_amount ?? 0,
      });
    }
    setCallOpen(false); setCallNote('');
    toast({ title: 'Telefonat gespeichert' });
    onChange(); load();
  };

  const savePromise = async () => {
    const amount = Number(pAmount.replace(',', '.')) || 0;
    if (amount <= 0) { toast({ title: 'Betrag fehlt', variant: 'destructive' }); return; }
    const { error } = await supabase.from('collect_promises' as any).insert({
      case_id: caseId, customer_id: c.customer_id, amount, currency: cur, promised_date: pDate, note: pNote || null,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('collect_events' as any).insert({
      case_id: caseId, event_type: 'promise', subject: `Zahlungsversprechen ${fmt(amount, cur)} bis ${pDate}`, body: pNote || null,
    });
    await supabase.from('collect_tasks' as any).insert({
      case_id: caseId, customer_id: c.customer_id, customer_name: c.customer_name,
      task_type: 'followup', title: `Zahlungseingang prüfen: ${c.customer_name ?? 'Kunde'}`,
      due_date: pDate, priority: 70, source: 'promise', amount,
    });
    setPromiseOpen(false); setPAmount(''); setPNote('');
    toast({ title: 'Zahlungsversprechen erfasst' });
    load();
  };

  const resolvePromise = async (id: string, status: 'kept' | 'broken') => {
    await supabase.from('collect_promises' as any).update({ status, resolved_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  const savePlan = async () => {
    const dp = Number(down.replace(',', '.')) || 0;
    const m = Math.max(1, Number(months) || 1);
    const rest = Math.max(0, totalOpen - dp);
    const monthly = Math.round((rest / m) * 100) / 100;
    const { data, error } = await supabase.from('collect_payment_plans' as any).insert({
      case_id: caseId, customer_id: c.customer_id, total_amount: totalOpen, downpayment: dp,
      monthly_amount: monthly, term_months: m, start_date: start, currency: cur,
      sepa_iban_masked: iban ? `****${iban.slice(-4)}` : null, status: 'draft',
    }).select('id').maybeSingle();
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    const planId = (data as any)?.id;
    if (planId) {
      const rows = Array.from({ length: m }, (_, i) => {
        const d = new Date(start); d.setMonth(d.getMonth() + i);
        return { plan_id: planId, seq: i + 1, due_date: d.toISOString().slice(0, 10), amount: monthly };
      });
      await supabase.from('collect_payment_plan_items' as any).insert(rows);
    }
    await supabase.from('collect_cases' as any).update({ status: 'payment_plan' }).eq('id', caseId);
    await supabase.from('collect_events' as any).insert({
      case_id: caseId, event_type: 'payment_plan',
      subject: `Ratenplan: ${fmt(dp, cur)} Anzahlung + ${m} × ${fmt(monthly, cur)}`,
    });
    setPlanOpen(false);
    toast({ title: 'Ratenplan angelegt' });
    onChange(); load();
  };

  const saveLimit = async (blocked: boolean) => {
    if (!c.customer_id) { toast({ title: 'Kein Kunde verknüpft', variant: 'destructive' }); return; }
    const val = limitValue === 'unlimited' ? null : Number(limitValue);
    const used = Number(c.open_amount ?? 0);
    const light = blocked ? 'red' : (val != null && used > val) || used > 0 ? (val != null && used > val ? 'red' : 'yellow') : 'green';
    const { error } = await supabase.from('collect_credit_limits' as any).upsert({
      customer_id: c.customer_id, customer_name: c.customer_name,
      credit_limit: val, unlimited: limitValue === 'unlimited', used_amount: used,
      traffic_light: light, blocked, block_reason: blocked ? 'Offene Forderungen' : null,
    }, { onConflict: 'customer_id' });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setLimitOpen(false);
    toast({ title: 'Kreditlimit gespeichert' });
    load();
  };

  const escalate = async (kind: 'inkasso' | 'anwalt' | 'gericht') => {
    const { error } = await supabase.from('collect_legal_cases' as any).insert({
      case_id: caseId, customer_id: c.customer_id, customer_name: c.customer_name,
      kind, claim_amount: totalOpen,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('collect_dossiers' as any).insert({
      case_id: caseId, customer_id: c.customer_id, purpose: kind,
      content: {
        customer: { name: c.customer_name, email: c.customer_email, phone: c.customer_phone },
        claim: { open: c.open_amount, overdue: c.overdue_amount, fees: c.fee_amount, interest: c.interest_amount },
        invoices: items.map((i) => ({ number: i.invoice_number, date: i.invoice_date, due: i.due_date, balance: i.balance })),
        generated_at: new Date().toISOString(),
      },
    });
    await supabase.from('collect_cases' as any).update({ status: kind === 'gericht' ? 'anwalt' : kind }).eq('id', caseId);
    await supabase.from('collect_events' as any).insert({
      case_id: caseId, event_type: 'escalation', subject: `Übergabe an ${kind} inkl. Aktenzusammenstellung`,
    });
    toast({ title: `Übergabe an ${kind} vorbereitet`, description: 'Akte wurde zusammengestellt.' });
    onChange(); load();
  };

  const phoneFromMaster = customerPhone ?? c.customer_phone ?? null;

  const dunningSmsText = () =>
    `Alix Lasers: Offener Betrag ${fmt(totalOpen, cur)} (Verzug ${c.max_days_overdue ?? 0} Tage). `
    + 'Bitte begleichen Sie den Betrag oder kontaktieren Sie uns unter service@alix-lasers.com.';

  const sendSms = async (dunning: boolean) => {
    const to = smsTo.trim();
    const message = (dunning ? dunningSmsText() : smsText.trim()).slice(0, 600);
    if (!to) { toast({ title: 'Keine Telefonnummer', description: 'Bitte Empfänger angeben.', variant: 'destructive' }); return; }
    if (!message) { toast({ title: 'Nachricht fehlt', description: 'Bitte Text eingeben oder Mahntext einfügen.', variant: 'destructive' }); return; }
    setSmsBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('collect-send-sms', {
        body: { case_id: caseId, channel: 'sms', to, message },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'SMS versendet', description: to });
      if (!dunning) setSmsText('');
      onChange(); load();
    } catch (e: any) {
      toast({ title: 'SMS fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setSmsBusy(false);
    }
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard title="Telefonmodus" icon={<Phone className="h-4 w-4 text-primary" />}>
          <div className="text-sm text-muted-foreground">
            {c.customer_phone ? <a href={`tel:${c.customer_phone}`} className="text-primary hover:underline">{c.customer_phone}</a> : 'Keine Telefonnummer hinterlegt'}
          </div>
          <div className="mt-2 text-sm">Offene Posten: <span className="font-medium">{items.length}</span> · {fmt(totalOpen, cur)}</div>
          <div className="mt-3 rounded-lg border border-border p-3 text-xs text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">Gesprächsleitfaden</div>
            1. Identität bestätigen · 2. Offene Beträge und Fälligkeit nennen · 3. Grund der Nichtzahlung erfragen ·
            4. Konkretes Zahlungsdatum vereinbaren · 5. Alternativ Ratenzahlung anbieten · 6. Ergebnis dokumentieren.
          </div>
          <Button className="mt-3" size="sm" onClick={() => setCallOpen(true)}><Phone className="h-4 w-4 mr-2" />Gespräch dokumentieren</Button>
          <div className="mt-3 space-y-1">
            {calls.slice(0, 5).map((k) => (
              <div key={k.id} className="flex justify-between rounded border border-border/60 p-2 text-xs">
                <span>{new Date(k.created_at).toLocaleDateString('de-DE')} · {OUTCOMES[k.outcome] ?? k.outcome}</span>
                {k.followup_date && <span className="text-muted-foreground">WV {k.followup_date}</span>}
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="SMS Versand" icon={<MessageSquare className="h-4 w-4 text-primary" />}>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Empfänger (aus Kundenstammdaten)</div>
              <Input
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
                placeholder="+49…"
              />
              {!phoneFromMaster && (
                <p className="mt-1 text-xs text-amber-400">Keine Telefonnummer in den Kundenstammdaten hinterlegt.</p>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Nachricht</div>
              <Textarea
                rows={4}
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="Freie Nachricht an den Kunden…"
              />
              <div className="mt-1 text-right text-xs text-muted-foreground">{smsText.length}/600</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSmsText(dunningSmsText())}>
                Mahntext einfügen
              </Button>
              <Button size="sm" disabled={smsBusy || !smsTo.trim()} onClick={() => sendSms(false)}>
                <Send className="h-4 w-4 mr-2" />SMS senden
              </Button>
              <Button size="sm" variant="secondary" disabled={smsBusy || !smsTo.trim()} onClick={() => sendSms(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />Mahnung per SMS
              </Button>
            </div>
          </div>
        </DataCard>

        <DataCard title="Zahlungsversprechen" icon={<HandCoins className="h-4 w-4 text-primary" />}>
          <Button size="sm" onClick={() => setPromiseOpen(true)}><Plus className="h-4 w-4 mr-2" />Zahlungsversprechen</Button>
          <div className="mt-3 space-y-2">
            {promises.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Zusagen erfasst.</p>}
            {promises.map((p) => {
              const overdue = p.status === 'open' && p.promised_date < today();
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                  <span>{fmt(p.amount, p.currency ?? cur)} bis {p.promised_date}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className={overdue ? 'border-red-500/30 bg-red-500/15 text-red-400' : ''}>
                      {overdue ? 'gebrochen' : p.status}
                    </Badge>
                    {p.status === 'open' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => resolvePromise(p.id, 'kept')}><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => resolvePromise(p.id, 'broken')}>Bruch</Button>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </DataCard>

        <DataCard title="Ratenzahlung" icon={<CalendarClock className="h-4 w-4 text-primary" />}>
          <Button size="sm" onClick={() => setPlanOpen(true)}><Plus className="h-4 w-4 mr-2" />Ratenplan erstellen</Button>
          <div className="mt-3 space-y-2">
            {plans.length === 0 && <p className="text-sm text-muted-foreground">Kein Ratenplan vorhanden.</p>}
            {plans.map((p) => (
              <div key={p.id} className="rounded-lg border border-border p-2 text-sm">
                <div className="flex justify-between">
                  <span>{p.term_months} × {fmt(p.monthly_amount, p.currency ?? cur)}</span>
                  <Badge variant="outline">{p.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Anzahlung {fmt(p.downpayment, p.currency ?? cur)} · Start {p.start_date}
                  {p.sepa_iban_masked ? ` · SEPA ${p.sepa_iban_masked}` : ''}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busyPlan === p.id}
                    onClick={() => planDoc(p.id, false)}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />Vereinbarung als PDF
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyPlan === p.id || !c.customer_email}
                    onClick={() => planDoc(p.id, true)}>
                    <Send className="h-3.5 w-3.5 mr-1.5" />An Kunden senden
                  </Button>
                </div>
              </div>

            ))}
          </div>
        </DataCard>

        <DataCard title="Kreditlimit & Verkaufsschutz" icon={<CreditCard className="h-4 w-4 text-primary" />}>
          {limit ? (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Limit</span>
                <span>{limit.unlimited ? 'unbegrenzt' : fmt(limit.credit_limit, cur)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Genutzt</span><span>{fmt(limit.used_amount, cur)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ampel</span>
                <Badge variant="outline" className={
                  limit.traffic_light === 'red' ? 'border-red-500/30 bg-red-500/15 text-red-400'
                    : limit.traffic_light === 'yellow' ? 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                      : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                }>{limit.blocked ? 'gesperrt' : limit.traffic_light}</Badge></div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Noch kein Limit hinterlegt.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setLimitOpen(true)}>Limit festlegen</Button>
            <Button size="sm" variant="outline" onClick={() => saveLimit(true)}>Kunde sperren</Button>
            <Button size="sm" variant="ghost" onClick={() => saveLimit(false)}>Sperre aufheben</Button>
          </div>
        </DataCard>
      </div>

      <DataCard title="Eskalation: Inkasso, Anwalt, Gericht" icon={<Gavel className="h-4 w-4 text-primary" />}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => escalate('inkasso')}><Gavel className="h-4 w-4 mr-2" />An Inkasso übergeben</Button>
          <Button size="sm" variant="outline" onClick={() => escalate('anwalt')}><Scale className="h-4 w-4 mr-2" />An Anwalt übergeben</Button>
          <Button size="sm" variant="outline" onClick={() => escalate('gericht')}><Scale className="h-4 w-4 mr-2" />Gerichtsakte anlegen</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Bei Übergabe werden Rechnungen, Beträge, Mahnverlauf und Kundendaten automatisch zu einer Akte zusammengestellt.
        </p>
        <div className="mt-3 space-y-2">
          {legal.map((l) => (
            <div key={l.id} className="flex justify-between rounded-lg border border-border p-2 text-sm">
              <span>{l.kind} · {fmt(l.claim_amount, cur)}{l.file_number ? ` · Az. ${l.file_number}` : ''}</span>
              <Badge variant="outline">{l.status}</Badge>
            </div>
          ))}
        </div>
      </DataCard>

      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Telefonat dokumentieren</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Ergebnis</label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OUTCOMES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Wiedervorlage</label>
              <Select value={followup} onValueChange={setFollowup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Keine</SelectItem>
                  <SelectItem value="1">Morgen</SelectItem>
                  <SelectItem value="3">3 Tage</SelectItem>
                  <SelectItem value="7">7 Tage</SelectItem>
                  <SelectItem value="30">30 Tage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea value={callNote} onChange={(e) => setCallNote(e.target.value)} rows={4} placeholder="Gesprächsnotiz …" />
          </div>
          <DialogFooter><Button onClick={saveCall}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={promiseOpen} onOpenChange={setPromiseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Zahlungsversprechen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Betrag</label>
              <Input value={pAmount} onChange={(e) => setPAmount(e.target.value)} placeholder={String(c.overdue_amount ?? '')} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Zugesagtes Datum</label>
              <Input type="date" value={pDate} onChange={(e) => setPDate(e.target.value)} />
            </div>
            <Textarea value={pNote} onChange={(e) => setPNote(e.target.value)} rows={3} placeholder="Notiz …" />
          </div>
          <DialogFooter><Button onClick={savePromise}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ratenplan erstellen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Gesamtforderung: <span className="font-medium text-foreground">{fmt(totalOpen, cur)}</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Anzahlung</label>
                <Input value={down} onChange={(e) => setDown(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Laufzeit (Monate)</label>
                <Input value={months} onChange={(e) => setMonths(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Erste Rate am</label>
                <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">IBAN (SEPA)</label>
                <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="DE.." />
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 text-sm">
              Monatliche Rate: <span className="font-medium">
                {fmt((Math.max(0, totalOpen - (Number(down.replace(',', '.')) || 0)) / Math.max(1, Number(months) || 1)), cur)}
              </span>
            </div>
          </div>
          <DialogFooter><Button onClick={savePlan}>Ratenplan anlegen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={limitOpen} onOpenChange={setLimitOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kreditlimit festlegen</DialogTitle></DialogHeader>
          <Select value={limitValue} onValueChange={setLimitValue}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="5000">5.000 €</SelectItem>
              <SelectItem value="20000">20.000 €</SelectItem>
              <SelectItem value="100000">100.000 €</SelectItem>
              <SelectItem value="unlimited">Unbegrenzt</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter><Button onClick={() => saveLimit(false)}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
