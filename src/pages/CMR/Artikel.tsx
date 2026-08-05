import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Loader2, Plus, Package, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useCmrTenant, cmrMoney } from '@/hooks/useCmrTenant';
import CmrReadOnlyBanner from '@/components/cmr/CmrReadOnlyBanner';
import CmrCategories from './Categories';

type Cat = { id: string; name: string };
type Item = {
  id: string; category_id: string | null; sku: string | null; name: string; description: string | null;
  unit: string; price: number; currency: string; tax_rate: number; is_recurring: boolean;
  billing_interval: string | null; is_active: boolean;
};

const EMPTY = {
  category_id: '', sku: '', name: '', description: '', unit: 'Stück',
  price: 0, tax_rate: 5, is_recurring: false, billing_interval: '', is_active: true,
};

export default function CmrArtikel() {
  const { tenantId, settings, loading, canWrite} = useCmrTenant();
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const cur = settings?.default_currency || 'AED';

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from('cmr_item_categories' as any).select('id,name').eq('tenant_id', tenantId).order('sort_order'),
      supabase.from('cmr_items' as any).select('*').eq('tenant_id', tenantId).order('name'),
    ]);
    setCats(((c as any) || []) as Cat[]);
    setItems(((i as any) || []) as Item[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const save = async () => {
    if (!tenantId) return;
    if (!form.name.trim()) { toast.error('Bitte einen Artikelnamen angeben.'); return; }
    setSaving(true);
    const payload: any = {
      tenant_id: tenantId,
      category_id: form.category_id || null,
      sku: form.sku || null,
      name: form.name,
      description: form.description || null,
      unit: form.unit || 'Stück',
      price: Number(form.price) || 0,
      currency: cur,
      tax_rate: Number(form.tax_rate) || 0,
      is_recurring: !!form.is_recurring,
      billing_interval: form.billing_interval || null,
      is_active: !!form.is_active,
    };
    const { error } = editId
      ? await supabase.from('cmr_items' as any).update(payload).eq('id', editId)
      : await supabase.from('cmr_items' as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Artikel aktualisiert' : 'Artikel angelegt');
    setOpen(false); setEditId(null); setForm(EMPTY);
    load();
  };

  const filtered = items.filter((i) =>
    (!catFilter || i.category_id === catFilter) &&
    (!search || `${i.name} ${i.sku ?? ''}`.toLowerCase().includes(search.toLowerCase())));

  const exportCsv = () => {
    const head = ['sku', 'name', 'kategorie', 'beschreibung', 'einheit', 'preis', 'waehrung', 'mwst', 'wiederkehrend', 'intervall', 'aktiv'];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map((i) => [
      i.sku ?? '', i.name, cats.find((c) => c.id === i.category_id)?.name ?? '', i.description ?? '',
      i.unit, i.price, i.currency || cur, i.tax_rate, i.is_recurring ? 'ja' : 'nein',
      i.billing_interval ?? '', i.is_active ? 'ja' : 'nein',
    ].map(esc).join(';'));
    const blob = new Blob(['\uFEFF' + [head.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cmr-artikel-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importCsv = async (file: File) => {
    if (!tenantId) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { toast.error('CSV enthält keine Datenzeilen.'); return; }
    const delim = lines[0].includes(';') ? ';' : ',';
    const split = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    const head = split(lines[0]).map((h) => h.toLowerCase());
    const idx = (n: string) => head.indexOf(n);
    if (idx('name') === -1) { toast.error('Spalte "name" fehlt in der CSV.'); return; }
    const rows = lines.slice(1).map(split).filter((r) => r[idx('name')]);
    const payload = rows.map((r) => {
      const catName = idx('kategorie') > -1 ? r[idx('kategorie')] : '';
      return {
        tenant_id: tenantId,
        sku: idx('sku') > -1 ? r[idx('sku')] || null : null,
        name: r[idx('name')],
        category_id: cats.find((c) => c.name.toLowerCase() === (catName || '').toLowerCase())?.id ?? null,
        description: idx('beschreibung') > -1 ? r[idx('beschreibung')] || null : null,
        unit: (idx('einheit') > -1 && r[idx('einheit')]) || 'Stück',
        price: Number(String(idx('preis') > -1 ? r[idx('preis')] : '0').replace(',', '.')) || 0,
        currency: cur,
        tax_rate: Number(String(idx('mwst') > -1 ? r[idx('mwst')] : '0').replace(',', '.')) || 0,
        is_recurring: idx('wiederkehrend') > -1 ? /ja|true|1/i.test(r[idx('wiederkehrend')] || '') : false,
        billing_interval: idx('intervall') > -1 ? r[idx('intervall')] || null : null,
        is_active: idx('aktiv') > -1 ? !/nein|false|0/i.test(r[idx('aktiv')] || 'ja') : true,
      };
    });
    const { error } = await supabase.from('cmr_items' as any).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(`${payload.length} Artikel importiert`);
    load();
  };

  if (loading || busy) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {!canWrite && <CmrReadOnlyBanner />}
      <PageHeader title="CMR Artikelstamm" subtitle="Eigener Artikelstamm der Cloud Marketing Research – getrennt von Alix Lasers." />
      <CmrCategories tenantId={tenantId} onChanged={load} />

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button variant="outline" className="ml-auto" onClick={exportCsv}>
          <Download className="w-4 h-4 mr-1.5" /> CSV Export
        </Button>
        <Button variant="outline" asChild>
          <label className="cursor-pointer">
            <Upload className="w-4 h-4 mr-1.5" /> CSV Import
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value = ''; }}
            />
          </label>
        </Button>
        <Button onClick={() => { setEditId(null); setForm(EMPTY); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Neuer Artikel
        </Button>
      </div>

      <Card className="divide-y">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Package className="w-5 h-5" /> Noch keine Artikel angelegt.
          </div>
        )}
        {filtered.map((i) => (
          <button
            key={i.id}
            className="w-full text-left p-3 hover:bg-muted/50 flex items-center gap-3"
            onClick={() => {
              setEditId(i.id);
              setForm({
                category_id: i.category_id ?? '', sku: i.sku ?? '', name: i.name,
                description: i.description ?? '', unit: i.unit, price: i.price,
                tax_rate: i.tax_rate, is_recurring: i.is_recurring,
                billing_interval: i.billing_interval ?? '', is_active: i.is_active,
              });
              setOpen(true);
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{i.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {cats.find((c) => c.id === i.category_id)?.name ?? 'Ohne Kategorie'}
                {i.sku ? ` · ${i.sku}` : ''}{i.is_recurring ? ' · wiederkehrend' : ''}
                {!i.is_active ? ' · inaktiv' : ''}
              </div>
            </div>
            <div className="text-sm font-semibold whitespace-nowrap">{cmrMoney(i.price, i.currency || cur)}</div>
          </button>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Artikel bearbeiten' : 'Neuer Artikel'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <select
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">— ohne —</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><Label>Artikelnummer</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div><Label>Bezeichnung</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Einheit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              <div><Label>Preis ({cur})</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>MwSt. %</Label><Input type="number" step="0.1" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm({ ...form, is_recurring: v })} />
                <Label className="mb-0">Wiederkehrend</Label>
              </div>
              <div><Label>Intervall</Label><Input placeholder="monatlich / jährlich" value={form.billing_interval} onChange={(e) => setForm({ ...form, billing_interval: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="mb-0">Aktiv</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
