import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PackageCheck, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Item = { id: string; name: string | null; sku: string | null; stock_on_hand: number | null };
type Receipt = {
  id: string;
  created_at: string;
  item_id: string;
  item_name: string | null;
  item_sku: string | null;
  quantity: number;
  supplier: string | null;
  reference: string | null;
  note: string | null;
};

const STORAGE_KEY = 'wareneingang_receipts_v1';

export default function Wareneingang() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    (async () => {
      const PAGE = 1000;
      let from = 0;
      const all: Item[] = [];
      while (true) {
        const { data, error } = await supabase
          .from('zoho_items')
          .select('id, name, sku, stock_on_hand')
          .order('name', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) { toast.error('Artikel konnten nicht geladen werden'); break; }
        const batch = (data as Item[]) || [];
        all.push(...batch);
        if (batch.length < PAGE || from > 50000) break;
        from += PAGE;
      }
      setItems(all);
      setLoading(false);
    })();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setReceipts(JSON.parse(raw));
    } catch {}
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items.filter(i =>
      (i.name || '').toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [items, search]);

  const selected = items.find(i => i.id === selectedItemId) || null;

  const persist = (next: Receipt[]) => {
    setReceipts(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const handleBook = async () => {
    if (!selected) { toast.error('Bitte Artikel auswählen'); return; }
    const qty = Number(quantity);
    if (!qty || qty <= 0) { toast.error('Menge muss größer 0 sein'); return; }

    const newStock = (selected.stock_on_hand ?? 0) + qty;
    const { error } = await supabase
      .from('zoho_items')
      .update({ stock_on_hand: newStock })
      .eq('id', selected.id);
    if (error) {
      toast.error('Bestand konnte nicht aktualisiert werden: ' + error.message);
      return;
    }

    const r: Receipt = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      item_id: selected.id,
      item_name: selected.name,
      item_sku: selected.sku,
      quantity: qty,
      supplier: supplier.trim() || null,
      reference: reference.trim() || null,
      note: note.trim() || null,
    };
    persist([r, ...receipts]);
    setItems(prev => prev.map(it => it.id === selected.id ? { ...it, stock_on_hand: newStock } : it));
    toast.success(`Wareneingang gebucht: ${qty}× ${selected.name} (neuer Bestand: ${newStock})`);
    setQuantity(''); setSupplier(''); setReference(''); setNote(''); setSelectedItemId('');
  };


  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <PackageCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Wareneingang</h1>
          <p className="text-muted-foreground text-sm">Erfassen Sie eingehende Ware und buchen Sie diese den Artikeln zu.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Artikel auswählen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name oder SKU…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="border rounded-md max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Bestand</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Lädt…</TableCell></TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Keine Artikel gefunden</TableCell></TableRow>
                  )}
                  {filtered.map(it => (
                    <TableRow
                      key={it.id}
                      className={selectedItemId === it.id ? 'bg-primary/10' : 'cursor-pointer'}
                      onClick={() => setSelectedItemId(it.id)}
                    >
                      <TableCell className="font-medium">{it.name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{it.sku || '—'}</TableCell>
                      <TableCell className="text-right">{it.stock_on_hand ?? 0}</TableCell>
                      <TableCell>
                        {selectedItemId === it.id && <Badge>Gewählt</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buchung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Artikel</Label>
              <div className="text-sm mt-1 p-2 rounded border bg-muted/30 min-h-[40px]">
                {selected ? `${selected.name} ${selected.sku ? `(${selected.sku})` : ''}` : 'Kein Artikel gewählt'}
              </div>
            </div>
            <div>
              <Label htmlFor="qty">Menge *</Label>
              <Input id="qty" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sup">Lieferant</Label>
              <Input id="sup" value={supplier} onChange={e => setSupplier(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ref">Lieferschein-Nr.</Label>
              <Input id="ref" value={reference} onChange={e => setReference(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="note">Notiz</Label>
              <Input id="note" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <Button onClick={handleBook} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Wareneingang buchen
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Wareneingänge</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Artikel</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Menge</TableHead>
                <TableHead>Lieferant</TableHead>
                <TableHead>Lieferschein</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Noch keine Buchungen</TableCell></TableRow>
              )}
              {receipts.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}</TableCell>
                  <TableCell className="font-medium">{r.item_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.item_sku || '—'}</TableCell>
                  <TableCell className="text-right">{r.quantity}</TableCell>
                  <TableCell>{r.supplier || '—'}</TableCell>
                  <TableCell>{r.reference || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.note || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
