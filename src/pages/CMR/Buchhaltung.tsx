import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Banknote, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';

type Doc = {
  id: string; doc_number: string | null; customer_id: string | null; customer_name: string | null;
  doc_date: string; due_date: string | null; gross_total: number; paid_total: number; currency: string; status: string;
};
type Pay = { id: string; document_id: string | null; paid_on: string; amount: number; method: string | null; reference: string | null };

export default function CmrBuchhaltung() {
  const { tenantId, settings, loading } = useCmrTenant();
  const [invoices, setInvoices] = useState<Doc[]>([]);
  const [payments, setPayments] = useState<Pay[]>([]);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<'offen' | 'alle' | 'zahlungen' | 'ust'>('offen');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const cur = settings?.default_currency || 'AED';

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from('cmr_documents' as any).select('*').eq('tenant_id', tenantId)
        .in('doc_type', ['rechnung', 'proforma', 'gutschrift']).order('doc_date', { ascending: false }).limit(500),
      supabase.from('cmr_payments' as any).select('*').eq('tenant_id', tenantId).order('paid_on', { ascending: false }).limit(500),
    ]);
    setInvoices(((d as any) || []) as Doc[]);
    setPayments(((p as any) || []) as Pay[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const open_ = useMemo(() => invoices.filter((i) => Number(i.gross_total) - Number(i.paid_total) > 0.01), [invoices]);
  const sums = useMemo(() => ({
    invoiced: invoices.reduce((s, i) => s + Number(i.gross_total || 0), 0),
    paid: invoices.reduce((s, i) => s + Number(i.paid_total || 0), 0),
    open: open_.reduce((s, i) => s + (Number(i.gross_total) - Number(i.paid_total)), 0),
  }), [invoices, open_]);

  /** Umsatzsteuer-Auswertung je Monat (nur CMR-Belege). */
  const ustRows = useMemo(() => {
    const map = new Map<string, { net: number; tax: number; gross: number }>();
    invoices.forEach((i) => {
      const key = String(i.doc_date).slice(0, 7);
      const sign = (i as any).doc_type === 'gutschrift' ? -1 : 1;
      const e = map.get(key) ?? { net: 0, tax: 0, gross: 0 };
      const gross = Number(i.gross_total || 0);
      const net = Number((i as any).net_total ?? 0);
      e.gross += sign * gross;
      e.net += sign * net;
      e.tax += sign * Number((i as any).tax_total ?? gross - net);
      map.set(key, e);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([month, v]) => ({ month, ...v }));
  }, [invoices]);

  const exportCsv = () => {
    const sep = ';';
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let name = 'CMR_Export.csv';
    let csv = '';
    if (tab === 'zahlungen') {
      name = 'CMR_Zahlungen.csv';
      csv = ['Datum', 'Beleg', 'Betrag', 'Zahlungsart', 'Referenz'].join(sep) + '\n';
      csv += payments.map((p) => [
        p.paid_on, invoices.find((i) => i.id === p.document_id)?.doc_number ?? '', Number(p.amount).toFixed(2), p.method ?? '', p.reference ?? '',
      ].map(esc).join(sep)).join('\n');
    } else if (tab === 'ust') {
      name = 'CMR_Umsatzsteuer.csv';
      csv = ['Monat', 'Netto', 'MwSt.', 'Brutto'].join(sep) + '\n';
      csv += ustRows.map((r) => [r.month, r.net.toFixed(2), r.tax.toFixed(2), r.gross.toFixed(2)].map(esc).join(sep)).join('\n');
    } else {
      name = tab === 'offen' ? 'CMR_Offene_Posten.csv' : 'CMR_Rechnungen.csv';
      csv = ['Nummer', 'Kunde', 'Datum', 'Faellig', 'Status', 'Brutto', 'Bezahlt', 'Offen', 'Waehrung'].join(sep) + '\n';
      csv += (tab === 'offen' ? open_ : invoices).map((d) => [
        d.doc_number ?? '', d.customer_name ?? '', d.doc_date, d.due_date ?? '', d.status,
        Number(d.gross_total).toFixed(2), Number(d.paid_total).toFixed(2),
        (Number(d.gross_total) - Number(d.paid_total)).toFixed(2), d.currency || cur,
      ].map(esc).join(sep)).join('\n');
    }
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const startPayment = (d: Doc) => {
    setForm({
      document_id: d.id, customer_id: d.customer_id, label: `${d.doc_number} · ${d.customer_name ?? ''}`,
      amount: Math.max(0, Number(d.gross_total) - Number(d.paid_total)),
      paid_on: new Date().toISOString().slice(0, 10), method: 'Überweisung', reference: '',
    });
    setOpen(true);
  };

  const savePayment = async () => {
    if (!tenantId || !form) return;
    setSaving(true);
    const { error } = await supabase.from('cmr_payments' as any).insert({
      tenant_id: tenantId,
      document_id: form.document_id,
      customer_id: form.customer_id,
      paid_on: form.paid_on,
      amount: Number(form.amount) || 0,
      currency: cur,
      method: form.method || null,
      reference: form.reference || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Zahlungseingang erfasst');
    setOpen(false);
    load();
  };

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const list = tab === 'offen' ? open_ : invoices;

  return (
    <div className="space-y-4">
      <PageHeader title="CMR Buchhaltung" subtitle="Getrennte Buchhaltung der Cloud Marketing Research – ohne Vermischung mit Alix Lasers." />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Fakturiert</div><div className="text-xl font-semibold mt-1">{cmrMoney(sums.invoiced, cur)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Bezahlt</div><div className="text-xl font-semibold mt-1">{cmrMoney(sums.paid, cur)}</div></Card>
        <Card className="p-4"><div className="text-[11px] uppercase text-muted-foreground">Offene Posten</div><div className="text-xl font-semibold mt-1">{cmrMoney(sums.open, cur)}</div></Card>
      </div>

      <div className="flex gap-2">
        {(['offen', 'alle', 'zahlungen', 'ust'] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
            {t === 'offen' ? 'Offene Posten' : t === 'alle' ? 'Alle Rechnungen' : t === 'zahlungen' ? 'Zahlungseingänge' : 'Umsatzsteuer'}
          </Button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5 mr-1" /> CSV Export
        </Button>
      </div>

      {tab === 'ust' ? (
        <Card className="divide-y">
          <div className="p-3 grid grid-cols-4 text-[11px] uppercase tracking-wide text-muted-foreground">
            <div>Monat</div><div className="text-right">Netto</div><div className="text-right">MwSt.</div><div className="text-right">Brutto</div>
          </div>
          {ustRows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine Belege im Zeitraum.</div>}
          {ustRows.map((r) => (
            <div key={r.month} className="p-3 grid grid-cols-4 text-sm">
              <div>{r.month}</div>
              <div className="text-right">{cmrMoney(r.net, cur)}</div>
              <div className="text-right">{cmrMoney(r.tax, cur)}</div>
              <div className="text-right font-semibold">{cmrMoney(r.gross, cur)}</div>
            </div>
          ))}
        </Card>
      ) : tab !== 'zahlungen' ? (
        <Card className="divide-y">
          {list.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <Banknote className="w-5 h-5" /> Keine Belege vorhanden.
            </div>
          )}
          {list.map((d) => (
            <div key={d.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{d.doc_number ?? '—'} · {d.customer_name ?? 'Ohne Kunde'}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(d.doc_date).toLocaleDateString('de-DE')}
                  {d.due_date ? ` · fällig ${new Date(d.due_date).toLocaleDateString('de-DE')}` : ''} · {d.status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{cmrMoney(d.gross_total, d.currency || cur)}</div>
                <div className="text-xs text-muted-foreground">offen {cmrMoney(Number(d.gross_total) - Number(d.paid_total), cur)}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => startPayment(d)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Zahlung
              </Button>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="divide-y">
          {payments.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Keine Zahlungseingänge erfasst.</div>}
          {payments.map((p) => (
            <div key={p.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm">{invoices.find((i) => i.id === p.document_id)?.doc_number ?? 'Ohne Beleg'}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.paid_on).toLocaleDateString('de-DE')}{p.method ? ` · ${p.method}` : ''}{p.reference ? ` · ${p.reference}` : ''}
                </div>
              </div>
              <div className="text-sm font-semibold">{cmrMoney(p.amount, cur)}</div>
            </div>
          ))}
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Zahlungseingang erfassen</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{form.label}</div>
              <div><Label>Betrag ({cur})</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Datum</Label><Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} /></div>
              <div><Label>Zahlungsart</Label><Input value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></div>
              <div><Label>Referenz</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={savePayment} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Buchen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
