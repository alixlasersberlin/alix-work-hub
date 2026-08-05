import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Percent, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/hooks/useLicense';

const EMPTY = {
  contract_id: '', brand_id: '', tenant_id: '', sku: '', product_name: '',
  license_model: 'percent', rate_percent: 5, rate_per_unit: 0, min_amount: 0,
  valid_from: '', valid_to: '', is_active: true,
};

export default function LicenseSaetze() {
  const { tenants, canWrite } = useLicense();
  const [rows, setRows] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const load = async () => {
    setBusy(true);
    const [{ data }, { data: c }, { data: b }] = await Promise.all([
      supabase.from('license_rates' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('license_contracts' as any).select('id,contract_number,licensee_tenant_id'),
      supabase.from('brand_registry' as any).select('id,name'),
    ]);
    setRows(((data as any[]) || []));
    setContracts(((c as any[]) || []));
    setBrands(((b as any[]) || []));
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload: any = {
      ...form,
      contract_id: form.contract_id || null,
      brand_id: form.brand_id || null,
      tenant_id: form.tenant_id || null,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      rate_percent: Number(form.rate_percent || 0),
      rate_per_unit: Number(form.rate_per_unit || 0),
      min_amount: Number(form.min_amount || 0),
    };
    const { error } = editId
      ? await supabase.from('license_rates' as any).update(payload).eq('id', editId)
      : await supabase.from('license_rates' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Royalty-Satz gespeichert.');
    setOpen(false); setEditId(null); setForm(EMPTY); load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Royalty-Sätze"
        subtitle="Lizenzsätze je Vertrag, Marke, Mandant oder Artikel"
        icon={Percent}
        actions={canWrite && (
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Neuer Satz
          </Button>
        )}
      />
      <Card className="p-4">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {rows.map((r) => (
              <button key={r.id} onClick={() => { if (!canWrite) return; setEditId(r.id); setForm({ ...EMPTY, ...r, contract_id: r.contract_id || '', brand_id: r.brand_id || '', tenant_id: r.tenant_id || '', valid_from: r.valid_from || '', valid_to: r.valid_to || '' }); setOpen(true); }}
                className="grid w-full grid-cols-2 items-center gap-2 border-b border-border/50 pb-2 text-left hover:opacity-80 md:grid-cols-5">
                <span>{r.product_name || r.sku || 'alle Artikel'}</span>
                <span className="text-muted-foreground">{tenants.find((t) => t.id === r.tenant_id)?.name || 'alle Mandanten'}</span>
                <span>{r.license_model === 'percent' ? `${Number(r.rate_percent || 0)} %` : `${Number(r.rate_per_unit || 0)} / Stück`}</span>
                <span className="text-muted-foreground">{r.valid_from || '–'} → {r.valid_to || 'offen'}</span>
                <Badge variant={r.is_active ? 'default' : 'outline'}>{r.is_active ? 'aktiv' : 'inaktiv'}</Badge>
              </button>
            ))}
            {rows.length === 0 && <div className="text-muted-foreground">Noch keine Sätze erfasst.</div>}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? 'Royalty-Satz bearbeiten' : 'Neuer Royalty-Satz'}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Vertrag</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.contract_id} onChange={(e) => setForm({ ...form, contract_id: e.target.value })}>
                  <option value="">–</option>
                  {contracts.map((c) => <option key={c.id} value={c.id}>{c.contract_number}</option>)}
                </select>
              </div>
              <div>
                <Label>Marke</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
                  <option value="">–</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Mandant</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}>
                  <option value="">alle</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Artikelnummer (SKU)</Label><Input value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Artikelname</Label><Input value={form.product_name || ''} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Modell</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.license_model} onChange={(e) => setForm({ ...form, license_model: e.target.value })}>
                  <option value="percent">Prozent</option>
                  <option value="per_unit">pro Stück</option>
                  <option value="fixed">Fix</option>
                </select>
              </div>
              <div><Label>Satz %</Label><Input type="number" step="0.01" value={form.rate_percent} onChange={(e) => setForm({ ...form, rate_percent: e.target.value })} /></div>
              <div><Label>Betrag / Stück</Label><Input type="number" step="0.01" value={form.rate_per_unit} onChange={(e) => setForm({ ...form, rate_per_unit: e.target.value })} /></div>
              <div><Label>Mindestlizenz</Label><Input type="number" step="0.01" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Gültig ab</Label><Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} /></div>
              <div><Label>Gültig bis</Label><Input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} /></div>
            </div>
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
