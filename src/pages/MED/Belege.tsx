import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useMedTenant, medMoney, medDocLabel, MED_DOC_TYPES, MED_DOC_STATUS } from '@/hooks/useMedTenant';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

export default function MedBelege() {
  const { tenantId, canWrite, loading } = useMedTenant();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [type, setType] = useState('alle');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    let q: any = supabase.from('med_documents' as any).select('*').eq('tenant_id', tenantId)
      .order('doc_date', { ascending: false }).limit(500);
    if (type !== 'alle') q = q.eq('doc_type', type);
    const { data } = await q;
    setRows(((data as any) || []) as any[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId, type]);

  const nextNumber = async (docType: string) => {
    const year = new Date().getFullYear();
    const { data } = await supabase.from('med_number_ranges' as any)
      .select('*').eq('tenant_id', tenantId).eq('doc_type', docType).eq('year', year).maybeSingle();
    const r: any = data;
    if (!r) return null;
    const num = `${r.prefix}-${year}-${String(r.next_number).padStart(r.padding, '0')}`;
    await supabase.from('med_number_ranges' as any).update({ next_number: r.next_number + 1 } as any).eq('id', r.id);
    return num;
  };

  const save = async () => {
    if (!tenantId || !form.doc_type) { toast.error('Belegart wählen'); return; }
    const net = Number(form.net_total || 0);
    const tax = net * Number(form.tax_rate ?? 19) / 100;
    const number = form.doc_number || await nextNumber(form.doc_type);
    const payload = {
      tenant_id: tenantId,
      doc_type: form.doc_type,
      doc_number: number,
      status: form.status || 'entwurf',
      customer_name: form.customer_name || null,
      customer_email: form.customer_email || null,
      doc_date: form.doc_date || new Date().toISOString().slice(0, 10),
      due_date: form.due_date || null,
      tax_rate: Number(form.tax_rate ?? 19),
      net_total: net,
      tax_total: tax,
      gross_total: net + tax,
      reference: form.reference || null,
      notes: form.notes || null,
    };
    const res = form.id
      ? await supabase.from('med_documents' as any).update(payload as any).eq('id', form.id)
      : await supabase.from('med_documents' as any).insert(payload as any);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success('Beleg gespeichert');
    setOpen(false); setForm({}); load();
  };

  if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">⚕️ Alix Medical</div>
          <h1 className="text-2xl font-display font-bold">Belege</h1>
        </div>
        {canWrite && (
          <Button onClick={() => { setForm({ doc_type: 'rechnung', tax_rate: 19, status: 'entwurf' }); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Neuer Beleg
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {['alle', ...MED_DOC_TYPES.map(t => t.value)].map(v => (
          <Button key={v} size="sm" variant={type === v ? 'default' : 'outline'} onClick={() => setType(v)}>
            {v === 'alle' ? 'Alle' : medDocLabel(v)}
          </Button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nummer</th>
              <th className="text-left p-3">Art</th>
              <th className="text-left p-3">Kunde</th>
              <th className="text-left p-3">Datum</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Brutto</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {busy && <tr><td colSpan={7} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {!busy && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Keine Belege</td></tr>}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3 font-medium">{r.doc_number || '–'}</td>
                <td className="p-3">{medDocLabel(r.doc_type)}</td>
                <td className="p-3">{r.customer_name || '–'}</td>
                <td className="p-3">{r.doc_date}</td>
                <td className="p-3"><Badge variant="outline">{r.status}</Badge></td>
                <td className="p-3 text-right">{medMoney(r.gross_total)}</td>
                <td className="p-3 text-right">
                  {canWrite && <Button size="sm" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}>Bearbeiten</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? `Beleg ${form.doc_number || ''}` : 'Neuer Beleg'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Belegart</Label>
              <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={form.doc_type || ''} onChange={e => setForm({ ...form, doc_type: e.target.value })}>
                {MED_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={form.status || 'entwurf'} onChange={e => setForm({ ...form, status: e.target.value })}>
                {MED_DOC_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><Label>Kunde</Label><Input value={form.customer_name || ''} onChange={e => setForm({ ...form, customer_name: e.target.value })} /></div>
            <div><Label>E-Mail</Label><Input value={form.customer_email || ''} onChange={e => setForm({ ...form, customer_email: e.target.value })} /></div>
            <div><Label>Belegdatum</Label><Input type="date" value={form.doc_date || ''} onChange={e => setForm({ ...form, doc_date: e.target.value })} /></div>
            <div><Label>Fällig am</Label><Input type="date" value={form.due_date || ''} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><Label>Netto</Label><Input type="number" value={form.net_total ?? ''} onChange={e => setForm({ ...form, net_total: e.target.value })} /></div>
            <div><Label>MwSt. %</Label><Input type="number" value={form.tax_rate ?? ''} onChange={e => setForm({ ...form, tax_rate: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Referenz</Label><Input value={form.reference || ''} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
