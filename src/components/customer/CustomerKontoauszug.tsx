import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, FileDown, Eye, Wallet } from 'lucide-react';
import { EmptyState } from '@/components/infinity/EmptyState';
import { generateKontoauszugPdf, type KontoauszugItem } from '@/lib/finance/kontoauszug-pdf';

type Props = {
  customerId: string;
  externalCustomerId?: string | null;
  customerName?: string | null;
  customerNumber?: string | null;
  customerAddress?: string | null;
};

const money = (n?: number | null, c?: string | null) =>
  Number(n ?? 0).toLocaleString('de-DE', { style: 'currency', currency: c || 'EUR' });

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('de-DE');
};

const overdueDays = (due?: string | null) => {
  if (!due) return 0;
  const dt = new Date(`${String(due).slice(0, 10)}T00:00:00`);
  if (isNaN(dt.getTime())) return 0;
  const diff = Math.floor((Date.now() - dt.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
};

/** Kontoauszug: alle offenen Posten des Kunden mit Gesamtsaldo, PDF-Vorschau und Download. */
export default function CustomerKontoauszug({
  customerId,
  externalCustomerId,
  customerName,
  customerNumber,
  customerAddress,
}: Props) {
  const [items, setItems] = useState<KontoauszugItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ext = externalCustomerId || null;
      const name = customerName || null;

      const invQ = supabase
        .from('zoho_invoices')
        .select('invoice_number, invoice_date, due_date, total, balance, status, payment_status, currency')
        .order('invoice_date', { ascending: true })
        .limit(500);

      const unpaidQ = supabase
        .from('zoho_unpaid_invoices')
        .select('invoice_number, invoice_date, due_date, total, balance, status, currency_code')
        .order('invoice_date', { ascending: true })
        .limit(500);

      const [invRes, unpaidRes] = await Promise.all([
        ext ? invQ.eq('customer_id', ext) : name ? invQ.eq('customer_name', name) : invQ.eq('customer_id', '__none__'),
        name ? unpaidQ.eq('customer_name', name) : unpaidQ.eq('customer_name', '__none__'),
      ]);

      const byNumber = new Map<string, KontoauszugItem>();

      (invRes.data ?? []).forEach((r: any) => {
        const balance = r.balance != null ? Number(r.balance) : Number(r.total ?? 0);
        const status = String(r.payment_status || r.status || '').toLowerCase();
        const settled = status === 'paid' || status === 'void' || status === 'draft';
        if (settled || balance <= 0) return;
        byNumber.set(r.invoice_number, {
          invoice_number: r.invoice_number,
          invoice_date: r.invoice_date,
          due_date: r.due_date,
          total: r.total,
          balance,
          status: r.payment_status || r.status,
          currency: r.currency,
        });
      });

      (unpaidRes.data ?? []).forEach((r: any) => {
        if (byNumber.has(r.invoice_number)) return;
        const balance = r.balance != null ? Number(r.balance) : Number(r.total ?? 0);
        if (balance <= 0) return;
        byNumber.set(r.invoice_number, {
          invoice_number: r.invoice_number,
          invoice_date: r.invoice_date,
          due_date: r.due_date,
          total: r.total,
          balance,
          status: r.status,
          currency: r.currency_code,
        });
      });

      const list = [...byNumber.values()].sort(
        (a, b) => new Date(a.invoice_date || 0).getTime() - new Date(b.invoice_date || 0).getTime(),
      );
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, externalCustomerId, customerName]);

  const currency = items[0]?.currency || 'EUR';
  const sums = useMemo(() => {
    const total = items.reduce((s, i) => s + Number(i.total ?? 0), 0);
    const openSum = items.reduce((s, i) => s + Number(i.balance ?? i.total ?? 0), 0);
    const overdue = items
      .filter((i) => overdueDays(i.due_date) > 0)
      .reduce((s, i) => s + Number(i.balance ?? i.total ?? 0), 0);
    return { total, openSum, overdue };
  }, [items]);

  const buildDoc = () =>
    generateKontoauszugPdf({
      customerName: customerName || 'Kunde',
      customerAddress,
      customerNumber,
      currency,
      items,
    });

  const preview = () => {
    const doc = buildDoc();
    const url = doc.output('bloburl') as unknown as string;
    setPdfUrl(String(url));
    setOpen(true);
  };

  const download = () => {
    const doc = buildDoc();
    doc.save(`Kontoauszug_${(customerName || 'Kunde').replace(/[^\w-]+/g, '_')}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[180px]">
          <div className="text-xs text-muted-foreground">Offener Gesamtsaldo</div>
          <div className="text-2xl font-bold text-foreground">{money(sums.openSum, currency)}</div>
        </div>
        <div className="min-w-[150px]">
          <div className="text-xs text-muted-foreground">Rechnungsbetrag gesamt</div>
          <div className="text-lg font-semibold">{money(sums.total, currency)}</div>
        </div>
        <div className="min-w-[150px]">
          <div className="text-xs text-muted-foreground">davon überfällig</div>
          <div className="text-lg font-semibold text-destructive">{money(sums.overdue, currency)}</div>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={preview} disabled={!items.length}>
            <Eye className="w-4 h-4 mr-1.5" /> Vorschau
          </Button>
          <Button size="sm" onClick={download} disabled={!items.length}>
            <FileDown className="w-4 h-4 mr-1.5" /> PDF herunterladen
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8">
          <EmptyState icon={Wallet} title="Keine offenen Posten" description="Für diesen Kunden sind alle Rechnungen ausgeglichen." />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Rechnung</th>
                <th className="text-left px-4 py-3">Datum</th>
                <th className="text-left px-4 py-3">Fällig</th>
                <th className="text-left px-4 py-3">Verzug</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Betrag</th>
                <th className="text-right px-4 py-3">Offen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((i) => {
                const od = overdueDays(i.due_date);
                return (
                  <tr key={i.invoice_number} className="hover:bg-secondary/30">
                    <td className="px-4 py-2 font-medium">{i.invoice_number}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fmtDate(i.invoice_date)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fmtDate(i.due_date)}</td>
                    <td className={`px-4 py-2 ${od > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                      {od > 0 ? `${od} Tage` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {i.status ? <Badge variant="outline" className="text-[10px]">{i.status}</Badge> : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{money(i.total, i.currency || currency)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{money(i.balance ?? i.total, i.currency || currency)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/30">
                <td className="px-4 py-3 font-semibold" colSpan={5}>Gesamtsumme offener Posten</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{money(sums.total, currency)}</td>
                <td className="px-4 py-3 text-right font-bold">{money(sums.openSum, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-3 text-base">
              <span className="truncate">Kontoauszug · {customerName}</span>
              <Button size="sm" variant="outline" className="ml-auto" onClick={download}>
                <FileDown className="w-4 h-4 mr-1" /> Download
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-neutral-900/40">
            {pdfUrl && <iframe src={pdfUrl} title="Kontoauszug" className="w-full h-full border-0 bg-white" />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
