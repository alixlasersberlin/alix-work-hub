import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  const defaultTotal = useMemo(() => {
    const t = Number(order?.total_amount ?? order?.total ?? 0);
    if (t > 0) return t;
    if (Array.isArray(items)) {
      return items.reduce((s, it) => s + Number(it?.total ?? (Number(it?.quantity ?? 0) * Number(it?.rate ?? 0))), 0);
    }
    return 0;
  }, [order, items]);

  const invoiceNumber = useMemo(() => generateInvoiceNumber(order?.source_system), [order?.source_system]);
  const invoiceDate = useMemo(() => todayISO(), []);
  const dueDate = useMemo(() => addDays(todayISO(), 14), []);

  useEffect(() => {
    document.body.style.pointerEvents = 'auto';
  }, []);

  const handleCreate = useCallback(async () => {
    if (disabled || savingRef.current || createdId) return;
    const totalNum = Number(defaultTotal);
    if (!Number.isFinite(totalNum) || totalNum <= 0) { toast.error('Ungültiger Betrag'); return; }

    savingRef.current = true;
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

    savingRef.current = false;
    setSaving(false);
    if (error) {
      toast.error('Rechnung konnte nicht erstellt werden: ' + error.message);
      return;
    }
    setCreatedId(data?.id ?? null);
    toast.success(`Rechnung ${invoiceNumber} erstellt und festgeschrieben`);
  }, [createdId, customer, defaultTotal, disabled, dueDate, invoiceDate, invoiceNumber, order]);

  useEffect(() => {
    const forceCreate = (event: Event) => {
      const target = event.target as Element | null;
      if (!target?.closest('[data-invoice-create-trigger="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) event.stopImmediatePropagation();
      void handleCreate();
    };
    document.addEventListener('click', forceCreate, true);
    return () => document.removeEventListener('click', forceCreate, true);
  }, [handleCreate]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        type="button"
        disabled={disabled || saving || !!createdId}
        onClick={handleCreate}
        data-invoice-create-trigger="true"
        className="gold-gradient text-primary-foreground"
      >
        {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
        {createdId ? 'Rechnung erstellt' : saving ? 'Rechnung wird erstellt' : 'Rechnung erstellen'}
      </Button>

      {createdId && (
        <Link to="/finance/rechnungen" className="inline-flex items-center text-sm text-primary hover:underline">
          Zu Rechnungen <ExternalLink className="w-3.5 h-3.5 ml-1" />
        </Link>
      )}
    </div>
  );
}
