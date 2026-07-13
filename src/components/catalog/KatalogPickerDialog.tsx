import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Search, BookOpen } from 'lucide-react';

export interface KatalogPickResult {
  item_id: string;
  sku: string;
  name: string;
  description: string;
  rate: number; // brutto wenn tax>0, sonst netto
  tax_percentage: number;
  quantity: number;
  snapshot_id?: string;
}

interface Item { id: string; sku: string; name: string; brand: string | null; model: string | null; status: string; }
interface Country { id: string; iso_code: string; name: string; default_tax_rate: number | null; }
interface Language { code: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPicked: (items: KatalogPickResult[]) => void;
  usedInType?: string; // z. B. 'offer', 'order'
  usedInId?: string;
}

export function KatalogPickerDialog({ open, onOpenChange, onPicked, usedInType = 'draft', usedInId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [country, setCountry] = useState<string>('');
  const [language, setLanguage] = useState<string>('de');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const c = supabase as any;
      const [{ data: it }, { data: cc }, { data: ll }] = await Promise.all([
        c.from('catalog_items').select('id, sku, name, brand, model, status').in('status', ['freigegeben', 'aktiv']).order('sku').limit(1000),
        c.from('catalog_countries').select('id, iso_code, name, default_tax_rate').order('iso_code'),
        c.from('catalog_languages').select('code, name').order('code'),
      ]);
      setItems(it ?? []);
      setCountries(cc ?? []);
      setLanguages(ll ?? []);
      // Default DE wenn vorhanden
      const de = (cc ?? []).find((x: any) => x.iso_code === 'DE');
      if (de && !country) setCountry(de.id);
    })();
  }, [open]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items.slice(0, 200);
    return items.filter((i) =>
      i.sku.toLowerCase().includes(n) ||
      i.name.toLowerCase().includes(n) ||
      (i.brand ?? '').toLowerCase().includes(n) ||
      (i.model ?? '').toLowerCase().includes(n)
    ).slice(0, 200);
  }, [items, q]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = { ...s };
      if (n[id]) delete n[id]; else n[id] = 1;
      return n;
    });
  };

  const commit = async () => {
    const ids = Object.keys(selected);
    if (!ids.length) { toast({ title: 'Keine Artikel gewählt', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const c = supabase as any;
      const [{ data: prices }, { data: descs }] = await Promise.all([
        c.from('catalog_item_prices')
          .select('item_id, uvp_net, uvp_gross, sale_net, sale_gross, tax_rate, price_status')
          .in('item_id', ids)
          .eq('country_id', country)
          .eq('price_status', 'freigegeben'),
        c.from('catalog_item_descriptions')
          .select('item_id, short_text, long_text')
          .in('item_id', ids)
          .eq('language_code', language),
      ]);

      const priceByItem: Record<string, any> = {};
      (prices ?? []).forEach((p: any) => { priceByItem[p.item_id] = p; });
      const descByItem: Record<string, any> = {};
      (descs ?? []).forEach((d: any) => { descByItem[d.item_id] = d; });

      const countryObj = countries.find((x) => x.id === country);
      const { data: userRes } = await supabase.auth.getUser();

      const result: KatalogPickResult[] = [];
      for (const id of ids) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        const p = priceByItem[id] ?? {};
        const d = descByItem[id] ?? {};
        const tax = Number(p.tax_rate ?? countryObj?.default_tax_rate ?? 19);
        const rate = Number(p.sale_gross ?? p.uvp_gross ?? p.sale_net ?? p.uvp_net ?? 0);

        // Snapshot einfrieren
        const snapshotPayload = {
          item: { id: item.id, sku: item.sku, name: item.name, brand: item.brand, model: item.model },
          price: p,
          description: d,
          country: countryObj ? { id: countryObj.id, iso: countryObj.iso_code } : null,
          language,
          captured_at: new Date().toISOString(),
        };
        const { data: snap } = await c.from('catalog_item_snapshots').insert({
          item_id: item.id,
          snapshot: snapshotPayload,
          used_in_type: usedInType,
          used_in_id: usedInId ?? null,
          language_code: language,
          country_iso: countryObj?.iso_code ?? null,
          created_by: userRes?.user?.id ?? null,
        }).select('id').maybeSingle();

        result.push({
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          description: d.short_text ?? d.long_text ?? '',
          rate,
          tax_percentage: tax,
          quantity: selected[id] || 1,
          snapshot_id: snap?.id,
        });
      }

      onPicked(result);
      setSelected({});
      setQ('');
      onOpenChange(false);
      toast({ title: `${result.length} Artikel übernommen` });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Aus Katalog übernehmen</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Land (Preis)</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Land" /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.iso_code} · {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sprache</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {languages.map((l) => <SelectItem key={l.code} value={l.code}>{l.code.toUpperCase()}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Suche</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU, Name, Marke…" />
            </div>
          </div>
        </div>

        <ScrollArea className="h-96 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Marke / Modell</TableHead>
                <TableHead className="w-24">Menge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id} className={selected[i.id] ? 'bg-primary/5' : ''}>
                  <TableCell><Checkbox checked={!!selected[i.id]} onCheckedChange={() => toggle(i.id)} /></TableCell>
                  <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                  <TableCell>{i.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{[i.brand, i.model].filter(Boolean).join(' · ')}</TableCell>
                  <TableCell>
                    <Input
                      type="number" min={1}
                      value={selected[i.id] ?? ''}
                      onChange={(e) => setSelected((s) => ({ ...s, [i.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                      disabled={!selected[i.id]}
                      className="h-8 w-20"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Keine Artikel</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{Object.keys(selected).length} ausgewählt</Badge>
          Preise und Beschreibungen werden als unveränderlicher Snapshot festgehalten.
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={commit} disabled={busy || !country}>{busy ? 'Übernehme…' : 'Übernehmen'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
