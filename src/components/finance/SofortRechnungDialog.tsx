import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { nextNumber } from '@/lib/number-ranges';

type LineItem = { name: string; description: string; quantity: number; rate: number };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId?: string | null;
  customerName: string;
  city?: string | null;
  tenantId?: string | null;
  onCreated?: () => void;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function genNumber(kind: 'deposit' | 'invoice') {
  const yr = new Date().getFullYear();
  const rnd = Math.floor(Math.random() * 90000 + 10000);
  const fallback = () => (kind === 'deposit' ? `AZ-${yr}-${rnd}` : `RE-${yr}-${rnd}`);
  return nextNumber(kind === 'deposit' ? 'deposit' : 'invoice', fallback);
}

/**
 * Sofort-Rechnung: erzeugt eine festgeschriebene Rechnung bzw. Anzahlungs-
 * rechnung und ordnet sie direkt dem Kundenkonto zu (ohne Auftragsbezug).
 */
export function SofortRechnungDialog({
  open, onOpenChange, customerId, customerName, city, tenantId, onCreated,
}: Props) {
  const [mode, setMode] = useState<'invoice' | 'deposit'>('invoice');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 14));
  const [currency, setCurrency] = useState('EUR');
  const [taxRate, setTaxRate] = useState(19);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { name: 'Leistung', description: '', quantity: 1, rate: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0),
    [items],
  );
  const taxAmount = useMemo(() => subtotal * (Number(taxRate) || 0) / 100, [subtotal, taxRate]);
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const update = (i: number, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const create = async () => {
    if (total <= 0) { toast.error('Betrag muss größer als 0 sein'); return; }
    setSaving(true);
    try {
      const number = await genNumber(mode);
      const payload: any = {
        source_system: 'zoho_eu_1',
        zoho_invoice_id: `manual-${crypto.randomUUID()}`,
        invoice_number: number,
        reference_number: null,
        customer_id: customerId ?? null,
        customer_name: customerName || null,
        city: city || null,
        invoice_date: invoiceDate,
        due_date: dueDate,
        total: Number(total.toFixed(2)),
        balance: Number(total.toFixed(2)),
        currency,
        accounting_region: currency.toUpperCase() === 'CHF' ? 'CH' : 'EU',
        status: 'sent',
        payment_status: 'Offen',
        is_deposit: mode === 'deposit',
        tenant_id: tenantId ?? null,
        raw_data: {
          created_from: 'sofort_rechnung',
          finalized: true,
          is_draft: false,
          created_at: new Date().toISOString(),
          subtotal: Number(subtotal.toFixed(2)),
          tax_rate: Number(taxRate),
          tax_amount: Number(taxAmount.toFixed(2)),
          notes,
          line_items: items.map((it) => ({
            ...it,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
            amount: Number(((Number(it.quantity) || 0) * (Number(it.rate) || 0)).toFixed(2)),
          })),
        },
        synced_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('zoho_invoices').insert(payload as any);
      if (error) throw error;
      toast.success(
        `${mode === 'deposit' ? 'Anzahlungsrechnung' : 'Rechnung'} ${number} erstellt, festgeschrieben und ${customerName} zugeordnet`,
      );
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error('Sofort-Rechnung fehlgeschlagen: ' + (e?.message ?? 'unbekannter Fehler'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Sofort Rechnung · {customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'invoice' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('invoice')}
          >
            Als Rechnung
          </Button>
          <Button
            type="button"
            variant={mode === 'deposit' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('deposit')}
          >
            Als Anzahlung
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Rechnungsdatum</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => { setInvoiceDate(e.target.value); setDueDate(addDays(e.target.value, 14)); }} />
          </div>
          <div>
            <Label className="text-xs">Fällig am</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Währung</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="CHF">CHF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">USt. %</Label>
            <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Positionen</Label>
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-5" placeholder="Bezeichnung" value={it.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input className="col-span-3" placeholder="Beschreibung" value={it.description} onChange={(e) => update(i, { description: e.target.value })} />
              <Input className="col-span-1" type="number" value={it.quantity} onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
              <Input className="col-span-2" type="number" step="0.01" value={it.rate} onChange={(e) => update(i, { rate: Number(e.target.value) })} />
              <Button type="button" size="icon" variant="ghost" className="col-span-1" onClick={() => setItems((p) => p.filter((_, x) => x !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, { name: '', description: '', quantity: 1, rate: 0 }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Position
          </Button>
        </div>

        <div>
          <Label className="text-xs">Notiz</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="text-right text-sm">
          Netto: {fmt(subtotal)} {currency} · USt.: {fmt(taxAmount)} {currency} ·{' '}
          <span className="font-semibold">Gesamt: {fmt(total)} {currency}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={create} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            {mode === 'deposit' ? 'Anzahlung festschreiben' : 'Rechnung festschreiben'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
