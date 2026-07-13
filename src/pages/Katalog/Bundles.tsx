import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, Trash2, Search, Pencil, X } from 'lucide-react';

interface Bundle {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  is_active: boolean;
  default_discount_pct: number;
  sort_order: number;
  notes: string | null;
}
interface Item { id: string; sku: string; name: string; }
interface BundleItem {
  id: string;
  bundle_id: string;
  item_id: string;
  quantity: number;
  discount_pct: number;
  note: string | null;
  sort_order: number;
  is_optional: boolean;
}
interface PriceTier {
  id: string;
  bundle_id: string;
  min_quantity: number;
  discount_pct: number;
  note: string | null;
}

export default function KatalogBundles() {
  const c = supabase as any;
  const { toast } = useToast();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [selected, setSelected] = useState<Bundle | null>(null);
  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [newTierQty, setNewTierQty] = useState<number>(2);
  const [newTierPct, setNewTierPct] = useState<number>(5);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Bundle> | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [pickItemId, setPickItemId] = useState('');
  const [pickQty, setPickQty] = useState(1);
  const [pickItemQ, setPickItemQ] = useState('');

  const load = async () => {
    const { data } = await c.from('catalog_bundles').select('*').order('sort_order').order('name');
    setBundles(data ?? []);
  };

  useEffect(() => {
    load();
    c.from('catalog_items').select('id, sku, name').order('name').limit(3000).then(({ data }: any) => setItems(data ?? []));
  }, []);

  useEffect(() => {
    if (!selected) { setBundleItems([]); setTiers([]); return; }
    c.from('catalog_bundle_items').select('*').eq('bundle_id', selected.id).order('sort_order').then(({ data }: any) => setBundleItems(data ?? []));
    c.from('catalog_bundle_price_tiers').select('*').eq('bundle_id', selected.id).order('min_quantity').then(({ data }: any) => setTiers(data ?? []));
  }, [selected]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return bundles.filter(b => {
      if (showOnlyActive && !b.is_active) return false;
      if (!n) return true;
      return b.name.toLowerCase().includes(n) || (b.category ?? '').toLowerCase().includes(n);
    });
  }, [bundles, q, showOnlyActive]);

  const itemsById = useMemo(() => {
    const m: Record<string, Item> = {};
    items.forEach(i => { m[i.id] = i; });
    return m;
  }, [items]);

  const filteredPickItems = useMemo(() => {
    const n = pickItemQ.trim().toLowerCase();
    if (!n) return items.slice(0, 200);
    return items.filter(i => i.name.toLowerCase().includes(n) || i.sku.toLowerCase().includes(n)).slice(0, 200);
  }, [items, pickItemQ]);

  const openNew = () => { setEditing({ name: '', description: '', category: '', is_active: true, default_discount_pct: 0, sort_order: 0 }); setEditOpen(true); };
  const openEdit = (b: Bundle) => { setEditing({ ...b }); setEditOpen(true); };

  const saveBundle = async () => {
    if (!editing?.name?.trim()) { toast({ title: 'Name erforderlich', variant: 'destructive' }); return; }
    const payload = {
      name: editing.name,
      description: editing.description ?? null,
      category: editing.category ?? null,
      is_active: editing.is_active ?? true,
      default_discount_pct: Number(editing.default_discount_pct ?? 0),
      sort_order: Number(editing.sort_order ?? 0),
      notes: editing.notes ?? null,
    };
    if ((editing as any).id) {
      const { error } = await c.from('catalog_bundles').update(payload).eq('id', (editing as any).id);
      if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Bundle aktualisiert' });
    } else {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await c.from('catalog_bundles').insert({ ...payload, created_by: userRes?.user?.id ?? null });
      if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Bundle angelegt' });
    }
    setEditOpen(false);
    await load();
  };

  const deleteBundle = async (b: Bundle) => {
    if (!confirm(`Bundle "${b.name}" löschen?`)) return;
    const { error } = await c.from('catalog_bundles').delete().eq('id', b.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    if (selected?.id === b.id) setSelected(null);
    toast({ title: 'Bundle gelöscht' });
    load();
  };

  const addBundleItem = async () => {
    if (!selected || !pickItemId) return;
    const nextSort = bundleItems.length ? Math.max(...bundleItems.map(b => b.sort_order)) + 1 : 0;
    const { error } = await c.from('catalog_bundle_items').insert({
      bundle_id: selected.id,
      item_id: pickItemId,
      quantity: pickQty,
      discount_pct: 0,
      sort_order: nextSort,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setAddItemOpen(false); setPickItemId(''); setPickQty(1); setPickItemQ('');
    const { data } = await c.from('catalog_bundle_items').select('*').eq('bundle_id', selected.id).order('sort_order');
    setBundleItems(data ?? []);
  };

  const updateBundleItem = async (bi: BundleItem, patch: Partial<BundleItem>) => {
    const { error } = await c.from('catalog_bundle_items').update(patch).eq('id', bi.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setBundleItems(prev => prev.map(x => x.id === bi.id ? { ...x, ...patch } : x));
  };

  const removeBundleItem = async (bi: BundleItem) => {
    const { error } = await c.from('catalog_bundle_items').delete().eq('id', bi.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setBundleItems(prev => prev.filter(x => x.id !== bi.id));
  };

  const addTier = async () => {
    if (!selected) return;
    if (!newTierQty || newTierQty < 1) { toast({ title: 'Mindestmenge ≥ 1', variant: 'destructive' }); return; }
    if (tiers.some(t => t.min_quantity === newTierQty)) { toast({ title: 'Staffel existiert bereits', variant: 'destructive' }); return; }
    const { data, error } = await c.from('catalog_bundle_price_tiers')
      .insert({ bundle_id: selected.id, min_quantity: newTierQty, discount_pct: newTierPct })
      .select('*').maybeSingle();
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    if (data) setTiers(prev => [...prev, data].sort((a, b) => a.min_quantity - b.min_quantity));
    setNewTierQty(prev => prev + 1); setNewTierPct(0);
  };

  const updateTier = async (t: PriceTier, patch: Partial<PriceTier>) => {
    const { error } = await c.from('catalog_bundle_price_tiers').update(patch).eq('id', t.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setTiers(prev => prev.map(x => x.id === t.id ? { ...x, ...patch } : x).sort((a, b) => a.min_quantity - b.min_quantity));
  };

  const removeTier = async (t: PriceTier) => {
    const { error } = await c.from('catalog_bundle_price_tiers').delete().eq('id', t.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setTiers(prev => prev.filter(x => x.id !== t.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Angebots-Vorlagen & Bundles</h2>
        <Badge variant="outline" className="ml-2 text-xs">{bundles.length} Bundles</Badge>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-64" placeholder="Bundles filtern…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showOnlyActive} onCheckedChange={setShowOnlyActive} /> nur aktive
          </div>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Neues Bundle</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Bundles</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[560px] overflow-auto">
            <Table>
              <TableBody>
                {filtered.map(b => (
                  <TableRow
                    key={b.id}
                    className={`cursor-pointer ${selected?.id === b.id ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelected(b)}
                  >
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{b.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {b.category ?? '—'} · {b.default_discount_pct}% Rabatt
                          </div>
                        </div>
                        {!b.is_active && <Badge variant="outline" className="text-[10px]">inaktiv</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell className="text-center py-6 text-muted-foreground">Keine Bundles</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">
              {selected ? selected.name : 'Bundle wählen'}
            </CardTitle>
            {selected && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(selected)}><Pencil className="h-4 w-4 mr-1" />Bearbeiten</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteBundle(selected)}><Trash2 className="h-4 w-4 mr-1" />Löschen</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Bitte ein Bundle aus der Liste wählen.</div>
            ) : (
              <>
                {selected.description && <p className="text-sm text-muted-foreground mb-3">{selected.description}</p>}
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-muted-foreground">{bundleItems.length} Positionen</div>
                  <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)}><Plus className="h-4 w-4 mr-1" />Artikel hinzufügen</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artikel</TableHead>
                      <TableHead className="w-24">Menge</TableHead>
                      <TableHead className="w-28">Rabatt %</TableHead>
                      <TableHead className="w-24">Optional</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundleItems.map(bi => {
                      const it = itemsById[bi.item_id];
                      return (
                        <TableRow key={bi.id}>
                          <TableCell>
                            <div className="text-sm">{it?.name ?? '—'}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{it?.sku}</div>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.5" defaultValue={bi.quantity}
                              onBlur={(e) => updateBundleItem(bi, { quantity: Number(e.target.value) })}
                              className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.5" defaultValue={bi.discount_pct}
                              onBlur={(e) => updateBundleItem(bi, { discount_pct: Number(e.target.value) })}
                              className="h-8" />
                          </TableCell>
                          <TableCell>
                            <Switch checked={bi.is_optional} onCheckedChange={(v) => updateBundleItem(bi, { is_optional: v })} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeBundleItem(bi)}><X className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {bundleItems.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Noch keine Artikel im Bundle.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit/New Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{(editing as any)?.id ? 'Bundle bearbeiten' : 'Neues Bundle'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={editing?.name ?? ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} /></div>
            <div><Label>Kategorie</Label><Input value={editing?.category ?? ''} onChange={(e) => setEditing({ ...editing!, category: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea value={editing?.description ?? ''} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Standard-Rabatt %</Label><Input type="number" min={0} value={editing?.default_discount_pct ?? 0} onChange={(e) => setEditing({ ...editing!, default_discount_pct: Number(e.target.value) })} /></div>
              <div><Label>Sortierung</Label><Input type="number" value={editing?.sort_order ?? 0} onChange={(e) => setEditing({ ...editing!, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing!, is_active: v })} />
              <Label>Aktiv</Label>
            </div>
            <div><Label>Interne Notizen</Label><Textarea value={editing?.notes ?? ''} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={saveBundle}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Artikel zum Bundle hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Artikel suchen</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" value={pickItemQ} onChange={(e) => setPickItemQ(e.target.value)} placeholder="SKU oder Name…" />
              </div>
            </div>
            <Select value={pickItemId} onValueChange={setPickItemId}>
              <SelectTrigger><SelectValue placeholder="Artikel wählen" /></SelectTrigger>
              <SelectContent>
                {filteredPickItems.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    <span className="font-mono text-xs mr-2">{i.sku}</span>{i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>
              <Label>Menge</Label>
              <Input type="number" min={0} step="0.5" value={pickQty} onChange={(e) => setPickQty(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddItemOpen(false)}>Abbrechen</Button>
            <Button onClick={addBundleItem} disabled={!pickItemId}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
