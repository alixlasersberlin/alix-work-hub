import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, Loader2, ExternalLink, X, Plus, Trash2 } from 'lucide-react';
import { nextNumber } from '@/lib/number-ranges';

type Props = {
  order: any;
  customer?: any;
  items?: any[];
  disabled?: boolean;
};

type LineItem = {
  name: string;
  description: string;
  quantity: number;
  rate: number;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
async function generateInvoiceNumber(source: string | null | undefined, caseNumber?: string | null) {
  const yr = new Date().getFullYear();
  const suffix = source === 'zoho_eu_2' ? '-AT' : '';
  const fallback = () => `RE-${yr}-${Math.floor(Math.random() * 90000 + 10000)}${suffix}`;
  const base = await nextNumber('invoice', fallback, { caseNumber: caseNumber ?? null });
  // AT-Suffix nur anhängen, wenn nicht schon enthalten (Fallback liefert es selbst)
  return suffix && !base.endsWith('-AT') ? `${base}${suffix}` : base;
}
function fmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatAddress(a: any): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  if (typeof a !== 'object') return String(a);
  const line1 = [a.attention, a.company_name].filter(Boolean).join(' · ');
  const street = [a.address, a.street, a.street2].filter(Boolean).join(', ');
  const cityLine = [[a.zip || a.postal_code, a.city].filter(Boolean).join(' '), a.state]
    .filter(Boolean).join(', ');
  return [line1, street, cityLine, a.country].filter(Boolean).join('\n');
}
function pickCity(a: any, fallback?: string): string {
  if (a && typeof a === 'object' && a.city) return String(a.city);
  return fallback || '';
}

export default function CreateInvoiceDialog({ order, customer, items, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [existingInvoice, setExistingInvoice] = useState<{ id: string; invoice_number: string | null } | null>(null);
  const [checking, setChecking] = useState(true);
  const savingRef = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const orderNumber: string | null = order?.order_number ?? null;
  const orderId: string | null = order?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderNumber && !orderId) { setChecking(false); return; }
      setChecking(true);
      let q = supabase.from('zoho_invoices').select('id, invoice_number, reference_number, raw_data').limit(1);
      if (orderNumber) q = q.eq('reference_number', orderNumber);
      const { data } = await q;
      let found: any = (data ?? [])[0] ?? null;
      if (!found && orderId) {
        const { data: d2 } = await supabase
          .from('zoho_invoices')
          .select('id, invoice_number, raw_data, reference_number')
          .contains('raw_data', { order_id: orderId } as any)
          .limit(1);
        found = (d2 ?? [])[0] ?? null;
      }
      if (!cancelled) {
        setExistingInvoice(found ? { id: found.id, invoice_number: found.invoice_number } : null);
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderNumber, orderId]);

  // Editable form fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 14));
  const [customerName, setCustomerName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [status, setStatus] = useState<'draft' | 'sent'>('sent');
  const [paymentStatus, setPaymentStatus] = useState('Offen');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState(19);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const openDialog = useCallback(async () => {
    if (disabled || createdId || existingInvoice) return;
    // Prefill
    const caseNo = order?.case_number ?? (order?.order_number ? String(order.order_number).replace(/^AB-/, '') : null);
    setInvoiceNumber(await generateInvoiceNumber(order?.source_system, caseNo));
    setInvoiceDate(todayISO());
    setDueDate(addDays(todayISO(), 14));
    const rawAddr =
      order?.billing_address ??
      customer?.billing_address ??
      order?.raw_data?.billing_address ??
      customer?.raw_data?.billing_address ??
      null;
    setCustomerName(
      customer?.company_name ||
      customer?.customer_name ||
      order?.customer_name ||
      (rawAddr && typeof rawAddr === 'object' ? rawAddr.attention || rawAddr.company_name : '') ||
      ''
    );
    setBillingAddress(formatAddress(rawAddr));
    setCity(pickCity(rawAddr, customer?.city || order?.city));
    setCurrency(order?.currency || 'EUR');
    setStatus('sent');
    setPaymentStatus('Offen');
    setNotes('');
    setTaxRate(order?.source_system === 'zoho_eu_2' ? 20 : 19);

    const source = Array.isArray(items) && items.length > 0
      ? items.map((it) => ({
          name: it?.item_name || it?.name || 'Position',
          description: it?.description || '',
          quantity: Number(it?.quantity ?? 1),
          rate: Number(it?.rate ?? it?.price ?? 0),
        }))
      : [{
          name: order?.order_number ? `Auftrag ${order.order_number}` : 'Rechnungsposition',
          description: '',
          quantity: 1,
          rate: Number(order?.total_amount ?? order?.total ?? 0),
        }];
    setLineItems(source);
    setOpen(true);
  }, [createdId, customer, disabled, items, order]);

  const closeDialog = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const subtotal = useMemo(
    () => lineItems.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.rate || 0), 0),
    [lineItems]
  );
  const taxAmount = useMemo(() => subtotal * (Number(taxRate) || 0) / 100, [subtotal, taxRate]);
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setLineItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setLineItems((prev) => [...prev, { name: '', description: '', quantity: 1, rate: 0 }]);
  const removeItem = (idx: number) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCreate = async () => {
    if (savingRef.current) return;
    if (existingInvoice) {
      toast.error(`Für diesen Auftrag existiert bereits Rechnung ${existingInvoice.invoice_number ?? ''}`);
      setOpen(false);
      return;
    }
    // Re-check DB right before insert to avoid races
    if (orderNumber) {
      const { data: dup } = await supabase
        .from('zoho_invoices')
        .select('id, invoice_number')
        .eq('reference_number', orderNumber)
        .limit(1);
      const existing = (dup ?? [])[0];
      if (existing) {
        setExistingInvoice({ id: existing.id, invoice_number: existing.invoice_number });
        toast.error(`Für diesen Auftrag existiert bereits Rechnung ${existing.invoice_number ?? ''}`);
        setOpen(false);
        return;
      }
    }
    if (!invoiceNumber.trim()) { toast.error('Rechnungsnummer fehlt'); return; }
    if (total <= 0) { toast.error('Rechnungsbetrag muss > 0 sein'); return; }

    savingRef.current = true;
    setSaving(true);

    const payload = {
      source_system: order?.source_system || 'zoho_eu_1',
      zoho_invoice_id: `manual-${crypto.randomUUID()}`,
      invoice_number: invoiceNumber.trim(),
      reference_number: order?.order_number ?? null,
      customer_id: order?.zoho_customer_id ?? customer?.zoho_customer_id ?? null,
      customer_name: customerName || null,
      city: city || null,
      billing_address: billingAddress || null,
      invoice_date: invoiceDate,
      due_date: dueDate,
      total: Number(total.toFixed(2)),
      balance: Number(total.toFixed(2)),
      currency,
      status,
      payment_status: paymentStatus,
      raw_data: {
        created_from: 'order',
        order_id: order?.id,
        order_number: order?.order_number,
        created_at: new Date().toISOString(),
        subtotal: Number(subtotal.toFixed(2)),
        tax_rate: Number(taxRate),
        tax_amount: Number(taxAmount.toFixed(2)),
        notes,
        line_items: lineItems.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          amount: Number((Number(it.quantity) * Number(it.rate)).toFixed(2)),
        })),
      } as any,
      synced_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('zoho_invoices')
      .insert(payload as any)
      .select('id')
      .single();

    savingRef.current = false;
    setSaving(false);

    if (error) {
      toast.error('Rechnung konnte nicht erstellt werden: ' + error.message);
      return;
    }
    setCreatedId(data?.id ?? null);
    if (status === 'draft') {
      toast.success(`Entwurf ${invoiceNumber} gespeichert (keine Übergabe an Finance)`);
    } else {
      toast.success(`Rechnung ${invoiceNumber} erstellt und festgeschrieben`);
    }
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          type="button"
          disabled={disabled || !!createdId || !!existingInvoice || checking}
          onClick={openDialog}
          className="gold-gradient text-primary-foreground"
          title={existingInvoice ? `Für diesen Auftrag existiert bereits Rechnung ${existingInvoice.invoice_number ?? ''}` : undefined}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          {existingInvoice ? `Rechnung ${existingInvoice.invoice_number ?? ''} existiert` : createdId ? 'Rechnung erstellt' : 'Rechnung erstellen'}
        </Button>
        {(createdId || existingInvoice) && (
          <Link to="/finance/rechnungen" className="inline-flex items-center text-sm text-primary hover:underline">
            Zu Rechnungen <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </Link>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="create-invoice-title"
        className="fixed inset-0 z-[2147483647] m-auto w-[min(960px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-background/85"
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          closeDialog();
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeDialog();
        }}
      >
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 id="create-invoice-title" className="text-lg font-display font-bold">Rechnung erstellen</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  aus Auftrag {order?.order_number ?? ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="p-2 rounded-md hover:bg-secondary text-muted-foreground"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Rechnungsnr.</Label>
                  <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-1 bg-secondary border-border font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Rechnungsdatum</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs">Fällig am</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Kunde</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs">Ort</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Rechnungsadresse</Label>
                  <Textarea value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} rows={2} className="mt-1 bg-secondary border-border" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Positionen</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Position
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start p-2 rounded-lg border border-border bg-secondary/40">
                      <div className="col-span-12 md:col-span-5">
                        <Input placeholder="Bezeichnung" value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} className="bg-secondary border-border" />
                        <Input placeholder="Beschreibung (optional)" value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} className="mt-1 bg-secondary border-border text-xs" />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input type="number" step="1" placeholder="Menge" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} className="bg-secondary border-border font-mono" />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <Input type="number" step="0.01" placeholder="Preis" value={it.rate} onChange={(e) => updateItem(idx, { rate: Number(e.target.value) })} className="bg-secondary border-border font-mono" />
                      </div>
                      <div className="col-span-3 md:col-span-2 text-right text-sm font-mono pt-2">
                        {fmt(Number(it.quantity || 0) * Number(it.rate || 0))}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(idx)} disabled={lineItems.length <= 1}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Währung</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="mt-1 bg-secondary border-border font-mono" />
                </div>
                <div>
                  <Label className="text-xs">USt.-Satz (%)</Label>
                  <Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="mt-1 bg-secondary border-border font-mono" />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                    <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Entwurf</SelectItem>
                      <SelectItem value="sent">Festgeschrieben (versendet)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs">Notiz (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 bg-secondary border-border" />
              </div>

              <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm font-mono space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Zwischensumme</span><span>{fmt(subtotal)} {currency}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">USt. ({taxRate}%)</span><span>{fmt(taxAmount)} {currency}</span></div>
                <div className="flex justify-between border-t border-border pt-1 mt-1 font-bold text-base"><span>Gesamt</span><span>{fmt(total)} {currency}</span></div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 px-6 py-4 border-t border-border">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>Abbrechen</Button>
              <Button type="button" onClick={handleCreate} disabled={saving} className="gold-gradient text-primary-foreground">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {status === 'draft' ? 'Als Entwurf speichern' : 'Rechnung festschreiben'}
              </Button>
            </div>
          </div>
      </dialog>
    </>
  );
}
