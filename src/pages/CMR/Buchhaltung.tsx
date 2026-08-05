import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Banknote, Plus } from 'lucide-react';
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
  const [tab, setTab] = useState<'offen' | 'alle' | 'zahlungen'>('offen');
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
        {(['offen', 'alle', 'zahlungen'] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? 'default' : 'outline'} onClick={() => setTab(t)}>
            {t === 'offen' ? 'Offene Posten' : t === 'alle' ? 'Alle Rechnungen' : 'Zahlungseingänge'}
          </Button>
        ))}
      </div>

      {tab !== 'zahlungen' ? (
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
