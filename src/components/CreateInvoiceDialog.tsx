import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileText, Loader2, ExternalLink } from 'lucide-react';

type Props = {
  order: any;
  customer?: any;
  items?: any[];
  disabled?: boolean;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function generateInvoiceNumber(source: string | null | undefined) {
  const yr = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000 + 10000);
  const suffix = source === 'zoho_eu_2' ? '-AT' : '';
  return `RE-${yr}-${rand}${suffix}`;
}

export default function CreateInvoiceDialog({ order, customer, items, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const defaultTotal = useMemo(() => {
    const t = Number(order?.total_amount ?? order?.total ?? 0);
    if (t > 0) return t;
    if (Array.isArray(items)) {
      return items.reduce((s, it) => s + Number(it?.total ?? (Number(it?.quantity ?? 0) * Number(it?.rate ?? 0))), 0);
    }
    return 0;
  }, [order, items]);

  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber(order?.source_system));
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 14));
  const [total, setTotal] = useState(String(defaultTotal || ''));

  const handleCreate = async () => {
    if (!invoiceNumber.trim()) { toast.error('Rechnungsnummer fehlt'); return; }
    const totalNum = Number(total);
    if (!Number.isFinite(totalNum) || totalNum <= 0) { toast.error('Ungültiger Betrag'); return; }

    setSaving(true);
    const payload = {
      source_system: order?.source_system || 'zoho_eu_1',
      zoho_invoice_id: `manual-${crypto.randomUUID()}`,
      invoice_number: invoiceNumber.trim(),
      reference_number: order?.order_number ?? null,
      customer_id: order?.zoho_customer_id ?? customer?.zoho_customer_id ?? null,
      customer_name: customer?.company_name || customer?.customer_name || order?.customer_name || null,
      city: customer?.city ?? null,
      billing_address: customer?.billing_address ?? null,
      invoice_date: invoiceDate,
      due_date: dueDate,
      total: totalNum,
      balance: totalNum,
      currency: order?.currency || 'EUR',
      status: 'sent',
      payment_status: 'Offen',
      raw_data: {
        created_from: 'order',
        order_id: order?.id,
        order_number: order?.order_number,
        created_at: new Date().toISOString(),
      } as any,
      synced_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('zoho_invoices')
      .insert(payload as any)
      .select('id')
      .single();

    setSaving(false);
    if (error) {
      toast.error('Rechnung konnte nicht erstellt werden: ' + error.message);
      return;
    }
    setCreatedId(data?.id ?? null);
    toast.success(`Rechnung ${invoiceNumber} erstellt`);
  };

  return (
    <>
      <Button
        size="sm"
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="gold-gradient text-primary-foreground"
      >
        <FileText className="w-4 h-4 mr-1.5" /> Rechnung erstellen
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreatedId(null); }}>
        <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rechnung erstellen</DialogTitle>
        </DialogHeader>

        {createdId ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
              Rechnung <b>{invoiceNumber}</b> wurde in Finance &amp; Controlling festgeschrieben.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Schließen</Button>
              <Link to="/finance/rechnungen">
                <Button className="gold-gradient text-primary-foreground">
                  Zu Rechnungen <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <Label className="text-muted-foreground">Kunde</Label>
                  <div className="font-medium truncate">{customer?.company_name || customer?.customer_name || order?.customer_name || '–'}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Auftrag</Label>
                  <div className="font-mono">{order?.order_number || '–'}</div>
                </div>
              </div>

              <div>
                <Label>Rechnungsnummer</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Rechnungsdatum</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div>
                  <Label>Fällig am</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Betrag ({order?.currency || 'EUR'})</Label>
                <Input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={handleCreate} disabled={saving} className="gold-gradient text-primary-foreground">
                {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Rechnung festschreiben
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
