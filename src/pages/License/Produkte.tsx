import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Package, Plus, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/hooks/useLicense';

const EMPTY = {
  catalog_item_id: '', sku: '', item_name: '', is_licensable: true, brand_id: '',
  license_model: 'percent', rate_percent: 5, rate_per_unit: 0, min_amount: 0,
  per_device: true, valid_from: '', valid_to: '', notes: '',
};

export default function LicenseProdukte() {
  const { licensor, canWrite } = useLicense();
  const [rows, setRows] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const load = async () => {
    setBusy(true);
    const [{ data }, { data: b }, { data: ci }] = await Promise.all([
      supabase.from('license_products' as any).select('*').order('item_name'),
      supabase.from('brand_registry' as any).select('id,name'),
      supabase.from('catalog_items').select('id,sku,name').order('name').limit(1000),
    ]);
    setRows(((data as any[]) || []));
    setBrands(((b as any[]) || []));
    setCatalog(((ci as any[]) || []));
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.item_name} ${r.sku || ''}`.toLowerCase().includes(s));
  }, [rows, search]);

  const save = async () => {
    if (!form.item_name.trim()) { toast.error('Bitte einen Artikelnamen angeben.'); return; }
    const payload: any = {
      ...form,
      catalog_item_id: form.catalog_item_id || null,
      brand_id: form.brand_id || null,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      licensor_tenant_id: licensor?.id ?? null,
      rate_percent: Number(form.rate_percent || 0),
      rate_per_unit: Number(form.rate_per_unit || 0),
      min_amount: Number(form.min_amount || 0),
    };
    const { error } = editId
      ? await supabase.from('license_products' as any).update(payload).eq('id', editId)
      : await supabase.from('license_products' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Produktlizenz gespeichert.');
    setOpen(false); setEditId(null); setForm(EMPTY); load();
  };

  const pickCatalog = (id: string) => {
    const it = catalog.find((c) => c.id === id);
    setForm((f: any) => ({ ...f, catalog_item_id: id, sku: it?.sku || f.sku, item_name: it?.name || f.item_name }));
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Produktlizenzen"
        subtitle="Lizenzierung im Artikelstamm: Lizenzpflicht, Lizenzgeber, Lizenzmodell und Lizenzsatz"
        icon={Package}
        actions={canWrite && (
          <Button onClick={() => { setEditId(null); setForm(EMPTY); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Artikel lizenzieren
          </Button>
        )}
      />

      <Card className="space-y-4 p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Artikel suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="space-y-2 text-sm">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => { if (!canWrite) return; setEditId(p.id); setForm({ ...EMPTY, ...p, catalog_item_id: p.catalog_item_id || '', brand_id: p.brand_id || '', valid_from: p.valid_from || '', valid_to: p.valid_to || '' }); setOpen(true); }}
                className="grid w-full grid-cols-2 items-center gap-2 border-b border-border/50 pb-2 text-left hover:opacity-80 md:grid-cols-5">
                <span className="font-medium">{p.item_name}</span>
                <span className="font-mono text-xs text-muted-foreground">{p.sku || '–'}</span>
                <span>{p.license_model === 'percent' ? `${Number(p.rate_percent || 0)} %` : `${Number(p.rate_per_unit || 0)} / Stück`}</span>
                <span className="text-muted-foreground">{p.per_device ? 'je Gerät' : 'je Position'}</span>
                <Badge variant={p.is_licensable ? 'default' : 'outline'}>{p.is_licensable ? 'lizenzpflichtig' : 'frei'}</Badge>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-muted-foreground">Keine lizenzierten Artikel gefunden.</div>}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Lizenzierung</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Artikel aus dem Katalog</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.catalog_item_id} onChange={(e) => pickCatalog(e.target.value)}>
                <option value="">– frei erfassen –</option>
                {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}{c.sku ? ` (${c.sku})` : ''}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Artikelname</Label><Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} /></div>
              <div><Label>Artikelnummer (SKU)</Label><Input value={form.sku || ''} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-end gap-3 pb-1">
                <Switch checked={!!form.is_licensable} onCheckedChange={(v) => setForm({ ...form, is_licensable: v })} />
                <span className="text-sm">Lizenzpflicht</span>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <Switch checked={!!form.per_device} onCheckedChange={(v) => setForm({ ...form, per_device: v })} />
                <span className="text-sm">Lizenz je Gerät</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lizenzgeber</Label>
                <Input value={licensor?.name || 'Alix License'} readOnly />
              </div>
              <div>
                <Label>Marke</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.brand_id} onChange={(e) => setForm({ ...form, brand_id: e.target.value })}>
                  <option value="">–</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Lizenzmodell</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.license_model} onChange={(e) => setForm({ ...form, license_model: e.target.value })}>
                  <option value="percent">Lizenz in %</option>
                  <option value="per_unit">Lizenz pro Stück</option>
                  <option value="fixed">Fixbetrag</option>
                </select>
              </div>
              <div><Label>Lizenzsatz %</Label><Input type="number" step="0.01" value={form.rate_percent} onChange={(e) => setForm({ ...form, rate_percent: e.target.value })} /></div>
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
