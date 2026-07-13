import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye, CheckCircle2, Archive, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Item {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: string;
  category_id: string | null;
  updated_at: string;
}
interface Cat { id: string; slug: string; names: any; parent_id: string | null; sort_order: number | null; }

const STATUS_TONES: Record<string, string> = {
  entwurf: 'bg-muted text-muted-foreground',
  zur_pruefung: 'bg-blue-500/15 text-blue-500',
  freigegeben: 'bg-emerald-500/15 text-emerald-500',
  aktiv: 'bg-emerald-500/15 text-emerald-500',
  archiviert: 'bg-red-500/15 text-red-500',
  gesperrt: 'bg-red-500/15 text-red-500',
  inaktiv: 'bg-muted text-muted-foreground',
};

export default function KatalogArtikel() {
  const { toast } = useToast();
  const client = supabase as any;
  const [rows, setRows] = useState<Item[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [cats, setCats] = useState<Cat[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ sku: '', name: '', brand: '', model: '', notes_internal: '' });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: items, error }, { data: catsData }, { data: assigns }] = await Promise.all([
      client.from('catalog_items').select('id, sku, name, brand, model, status, category_id, updated_at').order('updated_at', { ascending: false }).limit(1000),
      client.from('catalog_categories').select('id, slug, names, parent_id, sort_order').order('sort_order'),
      client.from('item_category_assignments').select('item_id, category_id'),
    ]);
    if (error) toast({ title: 'Fehler beim Laden', description: error.message, variant: 'destructive' });
    setRows((items ?? []) as Item[]);
    setCats((catsData ?? []) as Cat[]);
    const map: Record<string, string[]> = {};
    (assigns ?? []).forEach((a: any) => {
      map[a.item_id] = [...(map[a.item_id] ?? []), a.category_id];
    });
    setAssignments(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const catName = (id: string) => {
    const c = cats.find((x) => x.id === id);
    return c?.names?.de ?? c?.slug ?? '—';
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (catFilter !== 'all') {
        const ass = assignments[r.id] ?? [];
        if (!ass.includes(catFilter) && r.category_id !== catFilter) return false;
      }
      if (!needle) return true;
      return (
        r.sku.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle) ||
        (r.brand ?? '').toLowerCase().includes(needle) ||
        (r.model ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, status, catFilter, assignments]);

  const selCount = Object.values(selected).filter(Boolean).length;
  const selIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  const toggleAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    if (v) filtered.forEach((r) => { next[r.id] = true; });
    setSelected(next);
  };

  const bulkStatus = async (newStatus: string, verb: string) => {
    if (selIds.length === 0) return;
    if (!confirm(`${selIds.length} Artikel auf „${verb}" setzen?`)) return;
    setBusy(true);
    const { error } = await client.from('catalog_items').update({ status: newStatus }).in('id', selIds);
    setBusy(false);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    toast({ title: `${selIds.length} Artikel aktualisiert` });
    setSelected({});
    load();
  };

  const bulkDelete = async () => {
    if (selIds.length === 0) return;
    if (!confirm(`${selIds.length} Artikel unwiderruflich löschen? (nur Super Admin erlaubt)`)) return;
    setBusy(true);
    const { error } = await client.from('catalog_items').delete().in('id', selIds);
    setBusy(false);
    if (error) return toast({ title: 'Löschen fehlgeschlagen', description: error.message, variant: 'destructive' });
    toast({ title: `${selIds.length} Artikel gelöscht` });
    setSelected({});
    load();
  };

  const create = async () => {
    if (!form.sku.trim() || !form.name.trim()) return toast({ title: 'SKU und Name sind Pflicht', variant: 'destructive' });
    setSaving(true);
    const { error } = await client.from('catalog_items').insert({
      sku: form.sku.trim(),
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      notes_internal: form.notes_internal.trim() || null,
      status: 'entwurf',
    });
    setSaving(false);
    if (error) return toast({ title: 'Anlage fehlgeschlagen', description: error.message, variant: 'destructive' });
    toast({ title: 'Artikel angelegt' });
    setForm({ sku: '', name: '', brand: '', model: '', notes_internal: '' });
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche nach Name, SKU, Marke, Modell…" className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="entwurf">Entwurf</SelectItem>
            <SelectItem value="zur_pruefung">Zur Prüfung</SelectItem>
            <SelectItem value="freigegeben">Freigegeben</SelectItem>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="inaktiv">Inaktiv</SelectItem>
            <SelectItem value="archiviert">Archiviert</SelectItem>
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Kategorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.names?.de ?? c.slug}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Neuer Artikel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neuen Artikel anlegen</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>SKU *</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Marke</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
                <div><Label>Modell</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              </div>
              <div><Label>Interne Notiz</Label><Textarea rows={3} value={form.notes_internal} onChange={(e) => setForm({ ...form, notes_internal: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create} disabled={saving}>{saving ? 'Speichere…' : 'Anlegen'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {selCount > 0 && (
        <Card className="p-3 flex flex-wrap items-center gap-2 border-primary/40 bg-primary/5">
          <span className="text-sm font-medium">{selCount} ausgewählt</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkStatus('aktiv', 'aktiv')}>
              <CheckCircle2 className="h-4 w-4 mr-1" />Aktivieren
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkStatus('inaktiv', 'inaktiv')}>
              Deaktivieren
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => bulkStatus('archiviert', 'archiviert')}>
              <Archive className="h-4 w-4 mr-1" />Archivieren
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={bulkDelete} className="text-red-500 hover:text-red-600">
              <Trash2 className="h-4 w-4 mr-1" />Löschen
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected({})}>Auswahl aufheben</Button>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && filtered.every((r) => selected[r.id])}
                  onCheckedChange={(v) => toggleAll(!!v)}
                />
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Marke</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Zuletzt geändert</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Lade…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Artikel</TableCell></TableRow>}
            {filtered.map((r) => {
              const cs = assignments[r.id] ?? [];
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox checked={!!selected[r.id]} onCheckedChange={(v) => setSelected({ ...selected, [r.id]: !!v })} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                  <TableCell className="font-medium">{r.name}{r.model && <span className="text-xs text-muted-foreground ml-2">{r.model}</span>}</TableCell>
                  <TableCell>{r.brand ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {cs.length > 0 ? cs.slice(0, 2).map((cid) => (
                      <Badge key={cid} variant="secondary" className="mr-1 text-[10px]">{catName(cid)}</Badge>
                    )) : '—'}
                    {cs.length > 2 && <span className="text-muted-foreground">+{cs.length - 2}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_TONES[r.status] ?? ''}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/katalog/artikel/${r.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
