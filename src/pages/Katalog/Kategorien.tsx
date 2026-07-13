import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus } from 'lucide-react';

export default function KatalogKategorien() {
  const { toast } = useToast();
  const client = supabase as any;
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ slug: '', name_de: '', sort_order: 100 });

  const load = async () => {
    const { data } = await client.from('catalog_categories').select('*').order('sort_order');
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.slug || !form.name_de) return toast({ title: 'Slug und Name (DE) erforderlich' });
    const { error } = await client.from('catalog_categories').insert({
      slug: form.slug, names: { de: form.name_de }, sort_order: form.sort_order,
    });
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    setForm({ slug: '', name_de: '', sort_order: 100 });
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Kategorie löschen? (nur Super Admin erlaubt)')) return;
    const { error } = await client.from('catalog_categories').delete().eq('id', id);
    if (error) return toast({ title: 'Löschen fehlgeschlagen', description: error.message, variant: 'destructive' });
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Neue Kategorie</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
          <div><Label>Name (DE)</Label><Input value={form.name_de} onChange={(e) => setForm({ ...form, name_de: e.target.value })} /></div>
          <div><Label>Sortierung</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
          <div className="flex items-end"><Button onClick={add}><Plus className="h-4 w-4 mr-1" />Anlegen</Button></div>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Slug</TableHead><TableHead>Name (DE)</TableHead><TableHead>Sortierung</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.slug}</TableCell>
                <TableCell>{r.names?.de ?? '—'}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
