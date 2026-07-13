import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye } from 'lucide-react';
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

const STATUS_TONES: Record<string, string> = {
  entwurf: 'bg-muted text-muted-foreground',
  freigegeben: 'bg-emerald-500/15 text-emerald-500',
  aktiv: 'bg-emerald-500/15 text-emerald-500',
  archiviert: 'bg-red-500/15 text-red-500',
  gesperrt: 'bg-red-500/15 text-red-500',
};

export default function KatalogArtikel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ sku: '', name: '', brand: '', model: '', notes_internal: '' });

  const load = async () => {
    setLoading(true);
    const client = supabase as any;
    const { data, error } = await client
      .from('catalog_items')
      .select('id, sku, name, brand, model, status, category_id, updated_at')
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) toast({ title: 'Fehler beim Laden', description: error.message, variant: 'destructive' });
    setRows((data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (!needle) return true;
      return (
        r.sku.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle) ||
        (r.brand ?? '').toLowerCase().includes(needle) ||
        (r.model ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, status]);

  const create = async () => {
    if (!form.sku.trim() || !form.name.trim()) {
      toast({ title: 'SKU und Name sind Pflicht', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const client = supabase as any;
    const { error } = await client.from('catalog_items').insert({
      sku: form.sku.trim(),
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      notes_internal: form.notes_internal.trim() || null,
      status: 'entwurf',
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Anlage fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
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
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Neuer Artikel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Neuen Artikel anlegen</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>SKU *</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div>
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Marke</Label>
                  <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                </div>
                <div>
                  <Label>Modell</Label>
                  <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Interne Notiz</Label>
                <Textarea rows={3} value={form.notes_internal} onChange={(e) => setForm({ ...form, notes_internal: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create} disabled={saving}>{saving ? 'Speichere…' : 'Anlegen'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Marke</TableHead>
              <TableHead>Modell</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Zuletzt geändert</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Lade…</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Artikel</TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.brand ?? '—'}</TableCell>
                <TableCell>{r.model ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={STATUS_TONES[r.status] ?? ''}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(r.updated_at).toLocaleString('de-DE')}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/katalog/artikel/${r.id}`}><Eye className="h-4 w-4" /></Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
