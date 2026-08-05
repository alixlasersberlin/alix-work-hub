import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useMedTenant, medMoney } from '@/hooks/useMedTenant';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';

type Item = any;

export default function MedArtikel() {
  const { tenantId, canWrite, loading } = useMedTenant();
  const [rows, setRows] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Item>({});

  const load = async () => {
    if (!tenantId) return;
    setBusy(true);
    const { data } = await supabase.from('med_items' as any)
      .select('*').eq('tenant_id', tenantId).order('name');
    setRows(((data as any) || []) as Item[]);
    setBusy(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const save = async () => {
    if (!tenantId || !form.name) { toast.error('Bezeichnung fehlt'); return; }
    const payload = {
      tenant_id: tenantId,
      sku: form.sku || null,
      name: form.name,
      description: form.description || null,
      unit: form.unit || 'Stk',
      price: Number(form.price || 0),
      tax_rate: Number(form.tax_rate ?? 19),
      udi_di: form.udi_di || null,
      mdr_class: form.mdr_class || null,
      ce_number: form.ce_number || null,
    };
    const res = form.id
      ? await supabase.from('med_items' as any).update(payload as any).eq('id', form.id)
      : await supabase.from('med_items' as any).insert(payload as any);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success('Artikel gespeichert');
    setOpen(false); setForm({}); load();
  };

  const filtered = rows.filter(r =>
    !q || [r.name, r.sku, r.ce_number].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()));

  if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">⚕️ Alix Medical</div>
          <h1 className="text-2xl font-display font-bold">Artikel</h1>
        </div>
        {canWrite && (
          <Button onClick={() => { setForm({ tax_rate: 19, unit: 'Stk' }); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Neuer Artikel
          </Button>
        )}
      </div>

      <Input placeholder="Suche nach Name, SKU, CE-Nummer…" value={q} onChange={e => setQ(e.target.value)} className="max-w-md" />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Artikel</th>
              <th className="text-left p-3">SKU</th>
              <th className="text-left p-3">MDR-Klasse</th>
              <th className="text-left p-3">CE-Nr.</th>
              <th className="text-right p-3">Preis</th>
              <th className="text-right p-3">MwSt.</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {busy && <tr><td colSpan={7} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>}
            {!busy && filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Keine Artikel</td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">{r.name}</td>
                <td className="p-3 text-muted-foreground">{r.sku || '–'}</td>
                <td className="p-3">{r.mdr_class || '–'}</td>
                <td className="p-3">{r.ce_number || '–'}</td>
                <td className="p-3 text-right">{medMoney(r.price)}</td>
                <td className="p-3 text-right">{Number(r.tax_rate)}%</td>
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
          <DialogHeader><DialogTitle>{form.id ? 'Artikel bearbeiten' : 'Neuer Artikel'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Bezeichnung</Label>
              <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div><Label>SKU</Label><Input value={form.sku || ''} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>Einheit</Label><Input value={form.unit || ''} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
            <div><Label>Preis</Label><Input type="number" value={form.price ?? ''} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            <div><Label>MwSt. %</Label><Input type="number" value={form.tax_rate ?? ''} onChange={e => setForm({ ...form, tax_rate: e.target.value })} /></div>
            <div><Label>MDR-Klasse</Label><Input value={form.mdr_class || ''} onChange={e => setForm({ ...form, mdr_class: e.target.value })} /></div>
            <div><Label>CE-Nummer</Label><Input value={form.ce_number || ''} onChange={e => setForm({ ...form, ce_number: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>UDI-DI</Label><Input value={form.udi_di || ''} onChange={e => setForm({ ...form, udi_di: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <Label>Beschreibung</Label>
              <Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
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
