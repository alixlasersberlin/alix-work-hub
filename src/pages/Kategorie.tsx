import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, FolderTree, Plus, Pencil, Trash2, Package, X } from 'lucide-react';

type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
};

type ZohoItem = {
  id: string;
  name: string | null;
  sku: string | null;
  category_name: string | null;
  brand: string | null;
};

type Assignment = { item_id: string; category_id: string };

const PRESET_COLORS = ['#D4AF37', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#EC4899', '#6B7280'];

export default function Kategorie() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<ZohoItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [itemQuery, setItemQuery] = useState('');

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '', color: PRESET_COLORS[0] });

  const loadAll = async () => {
    setLoading(true);
    const [catRes, itemRes, asgRes] = await Promise.all([
      supabase.from('product_categories').select('id,name,description,color').order('name'),
      supabase.from('zoho_items').select('id,name,sku,category_name,brand').order('name').limit(5000),
      supabase.from('item_category_assignments').select('item_id,category_id'),
    ]);
    if (catRes.error) toast({ title: 'Fehler', description: catRes.error.message, variant: 'destructive' });
    if (itemRes.error) toast({ title: 'Fehler', description: itemRes.error.message, variant: 'destructive' });
    if (asgRes.error) toast({ title: 'Fehler', description: asgRes.error.message, variant: 'destructive' });
    setCategories((catRes.data as Category[]) ?? []);
    setItems((itemRes.data as ZohoItem[]) ?? []);
    setAssignments((asgRes.data as Assignment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const assignmentsByCat = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (!m.has(a.category_id)) m.set(a.category_id, new Set());
      m.get(a.category_id)!.add(a.item_id);
    }
    return m;
  }, [assignments]);

  const categoriesByItem = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of assignments) {
      if (!m.has(a.item_id)) m.set(a.item_id, []);
      m.get(a.item_id)!.push(a.category_id);
    }
    return m;
  }, [assignments]);

  const itemsForActive = useMemo(() => {
    if (!activeCat) return [];
    const ids = assignmentsByCat.get(activeCat) ?? new Set();
    return items.filter(i => ids.has(i.id));
  }, [activeCat, assignmentsByCat, items]);

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      `${i.name ?? ''} ${i.sku ?? ''} ${i.category_name ?? ''} ${i.brand ?? ''}`.toLowerCase().includes(q),
    );
  }, [items, itemQuery]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', color: PRESET_COLORS[0] });
    setEditOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? '', color: c.color ?? PRESET_COLORS[0] });
    setEditOpen(true);
  };

  const saveCategory = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name erforderlich', variant: 'destructive' });
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
    };
    const res = editing
      ? await supabase.from('product_categories').update(payload).eq('id', editing.id)
      : await supabase.from('product_categories').insert(payload);
    if (res.error) {
      toast({ title: 'Fehler', description: res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editing ? 'Kategorie aktualisiert' : 'Kategorie angelegt' });
    setEditOpen(false);
    loadAll();
  };

  const deleteCategory = async (c: Category) => {
    if (!confirm(`Kategorie „${c.name}" wirklich löschen? Zuordnungen werden ebenfalls entfernt.`)) return;
    const { error } = await supabase.from('product_categories').delete().eq('id', c.id);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    if (activeCat === c.id) setActiveCat(null);
    toast({ title: 'Kategorie gelöscht' });
    loadAll();
  };

  const toggleAssignment = async (itemId: string, categoryId: string, assigned: boolean) => {
    if (assigned) {
      const { error } = await supabase
        .from('item_category_assignments')
        .delete()
        .eq('item_id', itemId)
        .eq('category_id', categoryId);
      if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
      setAssignments(prev => prev.filter(a => !(a.item_id === itemId && a.category_id === categoryId)));
    } else {
      const { error } = await supabase
        .from('item_category_assignments')
        .insert({ item_id: itemId, category_id: categoryId });
      if (error) { toast({ title: 'Fehler', description: error.message, variant: 'destructive' }); return; }
      setAssignments(prev => [...prev, { item_id: itemId, category_id: categoryId }]);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text flex items-center gap-2">
            <FolderTree className="w-6 h-6" /> Kategorie
          </h1>
          <p className="text-sm text-muted-foreground">
            Eigene Kategorien anlegen und Artikel zuordnen.
          </p>
        </div>
        <Button onClick={openCreate} className="gold-gradient text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Neue Kategorie
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories list */}
        <Card className="p-4 lg:col-span-1 space-y-2">
          <div className="text-xs uppercase text-muted-foreground mb-2">Kategorien ({categories.length})</div>
          {loading ? (
            <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center">
              Noch keine Kategorien. Lege jetzt deine erste an.
            </div>
          ) : (
            <ul className="space-y-1">
              {categories.map(c => {
                const count = assignmentsByCat.get(c.id)?.size ?? 0;
                const active = activeCat === c.id;
                return (
                  <li
                    key={c.id}
                    className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer ${
                      active ? 'bg-primary/15 border border-primary/40' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => setActiveCat(active ? null : c.id)}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: c.color ?? '#D4AF37' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground truncate">{c.description}</div>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      title="Bearbeiten"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteCategory(c); }}
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Items / assignments */}
        <Card className="p-4 lg:col-span-2 space-y-4">
          {!activeCat ? (
            <div className="text-sm text-muted-foreground p-12 text-center">
              Wähle links eine Kategorie aus, um Artikel zuzuordnen.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Aktive Kategorie</div>
                  <div className="text-lg font-semibold">
                    {categories.find(c => c.id === activeCat)?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {itemsForActive.length} Artikel zugeordnet
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActiveCat(null)}>
                  <X className="w-4 h-4 mr-1" /> Schließen
                </Button>
              </div>

              {/* Currently assigned */}
              {itemsForActive.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Zugeordnet</div>
                  <div className="flex flex-wrap gap-1">
                    {itemsForActive.map(it => (
                      <Badge
                        key={it.id}
                        variant="secondary"
                        className="cursor-pointer hover:bg-destructive/20"
                        onClick={() => toggleAssignment(it.id, activeCat, true)}
                        title="Klicken zum Entfernen"
                      >
                        {it.name} <X className="w-3 h-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Item search & checklist */}
              <div className="space-y-2">
                <div className="text-xs uppercase text-muted-foreground">Artikel zuordnen</div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Suche nach Name, SKU, Marke..."
                    value={itemQuery}
                    onChange={e => setItemQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="border border-border rounded-md max-h-[480px] overflow-auto divide-y divide-border">
                  {filteredItems.slice(0, 300).map(it => {
                    const assigned = assignmentsByCat.get(activeCat)?.has(it.id) ?? false;
                    const itemCats = categoriesByItem.get(it.id) ?? [];
                    return (
                      <label
                        key={it.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/20 cursor-pointer"
                      >
                        <Checkbox
                          checked={assigned}
                          onCheckedChange={() => toggleAssignment(it.id, activeCat, assigned)}
                        />
                        <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{it.name ?? '–'}</div>
                          <div className="text-xs text-muted-foreground font-mono truncate">
                            {it.sku ?? ''}{it.brand ? ` · ${it.brand}` : ''}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                          {itemCats
                            .map(cid => categories.find(c => c.id === cid))
                            .filter(Boolean)
                            .slice(0, 3)
                            .map(c => (
                              <span
                                key={c!.id}
                                className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${c!.color ?? '#D4AF37'}22`,
                                  color: c!.color ?? '#D4AF37',
                                }}
                              >
                                {c!.name}
                              </span>
                            ))}
                        </div>
                      </label>
                    );
                  })}
                  {filteredItems.length > 300 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                      … {filteredItems.length - 300} weitere – bitte Suche verfeinern.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Edit / create dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Kategorie bearbeiten' : 'Neue Kategorie'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Farbe</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      form.color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
            <Button onClick={saveCategory} className="gold-gradient text-primary-foreground">
              {editing ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
