import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus, ChevronRight, ChevronDown, FolderTree, Pencil, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Cat {
  id: string;
  parent_id: string | null;
  slug: string;
  names: Record<string, string> | null;
  sort_order: number | null;
  is_active: boolean;
}

interface Node extends Cat {
  children: Node[];
  depth: number;
}

function buildTree(rows: Cat[]): Node[] {
  const map = new Map<string, Node>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [], depth: 0 }));
  const roots: Node[] = [];
  map.forEach((n) => {
    if (n.parent_id && map.has(n.parent_id)) {
      const p = map.get(n.parent_id)!;
      n.depth = p.depth + 1;
      p.children.push(n);
    } else {
      roots.push(n);
    }
  });
  const sortRec = (arr: Node[]) => {
    arr.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.slug.localeCompare(b.slug));
    arr.forEach((c) => { c.children.forEach((child) => { child.depth = c.depth + 1; }); sortRec(c.children); });
  };
  sortRec(roots);
  return roots;
}

export default function KatalogKategorien() {
  const { toast } = useToast();
  const client = supabase as any;
  const [rows, setRows] = useState<Cat[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<{ slug: string; name_de: string; name_en: string; sort_order: number; parent_id: string | null }>({
    slug: '', name_de: '', name_en: '', sort_order: 100, parent_id: null,
  });
  const [editing, setEditing] = useState<Cat | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const load = async () => {
    const [{ data: cats }, { data: assigns }] = await Promise.all([
      client.from('catalog_categories').select('*').order('sort_order'),
      client.from('item_category_assignments').select('category_id'),
    ]);
    setRows((cats ?? []) as Cat[]);
    const c: Record<string, number> = {};
    (assigns ?? []).forEach((a: any) => { c[a.category_id] = (c[a.category_id] ?? 0) + 1; });
    setCounts(c);
  };
  useEffect(() => { load(); }, []);

  const tree = useMemo(() => buildTree(rows), [rows]);

  const add = async () => {
    if (!form.slug || !form.name_de) return toast({ title: 'Slug und Name (DE) erforderlich', variant: 'destructive' });
    const names: Record<string, string> = { de: form.name_de };
    if (form.name_en.trim()) names.en = form.name_en.trim();
    const { error } = await client.from('catalog_categories').insert({
      slug: form.slug.trim(), names, sort_order: form.sort_order, parent_id: form.parent_id, is_active: true,
    });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setForm({ slug: '', name_de: '', name_en: '', sort_order: 100, parent_id: null });
    toast({ title: 'Kategorie angelegt' });
    load();
  };

  const del = async (n: Node) => {
    if (n.children.length > 0) return toast({ title: 'Unterkategorien vorhanden', description: 'Zuerst Unterkategorien entfernen.', variant: 'destructive' });
    if ((counts[n.id] ?? 0) > 0) return toast({ title: 'Kategorie wird verwendet', description: `${counts[n.id]} Artikel sind zugeordnet.`, variant: 'destructive' });
    if (!confirm(`Kategorie „${n.names?.de ?? n.slug}" löschen? (nur Super Admin erlaubt)`)) return;
    const { error } = await client.from('catalog_categories').delete().eq('id', n.id);
    if (error) return toast({ title: 'Löschen fehlgeschlagen', description: error.message, variant: 'destructive' });
    load();
  };

  const openEdit = (c: Cat) => {
    setEditing(c);
    setEditForm({
      slug: c.slug,
      name_de: c.names?.de ?? '',
      name_en: c.names?.en ?? '',
      sort_order: c.sort_order ?? 100,
      parent_id: c.parent_id,
      is_active: c.is_active,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (editForm.parent_id === editing.id) return toast({ title: 'Ungültig', description: 'Kategorie kann nicht sich selbst als Elternteil haben.', variant: 'destructive' });
    const names: Record<string, string> = { ...(editing.names ?? {}), de: editForm.name_de };
    if (editForm.name_en?.trim()) names.en = editForm.name_en.trim(); else delete names.en;
    const { error } = await client.from('catalog_categories').update({
      slug: editForm.slug.trim(),
      names,
      sort_order: editForm.sort_order,
      parent_id: editForm.parent_id || null,
      is_active: editForm.is_active,
    }).eq('id', editing.id);
    if (error) return toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
    toast({ title: 'Gespeichert' });
    setEditing(null);
    load();
  };

  const flatOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    const walk = (nodes: Node[], prefix: string) => {
      nodes.forEach((n) => {
        out.push({ id: n.id, label: `${prefix}${n.names?.de ?? n.slug}` });
        walk(n.children, prefix + '— ');
      });
    };
    walk(tree, '');
    return out;
  }, [tree]);

  const renderNode = (n: Node) => {
    const hasChildren = n.children.length > 0;
    const open = expanded[n.id] ?? true;
    const count = counts[n.id] ?? 0;
    return (
      <div key={n.id}>
        <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50" style={{ paddingLeft: n.depth * 20 + 8 }}>
          <button
            onClick={() => setExpanded((e) => ({ ...e, [n.id]: !open }))}
            className="w-5 h-5 flex items-center justify-center text-muted-foreground"
          >
            {hasChildren ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="w-4 h-4 inline-block" />}
          </button>
          <FolderTree className="h-4 w-4 text-primary/70" />
          <span className="font-medium">{n.names?.de ?? n.slug}</span>
          <span className="text-xs font-mono text-muted-foreground">{n.slug}</span>
          {!n.is_active && <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">inaktiv</Badge>}
          {count > 0 && (
            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
              <Package className="h-3 w-3 mr-1" />{count}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, parent_id: n.id })} title="Unterkategorie anlegen">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => del(n)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        {hasChildren && open && n.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Neue Kategorie</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="z.B. laser-diode" /></div>
          <div><Label>Name (DE) *</Label><Input value={form.name_de} onChange={(e) => setForm({ ...form, name_de: e.target.value })} /></div>
          <div><Label>Name (EN)</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
          <div>
            <Label>Übergeordnet</Label>
            <Select value={form.parent_id ?? '__none__'} onValueChange={(v) => setForm({ ...form, parent_id: v === '__none__' ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">(Wurzel)</SelectItem>
                {flatOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Sortierung</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          <div className="flex items-end"><Button onClick={add} className="w-full"><Plus className="h-4 w-4 mr-1" />Anlegen</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Kategoriebaum</CardTitle></CardHeader>
        <CardContent>
          {tree.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Noch keine Kategorien angelegt.</div>
          ) : (
            <div className="space-y-0.5">{tree.map(renderNode)}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kategorie bearbeiten</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Slug</Label><Input value={editForm.slug ?? ''} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name (DE)</Label><Input value={editForm.name_de ?? ''} onChange={(e) => setEditForm({ ...editForm, name_de: e.target.value })} /></div>
              <div><Label>Name (EN)</Label><Input value={editForm.name_en ?? ''} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} /></div>
            </div>
            <div>
              <Label>Übergeordnet</Label>
              <Select value={editForm.parent_id ?? '__none__'} onValueChange={(v) => setEditForm({ ...editForm, parent_id: v === '__none__' ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">(Wurzel)</SelectItem>
                  {flatOptions.filter((o) => o.id !== editing?.id).map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Sortierung</Label><Input type="number" value={editForm.sort_order ?? 100} onChange={(e) => setEditForm({ ...editForm, sort_order: Number(e.target.value) })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.is_active ? 'true' : 'false'} onValueChange={(v) => setEditForm({ ...editForm, is_active: v === 'true' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Aktiv</SelectItem>
                    <SelectItem value="false">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
            <Button onClick={saveEdit}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
