import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  AlertTriangle, CheckCircle2, Search, Loader2, Undo2, Split, PauseCircle, Copy, Banknote, Mail, FileText,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  ensureReturnDebit, findOriginalPayments, confirmReturnDebit, cancelReturnDebit,
  updateReturnDebit, loadReturnRules, getAllocationsOfReturnDebit, sendReturnDebitDunning,
  searchInvoicesForReturn,
  RD_STATUS, RETURN_CODES, amountTolerance,
  type PaymentCandidate, type ReturnRules,
} from '@/lib/bank/returnDebit';
import { downloadReturnDunningPdf } from '@/lib/bank/returnDunningLetter';

const fmt = (n: number, cur = 'EUR') => new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(n || 0);

interface SplitRow {
  invoice_id: string | null;
  invoice_number: string | null;
  order_id: string | null;
  installment_id: string | null;
  original_payment_allocation_id: string | null;
  allocated_amount: number;
}

export default function ReturnDebitDialog({
  tx, region, open, onOpenChange, onChanged,
}: {
  tx: any; region: 'EU' | 'CH'; open: boolean;
  onOpenChange: (o: boolean) => void; onChanged: () => void;
}) {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('Super Admin');
  const [rd, setRd] = useState<any | null>(null);
  const [rules, setRules] = useState<ReturnRules | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState<PaymentCandidate[]>([]);
  const [picked, setPicked] = useState<PaymentCandidate | null>(null);
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [confirmedAllocs, setConfirmedAllocs] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [filter, setFilter] = useState({ customerName: '', invoiceNumber: '', orderNumber: '', iban: '', amount: '', bankReference: '', endToEnd: '', mandate: '', dateFrom: '', dateTo: '' });
  const [invHits, setInvHits] = useState<any[]>([]);
  const [invBusy, setInvBusy] = useState(false);
  const [suggIdx, setSuggIdx] = useState<number | null>(null);
  const [suggTerm, setSuggTerm] = useState('');
  const [sugg, setSugg] = useState<any[]>([]);



  const [bankFee, setBankFee] = useState(0);
  const [additionalCosts, setAdditionalCosts] = useState(0);
  const [chargeCustomer, setChargeCustomer] = useState(true);
  const [customerFee, setCustomerFee] = useState(0);
  const [feeHandling, setFeeHandling] = useState<'intern' | 'weiterberechnen' | 'erlassen' | 'gebuehrenrechnung'>('weiterberechnen');
  const [costCenter, setCostCenter] = useState('');
  const [bookingAccount, setBookingAccount] = useState('');
  const [note, setNote] = useState('');
  const [blockMandate, setBlockMandate] = useState(true);
  const [startReminder, setStartReminder] = useState(true);
  const [createTask, setCreateTask] = useState(true);

  const amount = Math.abs(Number(rd?.return_debit_amount ?? tx?.amount ?? 0));
  const currency = rd?.currency ?? tx?.currency ?? 'EUR';

  useEffect(() => {
    if (!open || !tx) return;
    setLoading(true);
    (async () => {
      try {
        const r = await ensureReturnDebit(tx);
        setRd(r);
        const cfg = await loadReturnRules();
        setRules(cfg);
        setBankFee(Number(r.bank_fee) || cfg.defaultBankFee);
        setCustomerFee(Number(r.customer_fee) || cfg.defaultCustomerFee);
        setChargeCustomer(r.charge_customer ?? cfg.chargeCustomerByDefault);
        setAdditionalCosts(Number(r.additional_costs) || 0);
        setNote(r.note ?? '');
        if (r.status === 'bestaetigt' || r.status === 'storniert' || r.status === 'erledigt') {
          setConfirmedAllocs(await getAllocationsOfReturnDebit(r.id));
        } else {
          const list = await findOriginalPayments(tx, region);
          setCands(list);
          const best = list[0];
          if (best && best.score >= 70) selectCandidate(best);
        }
      } catch (e: any) { toast.error(e.message); }
      finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tx?.id]);

  function selectCandidate(c: PaymentCandidate) {
    setPicked(c);
    const rel = c.allocations.filter(a => Number(a.allocated_amount) > 0);
    if (rel.length) {
      let rest = amount;
      const rows: SplitRow[] = [];
      for (const a of rel) {
        if (rest <= 0.001) break;
        const take = Math.min(rest, Number(a.allocated_amount));
        rows.push({
          invoice_id: a.invoice_id ?? null, invoice_number: a.invoice_number ?? null,
          order_id: a.order_id ?? null, installment_id: null,
          original_payment_allocation_id: a.id, allocated_amount: Number(take.toFixed(2)),
        });
        rest -= take;
      }
      if (rest > 0.01 && rows.length) rows[0].allocated_amount = Number((rows[0].allocated_amount + rest).toFixed(2));
      setSplits(rows);
    } else {
      setSplits([{ invoice_id: null, invoice_number: null, order_id: null, installment_id: null, original_payment_allocation_id: null, allocated_amount: amount }]);
    }
  }

  const splitSum = useMemo(() => splits.reduce((s, r) => s + Number(r.allocated_amount || 0), 0), [splits]);
  const splitTol = amountTolerance(amount);
  const splitOk = Math.abs(splitSum - amount) <= splitTol && splits.length > 0;
  const splitExact = Math.abs(splitSum - amount) < 0.01;
  const customerId = picked?.allocations.find(a => a.customer_id)?.customer_id ?? picked?.tx?.matched_customer_id ?? rd?.customer_id ?? null;
  const confidence = picked?.score ?? 0;
  const readOnly = rd && ['bestaetigt', 'storniert', 'erledigt'].includes(rd.status);

  // Live-Vorschläge zu Rechnungen/Ratenzahlern im Suchbereich
  const invTerm = (filter.invoiceNumber || filter.customerName || filter.orderNumber || '').trim();
  useEffect(() => {
    if (!open || readOnly) return;
    if (invTerm.length < 2) { setInvHits([]); return; }
    let alive = true;
    setInvBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchInvoicesForReturn(region, invTerm);
        if (alive) setInvHits(res.slice(0, 20));
      } catch { /* ignore */ }
      finally { if (alive) setInvBusy(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [invTerm, open, region, readOnly]);

  // Live-Vorschläge direkt im Aufteilungsfeld
  useEffect(() => {
    if (suggIdx === null || suggTerm.trim().length < 2) { setSugg([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await searchInvoicesForReturn(region, suggTerm.trim());
        if (alive) setSugg(res.slice(0, 10));
      } catch { /* ignore */ }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [suggTerm, suggIdx, region]);

  function applyInvoice(inv: any, index?: number) {
    const row: SplitRow = {
      invoice_id: inv.id ?? null,
      invoice_number: inv.invoice_number ?? null,
      order_id: null, installment_id: null, original_payment_allocation_id: null,
      allocated_amount: Number(amount.toFixed(2)),
    };
    if (index === undefined) {
      setSplits([row]);
      setShowSearch(false);
    } else {
      setSplits(splits.map((x, j) => j === index
        ? { ...x, invoice_id: inv.id ?? null, invoice_number: inv.invoice_number ?? null }
        : x));
    }
    setSuggIdx(null); setSugg([]); setSuggTerm('');
    toast.success(`Rechnung ${inv.invoice_number ?? ''} zugeordnet`);
  }

  const runSearch = async () => {
    setBusy(true);
    try {
      const list = await findOriginalPayments(tx, region, {
        customerName: filter.customerName || undefined,
        invoiceNumber: filter.invoiceNumber || undefined,
        orderNumber: filter.orderNumber || undefined,
        iban: filter.iban || undefined,
        amount: filter.amount ? Number(filter.amount) : undefined,
        bankReference: filter.bankReference || undefined,
        endToEnd: filter.endToEnd || undefined,
        mandate: filter.mandate || undefined,
        dateFrom: filter.dateFrom || undefined,
        dateTo: filter.dateTo || undefined,
      });
      setCands(list);
      if (!list.length && invTerm) {
        const res = await searchInvoicesForReturn(region, invTerm);
        setInvHits(res.slice(0, 20));
        if (!res.length) toast.warning('Keine passende Zahlung oder Rechnung gefunden.');
        else toast.info('Keine Zahlung gefunden – Rechnungen als Vorschlag geladen.');
      } else if (!list.length) {
        toast.warning('Keine passende Zahlung gefunden.');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }

  };

  const doConfirm = async () => {
    if (!rd) return;
    setBusy(true);
    try {
      const res = await confirmReturnDebit({
        rd, tx,
        originalPaymentTxId: picked?.tx?.id ?? null,
        customerId,
        allocations: splits,
        bankFee: Number(bankFee) || 0,
        additionalCosts: Number(additionalCosts) || 0,
        chargeCustomer: feeHandling === 'weiterberechnen' || feeHandling === 'gebuehrenrechnung',
        customerFee: feeHandling === 'erlassen' ? 0 : Number(customerFee) || 0,
        feeHandling,
        costCenter, bookingAccount, note,
        blockMandate, startReminder, createTask,
      });
      toast.success(res.fullyReturned
        ? 'Rücklastschrift bestätigt – Rechnung wieder geöffnet'
        : 'Rücklastschrift bestätigt – Rechnung ist wieder teilbezahlt');
      onChanged(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const setStatus = async (status: string, msg: string) => {
    if (!rd) return;
    setBusy(true);
    try { await updateReturnDebit(rd.id, { status, note }); toast.success(msg); onChanged(); onOpenChange(false); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const doCancel = async () => {
    if (!rd) return;
    const reason = window.prompt('Grund für die Stornierung der Rücklastschrift-Zuordnung');
    if (!reason) return;
    setBusy(true);
    try { await cancelReturnDebit(rd, reason); toast.success('Zuordnung storniert – Stornobuchung erstellt'); onChanged(); onOpenChange(false); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const doDunning = async () => {
    if (!rd) return;
    const days = Number(window.prompt('Zahlungsfrist in Tagen (danach Sperre der Leistungen)', '7') ?? '');
    if (!days || days < 1) return;
    setBusy(true);
    try {
      const info = await sendReturnDebitDunning(rd, days);
      toast.success(`Mahnung mit Sperrankündigung an ${info.recipient} versendet (zahlbar bis ${info.payUntil})`);
      onChanged();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const doDunningPdf = async () => {
    if (!rd) return;
    const days = Number(window.prompt('Zahlungsfrist in Tagen für das Mahnschreiben', '7') ?? '');
    if (!days || days < 1) return;
    setBusy(true);
    try {
      const vars = await downloadReturnDunningPdf(rd, days);
      toast.success(`Mahnschreiben erstellt (zahlbar bis ${vars.zahlbar_bis})`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-red-500" />
            Rücklastschrift bearbeiten · {fmt(amount, currency)}
            {rd && <Badge variant="outline">{RD_STATUS[rd.status] ?? rd.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {loading ? <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <div className="space-y-5 text-sm">
            {/* Bankbuchung */}
            <section>
              <H>Bankbuchung</H>
              <div className="grid sm:grid-cols-2 gap-x-6">
                <Row l="Buchungsdatum" v={tx.booking_date} />
                <Row l="Wertstellungsdatum" v={tx.value_date} />
                <Row l="Betrag" v={fmt(Number(tx.amount), currency)} />
                <Row l="Bankkonto" v={tx.bank_accounts ? `${tx.bank_accounts.bank_name} · ${tx.bank_accounts.iban ?? ''}` : '–'} />
                <Row l="Buchungstext" v={tx.booking_text} />
                <Row l="Verwendungszweck" v={tx.purpose} />
                <Row l="Bankreferenz" v={tx.bank_reference} />
                <Row l="Rückgabecode" v={rd?.return_code ? `${rd.return_code} – ${RETURN_CODES[rd.return_code] ?? ''}` : '–'} />
                <Row l="Rückgabegrund" v={rd?.return_reason} />
              </div>
            </section>

            <Separator />

            {/* Ursprüngliche Zahlung */}
            <section>
              <H>Ursprüngliche Zahlung</H>
              {readOnly ? (
                <p className="text-muted-foreground text-xs">Vorgang abgeschlossen – die ursprüngliche Zahlung bleibt unverändert erhalten.</p>
              ) : picked ? (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{picked.tx.sender_receiver_name ?? '–'}</span>
                    <Badge variant="outline">Zuordnungssicherheit {picked.score} %</Badge>
                  </div>
                  <Row l="Zahlungsdatum" v={picked.tx.booking_date} />
                  <Row l="Betrag" v={fmt(Number(picked.tx.amount), picked.tx.currency)} />
                  <Row l="IBAN" v={picked.tx.sender_receiver_iban} />
                  <Row l="Zahlungsreferenz" v={picked.tx.end_to_end_reference || picked.tx.bank_reference} />
                  <Row l="damaliger Zahlungsstatus" v={picked.tx.status} />
                  <ul className="list-disc pl-4 text-xs text-muted-foreground">
                    {picked.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                  <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setSplits([]); }}>Andere Zahlung wählen</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {!cands.length && (
                    <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span>Keine ursprüngliche Zahlung gefunden – bitte manuell suchen.</span>
                    </div>
                  )}
                  {cands.map(c => (
                    <button key={c.tx.id} onClick={() => selectCandidate(c)}
                      className="w-full text-left rounded-md border border-border p-2 hover:bg-muted/40">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{c.tx.sender_receiver_name ?? '–'} · {c.tx.booking_date}</span>
                        <Badge className={c.score >= 70 ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'bg-amber-500/15 text-amber-500 border-amber-500/30'}>
                          {c.score} %
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(Number(c.tx.amount), c.tx.currency)} · {c.allocations.map(a => a.invoice_number).filter(Boolean).join(', ') || 'ohne Rechnungszuordnung'}
                      </div>
                    </button>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setShowSearch(s => !s)}>
                    <Search className="w-3.5 h-3.5 mr-1" />Ursprüngliche Zahlung suchen
                  </Button>
                  {showSearch && (
                    <div className="grid sm:grid-cols-3 gap-2 rounded-md border border-border p-3">
                      {([
                        ['customerName', 'Kundenname'], ['invoiceNumber', 'Rechnungsnummer'], ['orderNumber', 'Auftragsnummer'],
                        ['iban', 'IBAN'], ['amount', 'Zahlungsbetrag'], ['bankReference', 'Bankreferenz'],
                        ['endToEnd', 'End-to-End-Referenz'], ['mandate', 'Mandatsreferenz'],
                      ] as const).map(([k, l]) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-xs">{l}</Label>
                          <Input value={(filter as any)[k]} onChange={e => setFilter({ ...filter, [k]: e.target.value })} />
                        </div>
                      ))}
                      <div className="space-y-1"><Label className="text-xs">Zahlungsdatum von</Label>
                        <Input type="date" value={filter.dateFrom} onChange={e => setFilter({ ...filter, dateFrom: e.target.value })} /></div>
                      <div className="space-y-1"><Label className="text-xs">bis</Label>
                        <Input type="date" value={filter.dateTo} onChange={e => setFilter({ ...filter, dateTo: e.target.value })} /></div>
                      <div className="flex items-end"><Button size="sm" onClick={runSearch} disabled={busy}>Suchen</Button></div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <Separator />

            {/* Rechnung / Aufteilung */}
            <section>
              <H>Rechnung und Aufteilung</H>
              {readOnly ? (
                confirmedAllocs.map(a => (
                  <div key={a.id} className="flex justify-between border-b border-border py-1 text-xs">
                    <span>{a.invoice_number ?? a.invoice_id ?? 'ohne Rechnung'}</span>
                    <span>{fmt(Number(a.allocated_amount), currency)}</span>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  {splits.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1 flex-1 min-w-40">
                        <Label className="text-xs">Rechnung / Rate</Label>
                        <Input value={s.invoice_number ?? ''} placeholder="Rechnungsnummer"
                          onChange={e => setSplits(splits.map((x, j) => j === i ? { ...x, invoice_number: e.target.value } : x))} />
                      </div>
                      <div className="space-y-1 w-40">
                        <Label className="text-xs">Betrag</Label>
                        <Input type="number" step="0.01" value={s.allocated_amount}
                          onChange={e => setSplits(splits.map((x, j) => j === i ? { ...x, allocated_amount: Number(e.target.value) } : x))} />
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setSplits(splits.filter((_, j) => j !== i))}>Entfernen</Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => setSplits([...splits, {
                      invoice_id: null, invoice_number: null, order_id: null, installment_id: null,
                      original_payment_allocation_id: null, allocated_amount: Number(Math.max(0, amount - splitSum).toFixed(2)),
                    }])}>
                      <Split className="w-3.5 h-3.5 mr-1" />Rücklastschrift aufteilen
                    </Button>
                    <span className={splitOk ? 'text-emerald-500 text-xs' : 'text-amber-500 text-xs'}>
                      Aufteilung {fmt(splitSum, currency)} von {fmt(amount, currency)}
                      {splitOk && !splitExact && ` – Differenz ${fmt(Math.abs(amount - splitSum), currency)} (Bankgebühren) akzeptiert`}
                      {!splitOk && ` – Abweichung bis ${fmt(splitTol, currency)} (Bankgebühren) zulässig`}
                    </span>
                  </div>
                </div>
              )}
            </section>

            <Separator />

            {/* Gebühren */}
            <section>
              <H>Gebühren</H>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Bankgebühr</Label>
                  <Input type="number" step="0.01" value={bankFee} disabled={readOnly} onChange={e => setBankFee(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">Sonstige Kosten</Label>
                  <Input type="number" step="0.01" value={additionalCosts} disabled={readOnly} onChange={e => setAdditionalCosts(Number(e.target.value))} /></div>
                <div className="space-y-1"><Label className="text-xs">Gebührenbetrag für den Kunden</Label>
                  <Input type="number" step="0.01" value={customerFee} disabled={readOnly || feeHandling === 'erlassen'} onChange={e => setCustomerFee(Number(e.target.value))} /></div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Behandlung der Gebühr</Label>
                  <select className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm" disabled={readOnly}
                    value={feeHandling} onChange={e => setFeeHandling(e.target.value as any)}>
                    <option value="intern">Gebühr nur intern erfassen</option>
                    <option value="weiterberechnen">Gebühr dem Kunden weiterberechnen (Nebenforderung)</option>
                    <option value="gebuehrenrechnung">Separate Gebührenrechnung erstellen</option>
                    <option value="erlassen">Gebühr erlassen</option>
                  </select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Interne Kostenstelle</Label>
                  <Input value={costCenter} disabled={readOnly} onChange={e => setCostCenter(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Buchungskonto</Label>
                  <Input value={bookingAccount} disabled={readOnly} onChange={e => setBookingAccount(e.target.value)} /></div>
                <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Bemerkung</Label>
                  <Textarea rows={2} value={note} disabled={readOnly} onChange={e => setNote(e.target.value)} /></div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Neue Kundenforderung: {fmt(amount + (feeHandling === 'erlassen' || feeHandling === 'intern' ? 0 : Number(customerFee || 0)), currency)}
                {' '}(Rücklastschrift {fmt(amount, currency)} + Gebühr {fmt(feeHandling === 'erlassen' || feeHandling === 'intern' ? 0 : Number(customerFee || 0), currency)})
              </p>
            </section>

            {!readOnly && (
              <>
                <Separator />
                <section className="space-y-2">
                  <H>Folgeaktionen</H>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={blockMandate} onChange={e => setBlockMandate(e.target.checked)} />SEPA-Lastschrift für diesen Kunden sperren</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={startReminder} onChange={e => setStartReminder(e.target.checked)} />Forderung in den Mahnprozess aufnehmen</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={createTask} onChange={e => setCreateTask(e.target.checked)} />Aufgabe für die Buchhaltung erstellen</label>
                  {rules && confidence < 70 && (
                    <p className="text-xs text-amber-500">Zuordnung unsicher – bitte die ursprüngliche Zahlung prüfen, bevor bestätigt wird.</p>
                  )}
                </section>
              </>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStatus('ungeklaert', 'Als ungeklärt zurückgestellt')} disabled={busy}>
                <PauseCircle className="w-3.5 h-3.5 mr-1" />Als ungeklärt zurückstellen
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStatus('bankfehler', 'Als Bankfehler markiert')} disabled={busy}>
                <Banknote className="w-3.5 h-3.5 mr-1" />Als Bankfehler markieren
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStatus('doppelt', 'Als doppelte Rücklastschrift markiert')} disabled={busy}>
                <Copy className="w-3.5 h-3.5 mr-1" />Doppelte Rücklastschrift
              </Button>
              <Button size="sm" onClick={doConfirm} disabled={busy || !splitOk}
                className={picked && confidence >= 70 ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                {picked && confidence >= 70 ? 'Rücklastschrift zuordnen und Rechnung wieder öffnen' : 'Rücklastschrift bestätigen'}
              </Button>
            </>
          )}
          {readOnly && rd?.status === 'bestaetigt' && isSuperAdmin && (
            <Button size="sm" variant="destructive" onClick={doCancel} disabled={busy}>
              <Undo2 className="w-3.5 h-3.5 mr-1" />Rücklastschrift-Zuordnung stornieren
            </Button>
          )}
          {rd && (
            <Button size="sm" variant="outline" onClick={doDunning} disabled={busy}>
              <Mail className="w-3.5 h-3.5 mr-1" />Mahnung mit Sperrankündigung senden
            </Button>
          )}
          {rd && (
            <Button size="sm" variant="outline" onClick={doDunningPdf} disabled={busy}>
              <FileText className="w-3.5 h-3.5 mr-1" />Mahnschreiben als PDF
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Bearbeitung abbrechen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">{children}</h4>;
}
function Row({ l, v }: { l: string; v: any }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="text-muted-foreground min-w-44 shrink-0">{l}</span>
      <span className="break-all">{v || '–'}</span>
    </div>
  );
}
