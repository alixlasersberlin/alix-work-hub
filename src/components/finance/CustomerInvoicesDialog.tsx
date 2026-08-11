import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InvoicePdfDialog, type PdfInvoiceRef } from '@/components/finance/InvoicePdfDialog';

type Row = {
  id: string;
  zoho_invoice_id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  status: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  source_system: string;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId?: string | null;
  customerName?: string | null;
}

const fmt = (n?: number | null, c?: string | null) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n ?? 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

export function CustomerInvoicesDialog({ open, onOpenChange, customerId, customerName }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdf, setPdf] = useState<PdfInvoiceRef | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const cols = 'id, zoho_invoice_id, invoice_number, invoice_date, due_date, status, total, balance, currency, source_system';
      let q = supabase.from('zoho_invoices').select(cols).order('invoice_date', { ascending: false }).limit(300);
      if (customerId && /^[0-9a-f-]{36}$/i.test(customerId)) q = q.eq('customer_id', customerId);
      else if (customerName) q = q.ilike('customer_name', `%${customerName}%`);
      const { data } = await q;
      if (!cancelled) { setRows((data ?? []) as Row[]); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, customerId, customerName]);

  const openSum = rows.reduce((s, r) => s + (r.balance ?? 0), 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Rechnungen · {customerName || '—'}
            </DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-2">
            {rows.length} Rechnungen · Offen gesamt: <span className="font-semibold text-primary">{fmt(openSum, rows[0]?.currency)}</span>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border border-border">
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Keine Rechnungen gefunden.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2">Nummer</th>
                    <th className="text-left px-3 py-2">Datum</th>
                    <th className="text-left px-3 py-2">Fällig</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2">Betrag</th>
                    <th className="text-right px-3 py-2">Offen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className={i % 2 ? 'bg-muted/20' : ''}>
                      <td className="px-3 py-2">
                        <button
                          className="text-primary hover:underline font-medium"
                          onClick={() => setPdf({
                            zoho_invoice_id: r.zoho_invoice_id,
                            invoice_number: r.invoice_number,
                            source_system: r.source_system,
                          })}
                        >
                          {r.invoice_number || '—'}
                        </button>
                      </td>
                      <td className="px-3 py-2">{fmtDate(r.invoice_date)}</td>
                      <td className="px-3 py-2">{fmtDate(r.due_date)}</td>
                      <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{r.status || '—'}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(r.total, r.currency)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(r.balance, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <InvoicePdfDialog invoice={pdf} open={!!pdf} onOpenChange={(v) => !v && setPdf(null)} />
    </>
  );
}
