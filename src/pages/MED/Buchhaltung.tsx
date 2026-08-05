import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useMedTenant, medMoney } from '@/hooks/useMedTenant';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

export default function MedBuchhaltung() {
  const { tenantId, canWrite, loading } = useMedTenant();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [inv, pay] = await Promise.all([
      supabase.from('med_documents' as any).select('*').eq('tenant_id', tenantId)
        .eq('doc_type', 'rechnung').order('doc_date', { ascending: false }).limit(500),
      supabase.from('med_payments' as any).select('*').eq('tenant_id', tenantId)
        .order('paid_on', { ascending: false }).limit(500),
    ]);
    setInvoices(((inv.data as any) || []) as any[]);
    setPayments(((pay.data as any) || []) as any[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const openSum = invoices.reduce((s, i) => s + (Number(i.gross_total || 0) - Number(i.paid_total || 0)), 0);
  const paidSum = invoices.reduce((s, i) => s + Number(i.paid_total || 0), 0);

  const savePayment = async () => {
    if (!tenantId || !form.document_id) { toast.error('Rechnung wählen'); return; }
    const amount = Number(form.amount || 0);
    const { error } = await supabase.from('med_payments' as any).insert({
      tenant_id: tenantId,
      document_id: form.document_id,
      paid_on: form.paid_on || new Date().toISOString().slice(0, 10),
      amount,
      method: form.method || null,
      reference: form.reference || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    const inv = invoices.find(i => i.id === form.document_id);
    const newPaid = Number(inv?.paid_total || 0) + amount;
    await supabase.from('med_documents' as any).update({
      paid_total: newPaid,
      status: newPaid >= Number(inv?.gross_total || 0) ? 'bezahlt' : inv?.status,
    } as any).eq('id', form.document_id);
    toast.success('Zahlung erfasst');
    setOpen(false); setForm({}); load();
  };

  if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">⚕️ Alix Medical</div>
          <h1 className="text-2xl font-display font-bold">Buchhaltung</h1>
        </div>
        {canWrite && <Button onClick={() => { setForm({}); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> Zahlung erfassen</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Rechnungen</div><div className="text-2xl font-semibold mt-1">{invoices.length}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Offen</div><div className="text-2xl font-semibold mt-1">{medMoney(openSum)}</div></Card>
        <Card className="p-5"><div className="text-xs uppercase text-muted-foreground">Bezahlt</div><div className="text-2xl font-semibold mt-1">{medMoney(paidSum)}</div></Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Rechnung</th>
              <th className="text-left p-3">Kunde</th>
              <th className="text-left p-3">Datum</th>
              <th className="text-right p-3">Brutto</th>
              <th className="text-right p-3">Bezahlt</th>
              <th className="text-right p-3">Offen</th>
            </tr>
          </thead>
          <tbody>
            {busy && <tr><td colSpan={6} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {!busy && invoices.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Keine Rechnungen</td></tr>}
            {invoices.map(i => (
              <tr key={i.id} className="border-t border-border">
                <td className="p-3 font-medium">{i.doc_number || '–'}</td>
                <td className="p-3">{i.customer_name || '–'}</td>
                <td className="p-3">{i.doc_date}</td>
                <td className="p-3 text-right">{medMoney(i.gross_total)}</td>
                <td className="p-3 text-right">{medMoney(i.paid_total)}</td>
                <td className="p-3 text-right">{medMoney(Number(i.gross_total || 0) - Number(i.paid_total || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Zahlungen</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-3">Datum</th><th className="text-left p-3">Methode</th><th className="text-left p-3">Referenz</th><th className="text-right p-3">Betrag</th></tr>
            </thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Keine Zahlungen</td></tr>}
              {payments.map(p => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">{p.paid_on}</td>
                  <td className="p-3">{p.method || '–'}</td>
                  <td className="p-3">{p.reference || '–'}</td>
                  <td className="p-3 text-right">{medMoney(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Zahlung erfassen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rechnung</Label>
              <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={form.document_id || ''} onChange={e => setForm({ ...form, document_id: e.target.value })}>
                <option value="">— wählen —</option>
                {invoices.map(i => <option key={i.id} value={i.id}>{i.doc_number} · {i.customer_name} · {medMoney(i.gross_total)}</option>)}
              </select>
            </div>
            <div><Label>Betrag</Label><Input type="number" value={form.amount ?? ''} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Zahldatum</Label><Input type="date" value={form.paid_on || ''} onChange={e => setForm({ ...form, paid_on: e.target.value })} /></div>
            <div><Label>Methode</Label><Input value={form.method || ''} onChange={e => setForm({ ...form, method: e.target.value })} /></div>
            <div><Label>Referenz</Label><Input value={form.reference || ''} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={savePayment}>Buchen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
