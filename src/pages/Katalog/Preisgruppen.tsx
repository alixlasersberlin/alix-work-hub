import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Trash2, Pencil, Search, X } from 'lucide-react';

interface PriceGroup {
  id: string;
  code: string;
  name: string;
  default_discount_pct: number;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
}
interface Override {
  id: string;
  price_group_id: string;
  scope_type: 'country' | 'bundle' | 'item' | 'category';
  scope_id: string;
  discount_pct: number;
  fixed_net: number | null;
  note: string | null;
}
interface CustomerLink {
  id: string;
  customer_id: string;
  price_group_id: string;
}

export default function KatalogPreisgruppen() {
  const c = supabase as any;
  const { toast } = useToast();
  const [groups, setGroups] = useState<PriceGroup[]>([]);
  const [selected, setSelected] = useState<PriceGroup | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [links, setLinks] = useState<CustomerLink[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; email: string | null }>>([]);
  const [countries, setCountries] = useState<Array<{ id: string; iso_code: string; name: string }>>([]);
  const [bundles, setBundles] = useState<Array<{ id: string; name: string }>>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<PriceGroup> | null>(null);
  const [ovOpen, setOvOpen] = useState(false);
  const [newOv, setNewOv] = useState<{ scope_type: 'country' | 'bundle'; scope_id: string; discount_pct: number; fixed_net: string; note: string }>({ scope_type: 'country', scope_id: '', discount_pct: 0, fixed_net: '', note: '' });
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');

  const load = async () => {
    const { data } = await c.from('catalog_price_groups').select('*').order('sort_order').order('name');
    setGroups(data ?? []);
  };
  useEffect(() => {
    load();
    c.from('catalog_countries').select('id, iso_code, name').order('iso_code').then(({ data }: any) => setCountries(data ?? []));
    c.from('catalog_bundles').select('id, name').eq('is_active', true).order('name').then(({ data }: any) => setBundles(data ?? []));
    c.from('customers').select('id, name, email').order('name').limit(2000).then(({ data }: any) => setCustomers(data ?? []));
  }, []);

  useEffect(() => {
    if (!selected) { setOverrides([]); setLinks([]); return; }
    c.from('catalog_price_group_overrides').select('*').eq('price_group_id', selected.id).then(({ data }: any) => setOverrides(data ?? []));
    c.from('catalog_customer_price_group').select('*').eq('price_group_id', selected.id).then(({ data }: any) => setLinks(data ?? []));
  }, [selected]);

  const openNew = () => { setEditing({ code: '', name: '', default_discount_pct: 0, is_active: true, sort_order: 0 }); setEditOpen(true); };
  const openEdit = (g: PriceGroup) => { setEditing({ ...g }); setEditOpen(true); };

  const saveGroup = async () => {
    if (!editing?.code?.trim() || !editing?.name?.trim()) { toast({ title: 'Code & Name erforderlich', variant: 'destructive' }); return; }
    const payload = {
      code: editing.code.toLowerCase().trim(),
      name: editing.name.trim(),
      default_discount_pct: Number(editing.default_discount_pct ?? 0),
      is_active: editing.is_active ?? true,
      sort_order: Number(editing.sort_order ?? 0),
      notes: editing.notes ?? null,
    };
    const { error } = (editing as any).id
      ? await c.from('catalog_price_groups').update(payload).eq('id', (editing as any).id)
      : await c.from('catalog_price_groups').insert(payload);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Gespeichert' });
    setEditOpen(false); load();
  };

  const deleteGroup = async (g: PriceGroup) => {
    if (!confirm(`Preisgruppe "${g.name}" löschen? Zugewiesene Kunden verlieren die Zuordnung.`)) return;
    const { error } = await c.from('catalog_price_groups').delete().eq('id', g.id);
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    if (selected?.id === g.id) setSelected(null);
    load();
  };

  const addOverride = async () => {
    if (!selected || !newOv.scope_id) { toast({ title: 'Bitte Bereich wählen', variant: 'destructive' }); return; }
    const { error } = await c.from('catalog_price_group_overrides').insert({
      price_group_id: selected.id,
      scope_type: newOv.scope_type,
      scope_id: newOv.scope_id,
      discount_pct: Number(newOv.discount_pct),
      fixed_net: newOv.fixed_net ? Number(newOv.fixed_net) : null,
      note: newOv.note || null,
    });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    setOvOpen(false); setNewOv({ scope_type: 'country', scope_id: '', discount_pct: 0, fixed_net: '', note: '' });
    c.from('catalog_price_group_overrides').select('*').eq('price_group_id', selected.id).then(({ data }: any) => setOverrides(data ?? []));
  };
  const removeOverride = async (o: Override) => {
    await c.from('catalog_price_group_overrides').delete().eq('id', o.id);
    setOverrides(prev => prev.filter(x => x.id !== o.id));
  };

  const assignCustomer = async (customerId: string) => {
    if (!selected) return;
    // upsert (unique on customer_id)
    const { error } = await c.from('catalog_customer_price_group')
      .upsert({ customer_id: customerId, price_group_id: selected.id }, { onConflict: 'customer_id' });
    if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
    c.from('catalog_customer_price_group').select('*').eq('price_group_id', selected.id).then(({ data }: any) => setLinks(data ?? []));
    toast({ title: 'Kunde zugeordnet' });
  };
  const removeAssignment = async (link: CustomerLink) => {
    await c.from('catalog_customer_price_group').delete().eq('id', link.id);
    setLinks(prev => prev.filter(x => x.id !== link.id));
  };

  const custMap = useMemo(() => {
    const m: Record<string, { name: string; email: string | null }> = {};
    customers.forEach(c => { m[c.id] = { name: c.name, email: c.email }; });
    return m;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const n = assignSearch.trim().toLowerCase();
    const linkedIds = new Set(links.map(l => l.customer_id));
    return customers
      .filter(c => !linkedIds.has(c.id))
      .filter(c => !n || c.name.toLowerCase().includes(n) || (c.email ?? '').toLowerCase().includes(n))
      .slice(0, 100);
  }, [customers, links, assignSearch]);

  const scopeLabel = (o: Override) => {
    if (o.scope_type === 'country') return countries.find(x => x.id === o.scope_id)?.iso_code ?? '—';
    if (o.scope_type === 'bundle') return bundles.find(x => x.id === o.scope_id)?.name ?? '—';
    return o.scope_id;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Kunden- & Preisgruppen</h2>
        <Badge variant="outline" className="ml-2 text-xs">{groups.length}</Badge>
        <Button size="sm" className="ml-auto" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Neue Preisgruppe</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Preisgruppen</CardTitle></CardHeader>
          <CardContent className="p-0 max-h-[560px] overflow-auto">
            <Table>
              <TableBody>
                {groups.map(g => (
                  <TableRow key={g.id} className={`cursor-pointer ${selected?.id === g.id ? 'bg-primary/5' : ''}`} onClick={() => setSelected(g)}>
                    <TableCell>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{g.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{g.code} · {g.default_discount_pct}%</div>
                        </div>
                        {!g.is_active && <Badge variant="outline" className="text-[10px]">inaktiv</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {groups.length === 0 && <TableRow><TableCell className="text-center py-6 text-muted-foreground">Noch keine Preisgruppen.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">{selected ? selected.name : 'Preisgruppe wählen'}</CardTitle>
            {selected && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(selected)}><Pencil className="h-4 w-4 mr-1" />Bearbeiten</Button>
                <Button variant="ghost" size="sm" onClick={() => deleteGroup(selected)}><Trash2 className="h-4 w-4 mr-1" />Löschen</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="text-sm text-muted-foreground py-10 text-center">Bitte eine Preisgruppe auswählen.</div>
            ) : (
              <Tabs defaultValue="overrides">
                <TabsList>
                  <TabsTrigger value="overrides">Rabatt-Overrides ({overrides.length})</TabsTrigger>
                  <TabsTrigger value="customers">Kunden ({links.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="overrides" className="space-y-3">
                  <p className="text-xs text-muted-foreground">Standardrabatt: <strong>{selected.default_discount_pct}%</strong>. Overrides überschreiben pro Land oder Bundle.</p>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setOvOpen(true)}><Plus className="h-4 w-4 mr-1" />Override hinzufügen</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Typ</TableHead>
                        <TableHead>Bereich</TableHead>
                        <TableHead className="w-24 text-right">Rabatt %</TableHead>
                        <TableHead className="w-32 text-right">Festpreis netto</TableHead>
                        <TableHead>Notiz</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overrides.map(o => (
                        <TableRow key={o.id}>
                          <TableCell className="text-xs uppercase text-muted-foreground">{o.scope_type}</TableCell>
                          <TableCell>{scopeLabel(o)}</TableCell>
                          <TableCell className="text-right">{o.discount_pct}%</TableCell>
                          <TableCell className="text-right">{o.fixed_net != null ? Number(o.fixed_net).toFixed(2) : '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{o.note ?? '—'}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => removeOverride(o)}><X className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                      {overrides.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-4 text-xs text-muted-foreground">Keine Overrides – Standardrabatt gilt.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TabsContent>
                <TabsContent value="customers" className="space-y-3">
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4 mr-1" />Kunde zuordnen</Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kunde</TableHead>
                        <TableHead>E-Mail</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {links.map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{custMap[l.customer_id]?.name ?? l.customer_id}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{custMap[l.customer_id]?.email ?? '—'}</TableCell>
                          <TableCell><Button variant="ghost" size="icon" onClick={() => removeAssignment(l)}><X className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                      {links.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground">Noch keine Kunden zugeordnet.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{(editing as any)?.id ? 'Preisgruppe bearbeiten' : 'Neue Preisgruppe'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code *</Label><Input value={editing?.code ?? ''} onChange={(e) => setEditing({ ...editing!, code: e.target.value })} placeholder="vip" /></div>
              <div><Label>Name *</Label><Input value={editing?.name ?? ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} placeholder="VIP-Kunden" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Standard-Rabatt %</Label><Input type="number" min={0} max={100} step="0.5" value={editing?.default_discount_pct ?? 0} onChange={(e) => setEditing({ ...editing!, default_discount_pct: Number(e.target.value) })} /></div>
              <div><Label>Sortierung</Label><Input type="number" value={editing?.sort_order ?? 0} onChange={(e) => setEditing({ ...editing!, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing!, is_active: v })} /><Label>Aktiv</Label></div>
            <div><Label>Notizen</Label><Textarea value={editing?.notes ?? ''} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={saveGroup}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override dialog */}
      <Dialog open={ovOpen} onOpenChange={setOvOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rabatt-Override hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Typ</Label>
              <Select value={newOv.scope_type} onValueChange={(v) => setNewOv({ ...newOv, scope_type: v as any, scope_id: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="country">Land</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{newOv.scope_type === 'country' ? 'Land' : 'Bundle'}</Label>
              <Select value={newOv.scope_id} onValueChange={(v) => setNewOv({ ...newOv, scope_id: v })}>
                <SelectTrigger><SelectValue placeholder="Bitte wählen" /></SelectTrigger>
                <SelectContent>
                  {newOv.scope_type === 'country'
                    ? countries.map(x => <SelectItem key={x.id} value={x.id}>{x.iso_code} · {x.name}</SelectItem>)
                    : bundles.map(x => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rabatt %</Label><Input type="number" min={0} max={100} step="0.5" value={newOv.discount_pct} onChange={(e) => setNewOv({ ...newOv, discount_pct: Number(e.target.value) })} /></div>
              <div><Label>Festpreis netto (optional)</Label><Input type="number" min={0} step="0.01" value={newOv.fixed_net} onChange={(e) => setNewOv({ ...newOv, fixed_net: e.target.value })} /></div>
            </div>
            <div><Label>Notiz</Label><Input value={newOv.note} onChange={(e) => setNewOv({ ...newOv, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOvOpen(false)}>Abbrechen</Button>
            <Button onClick={addOverride}>Hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign customer dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Kunde zuordnen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Kunden suchen…" value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} />
            </div>
            <div className="max-h-96 overflow-auto border rounded-md">
              <Table>
                <TableBody>
                  {filteredCustomers.map(cu => (
                    <TableRow key={cu.id}>
                      <TableCell>
                        <div className="font-medium">{cu.name}</div>
                        <div className="text-xs text-muted-foreground">{cu.email ?? '—'}</div>
                      </TableCell>
                      <TableCell className="w-24 text-right">
                        <Button size="sm" variant="outline" onClick={() => assignCustomer(cu.id)}>Zuordnen</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCustomers.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-xs text-muted-foreground">Keine Treffer.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setAssignOpen(false)}>Schließen</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
