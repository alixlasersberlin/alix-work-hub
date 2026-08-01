import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { postPaymentToJournal } from '@/lib/finance/journal';

export type DeviceLock = {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  customer_id: string | null;
  customer_number: string | null;
  customer_name: string | null;
  amount: number | null;
  currency: string | null;
  return_date: string | null;
  return_reason: string | null;
  lock_note: string | null;
  status: string | null;
};

const STATUS_OPTIONS = ['entwurf', 'vorgeschlagen', 'aktiv', 'fehler', 'aufgehoben'];

export function DeviceLockEditDialog({
  lock, open, onOpenChange, onSaved,
}: { lock: DeviceLock | null; open: boolean; onOpenChange: (v: boolean) => void; onSaved?: () => void }) {
  const [form, setForm] = useState<Partial<DeviceLock>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (lock) setForm({ ...lock }); }, [lock]);

  if (!lock) return null;

  async function save() {
    if (!lock) return;
    setSaving(true);
    const { error } = await supabase
      .from('device_locks' as any)
      .update({
        invoice_number: form.invoice_number || null,
        customer_number: form.customer_number || null,
        customer_name: form.customer_name || null,
        amount: form.amount != null && form.amount !== ('' as any) ? Number(form.amount) : null,
        return_date: form.return_date || null,
        return_reason: form.return_reason || null,
        lock_note: form.lock_note || null,
        status: form.status || null,
      } as any)
      .eq('id', lock.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Gerätesperre gespeichert');
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerätesperre bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Rechnungsnummer</Label>
              <Input value={form.invoice_number ?? ''} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Kd.-Nr.</Label>
              <Input value={form.customer_number ?? ''} onChange={(e) => setForm({ ...form, customer_number: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Kunde</Label>
            <Input value={form.customer_name ?? ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Betrag</Label>
              <Input type="number" step="0.01" value={form.amount ?? ''} onChange={(e) => setForm({ ...form, amount: e.target.value as any })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Rückl.-Datum</Label>
              <Input type="date" value={form.return_date ?? ''} onChange={(e) => setForm({ ...form, return_date: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? ''} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Rückl.-Grund</Label>
            <Input value={form.return_reason ?? ''} onChange={(e) => setForm({ ...form, return_reason: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Sperrvermerk</Label>
            <Textarea rows={3} value={form.lock_note ?? ''} onChange={(e) => setForm({ ...form, lock_note: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeviceLockBookDialog({
  lock, open, onOpenChange, onBooked,
}: { lock: DeviceLock | null; open: boolean; onOpenChange: (v: boolean) => void; onBooked?: () => void }) {
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('ueberweisung');
  const [note, setNote] = useState('');
  const [release, setRelease] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lock) {
      setAmount(Number(lock.amount ?? 0));
      setDate(new Date().toISOString().slice(0, 10));
      setNote('');
      setRelease(true);
    }
  }, [lock]);

  if (!lock) return null;

  async function book() {
    if (!lock) return;
    if (!amount || amount <= 0) return toast.error('Betrag ungültig');
    setSaving(true);

    const res = await postPaymentToJournal({
      customer_id: null,
      invoice_number: lock.invoice_number,
      reference: lock.invoice_number,
      amount_gross: amount,
      booking_date: date,
      description: note || `Zahlung Gerätesperre ${lock.invoice_number ?? ''} · ${lock.customer_name ?? ''}`.trim(),
      source_table: 'device_locks',
      source_id: `${lock.id}:${date}:${amount}`,
      vorgang: 'Zahlung',
      payment_method: method,
    });
    if (!res.ok) {
      setSaving(false);
      return toast.error(`Buchung fehlgeschlagen: ${res.error}`);
    }

    // Rechnung ausgleichen (löst per Trigger die Sperre automatisch auf)
    if (lock.invoice_id) {
      await supabase
        .from('zoho_invoices' as any)
        .update({ balance: 0, payment_status: 'paid', status: 'paid' } as any)
        .eq('id', lock.invoice_id);
    }

    if (release) {
      const { data: u } = await supabase.auth.getUser();
      await supabase
        .from('device_locks' as any)
        .update({
          status: 'aufgehoben',
          released_at: new Date().toISOString(),
          released_by: u?.user?.id ?? null,
          lock_note: `${lock.lock_note ?? ''}\nZahlung gebucht am ${date} (${amount.toFixed(2)} ${lock.currency || 'EUR'})`.trim(),
        } as any)
        .eq('id', lock.id);
    }

    setSaving(false);
    toast.success('Rechnung gebucht');
    onOpenChange(false);
    onBooked?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rechnung buchen · {lock.invoice_number ?? '—'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Betrag ({lock.currency || 'EUR'})</Label>
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
                <SelectItem value="ueberweisung">Überweisung</SelectItem>
                <SelectItem value="sepa">SEPA-Lastschrift</SelectItem>
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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} />
            Sperre nach Buchung aufheben
          </label>
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
