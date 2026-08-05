import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { ArrowLeftRight, Plus, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense, licMoney } from '@/hooks/useLicense';

const EMPTY = { from_tenant_id: '', to_tenant_id: '', category: 'lizenz', invoice_date: new Date().toISOString().slice(0, 10), due_date: '', amount_net: 0, currency: 'EUR', reference: '', notes: '' };

export default function LicenseIntercompany() {
  const { tenants, licensor, canWrite } = useLicense();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...EMPTY });

  const load = async () => {
    setBusy(true);
    const { data } = await supabase.from('intercompany_invoices' as any).select('*').order('invoice_date', { ascending: false }).limit(1000);
    setRows(((data as any[]) || []));
    setBusy(false);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (licensor) setForm((f: any) => ({ ...f, from_tenant_id: f.from_tenant_id || licensor.id })); }, [licensor]);

  const tName = (id: string | null) => tenants.find((t) => t.id === id)?.name || '–';

  const save = async () => {
    if (!form.from_tenant_id || !form.to_tenant_id) { toast.error('Bitte Absender und Empfänger wählen.'); return; }
    const { error } = await supabase.from('intercompany_invoices' as any).insert({
      ...form,
      due_date: form.due_date || null,
      amount_net: Number(form.amount_net || 0),
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Intercompany-Rechnung erstellt.');
    setOpen(false); setForm({ ...EMPTY, from_tenant_id: licensor?.id || '' }); load();
  };

  const markPaid = async (r: any) => {
    const { error } = await supabase.from('intercompany_invoices' as any).update({ status: 'bezahlt', paid_at: new Date().toISOString() }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Als bezahlt markiert.');
    load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Intercompany-Rechnungen"
        subtitle="Verrechnung zwischen den Mandanten – ohne Vermischung mit Endkunden"
        icon={ArrowLeftRight}
        actions={canWrite && <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Neue Rechnung</Button>}
      />
      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-2 items-center gap-2 border-b border-border/50 pb-2 md:grid-cols-7">
                <span className="font-mono text-xs">{r.invoice_number}</span>
                <span>{r.invoice_date}</span>
                <span className="truncate">{tName(r.from_tenant_id)}</span>
                <span className="truncate">→ {tName(r.to_tenant_id)}</span>
                <span className="font-medium">{licMoney(r.amount_net, r.currency)}</span>
                <Badge variant={r.status === 'bezahlt' ? 'default' : 'outline'}>{r.status}</Badge>
                {canWrite && r.status !== 'bezahlt' ? (
                  <Button size="sm" variant="outline" onClick={() => markPaid(r)}><Check className="h-4 w-4" /></Button>
                ) : <span />}
              </div>
            ))}
            {rows.length === 0 && <div className="text-muted-foreground">Noch keine Intercompany-Rechnungen.</div>}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Intercompany-Rechnung</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Von Mandant</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.from_tenant_id} onChange={(e) => setForm({ ...form, from_tenant_id: e.target.value })}>
                  <option value="">–</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <Label>An Mandant</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.to_tenant_id} onChange={(e) => setForm({ ...form, to_tenant_id: e.target.value })}>
                  <option value="">–</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Rechnungsdatum</Label><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></div>
              <div><Label>Fällig am</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><Label>Betrag netto</Label><Input type="number" step="0.01" value={form.amount_net} onChange={(e) => setForm({ ...form, amount_net: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="lizenz">Lizenz</option>
                  <option value="dienstleistung">Dienstleistung</option>
                  <option value="ware">Ware</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div><Label>Referenz</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            </div>
            <div><Label>Notizen</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
