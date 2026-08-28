import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createManualReturnDebit, confirmReturnDebit, loadReturnRules,
  RETURN_CODES, type ReturnRules,
} from '@/lib/bank/returnDebit';

export type ReturnDebitInvoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  accounting_region?: string | null;
};

const fmt = (n: number, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur || 'EUR' }).format(n || 0);

export function InvoiceReturnDebitDialog({
  invoice, open, onOpenChange, onDone,
}: {
  invoice: ReturnDebitInvoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const [rules, setRules] = useState<ReturnRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(0);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [code, setCode] = useState<string>('AM04');
  const [bankFee, setBankFee] = useState(8);
  const [customerFee, setCustomerFee] = useState(8);
  const [chargeCustomer, setChargeCustomer] = useState(true);
  const [blockMandate, setBlockMandate] = useState(true);
  const [startReminder, setStartReminder] = useState(true);
  const [note, setNote] = useState('');

  const currency = invoice?.currency ?? 'EUR';
  const area: 'EU' | 'CH' = (invoice?.accounting_region === 'CH' ? 'CH' : 'EU');

  useEffect(() => {
    if (!open || !invoice) return;
    const paid = Math.max(0, Number(invoice.total ?? 0) - Number(invoice.balance ?? 0));
    setAmount(paid > 0 ? paid : Math.abs(Number(invoice.total ?? 0)));
    setBookingDate(new Date().toISOString().slice(0, 10));
    setNote('');
    (async () => {
      try {
        const cfg = await loadReturnRules();
        setRules(cfg);
        setBankFee(cfg.defaultBankFee);
        setCustomerFee(cfg.defaultCustomerFee);
        setChargeCustomer(cfg.chargeCustomerByDefault);
      } catch { /* Defaults behalten */ }
    })();
  }, [open, invoice?.id]);

  const submit = async () => {
    if (!invoice) return;
    if (!(amount > 0)) { toast.error('Bitte einen Betrag > 0 erfassen.'); return; }
    setBusy(true);
    try {
      const { rd, tx } = await createManualReturnDebit({
        area,
        bookingDate,
        amount,
        currency,
        returnCode: code || null,
        returnReason: code ? RETURN_CODES[code] ?? null : null,
        bankFee,
        customerFee,
        chargeCustomer,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        note: note || null,
      });

      const res = await confirmReturnDebit({
        rd, tx,
        originalPaymentTxId: null,
        customerId: invoice.customer_id,
        allocations: [{
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          allocated_amount: amount,
        }],
        bankFee,
        additionalCosts: 0,
        chargeCustomer,
        customerFee,
        feeHandling: chargeCustomer ? 'gebuehrenrechnung' : 'intern',
        note: note || null,
        blockMandate,
        startReminder,
        createTask: true,
      });

      toast.success(
        `Rücklastschrift gebucht${res.feeInvoice ? ` · Gebührenrechnung ${res.feeInvoice.invoiceNumber}` : ''}`,
      );
      (res.warnings ?? []).forEach((w: string) => toast.warning(w));
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Rücklastschrift konnte nicht gebucht werden.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-destructive" />
            Rücklastschrift · {invoice?.invoice_number ?? '—'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Die Zahlung wird storniert (Gegenbuchung), die Rechnung wieder geöffnet, Gebühren berechnet
            und der Kunde erscheint in den Gerätesperren.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Betrag ({currency})</Label>
              <Input type="number" step="0.01" value={amount}
                onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Rückgabedatum</Label>
              <Input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Rückgabegrund</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger><SelectValue placeholder="Grund wählen" /></SelectTrigger>
              <SelectContent>
                {Object.entries(RETURN_CODES).map(([c, t]) => (
                  <SelectItem key={c} value={c}>{c} · {t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bankgebühr</Label>
              <Input type="number" step="0.01" value={bankFee} onChange={(e) => setBankFee(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Bearbeitungsgebühr Kunde</Label>
              <Input type="number" step="0.01" value={customerFee} onChange={(e) => setCustomerFee(Number(e.target.value))} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={chargeCustomer} onCheckedChange={(v) => setChargeCustomer(v === true)} />
            Gebühren dem Kunden berechnen (Gebührenrechnung erstellen &amp; versenden)
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={blockMandate} onCheckedChange={(v) => setBlockMandate(v === true)} />
            SEPA-Lastschriftmandat sperren
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={startReminder} onCheckedChange={(v) => setStartReminder(v === true)} />
            Mahnung mit Sperrankündigung versenden
          </label>

          <div>
            <Label className="text-xs">Notiz</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <div className="text-xs text-muted-foreground">
            Gesamtforderung nach Buchung: <span className="font-semibold text-foreground">
              {fmt(amount + bankFee + (chargeCustomer ? customerFee : 0), currency)}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Abbrechen</Button>
          <Button variant="destructive" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
            Rücklastschrift buchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InvoiceReturnDebitDialog;
