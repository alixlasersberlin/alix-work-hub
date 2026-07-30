import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { postPaymentToJournal } from '@/lib/finance/journal';

export type BookableInvoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  invoice_date: string | null;
};

type Props = {
  invoice: BookableInvoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onBooked?: () => void;
};

export function RecurringInvoiceBookDialog({ invoice, open, onOpenChange, onBooked }: Props) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('sepa');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setAmount(Number(invoice.balance ?? invoice.total ?? 0));
      setDate(new Date().toISOString().slice(0, 10));
      setNote('');
    }
  }, [invoice]);

  if (!invoice) return null;

  async function book() {
    if (!invoice) return;
    if (!amount || amount <= 0) {
      toast({ title: 'Betrag ungültig', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const res = await postPaymentToJournal({
      customer_id: invoice.customer_id,
      invoice_number: invoice.invoice_number,
      reference: invoice.invoice_number,
      amount_gross: amount,
      booking_date: date,
      description: note || `Zahlung wiederkehrende Rechnung ${invoice.invoice_number ?? ''} · ${invoice.customer_name ?? ''}`.trim(),
      source_table: 'zoho_recurring_invoices',
      source_id: `${invoice.id}:${date}:${amount}`,
      vorgang: 'Zahlung',
      payment_method: method,
    });
    if (!res.ok) {
      setSaving(false);
      toast({ title: 'Buchung fehlgeschlagen', description: res.error, variant: 'destructive' });
      return;
    }

    const newBalance = Math.max(0, Number(invoice.balance ?? invoice.total ?? 0) - amount);
    const { error } = await supabase
      .from('zoho_recurring_invoices')
      .update({
        balance: newBalance,
        last_payment_date: date,
        status: newBalance === 0 ? 'paid' : 'partially_paid',
      } as any)
      .eq('id', invoice.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Journal gebucht, Rechnung nicht aktualisiert', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Zahlung gebucht', description: `${invoice.invoice_number ?? ''} · offen: ${newBalance.toFixed(2)}` });
    }
    onOpenChange(false);
    onBooked?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Zahlung buchen · {invoice.invoice_number ?? '—'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Betrag ({invoice.currency || 'EUR'})</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Buchungsdatum</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Zahlungsart</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sepa">SEPA-Lastschrift</SelectItem>
                <SelectItem value="ueberweisung">Überweisung</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="karte">Karte</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Notiz</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={book} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Buchen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
