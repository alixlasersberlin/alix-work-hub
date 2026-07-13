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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Search, BookOpen, Package } from 'lucide-react';

export interface KatalogPickResult {
  item_id: string;
  sku: string;
  name: string;
  description: string;
  long_text?: string;
  image_url?: string;
  rate: number; // brutto wenn tax>0, sonst netto
  tax_percentage: number;
  quantity: number;
  discount_pct?: number;
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
  const [selectedDiscount, setSelectedDiscount] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'items' | 'bundles'>('items');
  const [bundles, setBundles] = useState<Array<{ id: string; name: string; category: string | null; default_discount_pct: number }>>([]);
  const [bundleItemsMap, setBundleItemsMap] = useState<Record<string, Array<{ item_id: string; quantity: number; is_optional: boolean; discount_pct: number }>>>({});
  const [bundleTiersMap, setBundleTiersMap] = useState<Record<string, Array<{ min_quantity: number; discount_pct: number }>>>({});
  const [bundleCounts, setBundleCounts] = useState<Record<string, number>>({});
  const [bundleQ, setBundleQ] = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      const c = supabase as any;
      const [{ data: it }, { data: cc }, { data: ll }, { data: bs }, { data: bis }, { data: tiers }] = await Promise.all([
        c.from('catalog_items').select('id, sku, name, brand, model, status').in('status', ['freigegeben', 'aktiv']).order('sku').limit(1000),
        c.from('catalog_countries').select('id, iso_code, name, default_tax_rate').order('iso_code'),
        c.from('catalog_languages').select('code, name').order('code'),
        c.from('catalog_bundles').select('id, name, category, default_discount_pct').eq('is_active', true).order('sort_order').order('name'),
        c.from('catalog_bundle_items').select('bundle_id, item_id, quantity, is_optional, discount_pct'),
        c.from('catalog_bundle_price_tiers').select('bundle_id, min_quantity, discount_pct'),
      ]);
      setItems(it ?? []);
      setCountries(cc ?? []);
      setLanguages(ll ?? []);
      setBundles(bs ?? []);
      const m: Record<string, Array<{ item_id: string; quantity: number; is_optional: boolean; discount_pct: number }>> = {};
      (bis ?? []).forEach((b: any) => {
        if (!m[b.bundle_id]) m[b.bundle_id] = [];
        m[b.bundle_id].push({ item_id: b.item_id, quantity: Number(b.quantity), is_optional: !!b.is_optional, discount_pct: Number(b.discount_pct ?? 0) });
      });
      setBundleItemsMap(m);
      const tm: Record<string, Array<{ min_quantity: number; discount_pct: number }>> = {};
      (tiers ?? []).forEach((t: any) => {
        if (!tm[t.bundle_id]) tm[t.bundle_id] = [];
        tm[t.bundle_id].push({ min_quantity: Number(t.min_quantity), discount_pct: Number(t.discount_pct) });
      });
      Object.keys(tm).forEach(k => tm[k].sort((a, b) => a.min_quantity - b.min_quantity));
      setBundleTiersMap(tm);
      const de = (cc ?? []).find((x: any) => x.iso_code === 'DE');
      if (de && !country) setCountry(de.id);
    })();
  }, [open]);

  const bestTierPct = (bundleId: string, count: number): number => {
    const tiers = bundleTiersMap[bundleId] ?? [];
    let best = 0;
    for (const t of tiers) if (count >= t.min_quantity && t.discount_pct > best) best = t.discount_pct;
    return best;
  };

  const applyBundle = (bundleId: string) => {
    const rows = bundleItemsMap[bundleId] ?? [];
    const count = Math.max(1, Number(bundleCounts[bundleId] ?? 1));
    const bundle = bundles.find(b => b.id === bundleId);
    const tierPct = bestTierPct(bundleId, count);
    const baseDisc = Number(bundle?.default_discount_pct ?? 0);
    const effective = tierPct > 0 ? tierPct : baseDisc; // Staffel ersetzt Basisrabatt
    const nonOpt = rows.filter(r => !r.is_optional);
    setSelected((s) => {
      const n = { ...s };
      nonOpt.forEach(r => { n[r.item_id] = (n[r.item_id] ?? 0) + (r.quantity || 1) * count; });
      return n;
    });
    setSelectedDiscount((d) => {
      const n = { ...d };
      nonOpt.forEach(r => {
        const perItem = Math.max(Number(r.discount_pct ?? 0), effective);
        n[r.item_id] = Math.max(n[r.item_id] ?? 0, perItem);
      });
      return n;
    });
    setTab('items');
    toast({ title: `${nonOpt.length} Positionen × ${count} übernommen`, description: effective > 0 ? `Rabatt ${effective}% angewendet` : undefined });
  };

  const filteredBundles = useMemo(() => {
    const n = bundleQ.trim().toLowerCase();
    if (!n) return bundles;
    return bundles.filter(b => b.name.toLowerCase().includes(n) || (b.category ?? '').toLowerCase().includes(n));
  }, [bundles, bundleQ]);

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
      const [{ data: prices }, { data: descs }, { data: imgs }] = await Promise.all([
        c.from('catalog_item_prices')
          .select('item_id, uvp_net, uvp_gross, sale_net, sale_gross, tax_rate, price_status')
          .in('item_id', ids)
          .eq('country_id', country)
          .eq('price_status', 'freigegeben'),
        c.from('catalog_item_descriptions')
          .select('item_id, short_text, long_text')
          .in('item_id', ids)
          .eq('language_code', language),
        c.from('catalog_item_images')
          .select('item_id, url')
          .in('item_id', ids)
          .eq('is_primary', true),
      ]);

      const priceByItem: Record<string, any> = {};
      (prices ?? []).forEach((p: any) => { priceByItem[p.item_id] = p; });
      const descByItem: Record<string, any> = {};
      (descs ?? []).forEach((d: any) => { descByItem[d.item_id] = d; });
      const imgByItem: Record<string, string> = {};
      (imgs ?? []).forEach((i: any) => { imgByItem[i.item_id] = i.url; });

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

        const imageUrl = imgByItem[id];

        // Snapshot einfrieren
        const snapshotPayload = {
          item: { id: item.id, sku: item.sku, name: item.name, brand: item.brand, model: item.model },
          price: p,
          description: d,
          image_url: imageUrl ?? null,
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
          long_text: d.long_text ?? undefined,
          image_url: imageUrl,
          rate,
          tax_percentage: tax,
          quantity: selected[id] || 1,
          discount_pct: selectedDiscount[id] || undefined,
          snapshot_id: snap?.id,
        });
      }

      onPicked(result);
      setSelected({});
      setSelectedDiscount({});
      setBundleCounts({});
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="items"><BookOpen className="h-4 w-4 mr-1" />Artikel</TabsTrigger>
            <TabsTrigger value="bundles"><Package className="h-4 w-4 mr-1" />Bundles ({bundles.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="items">
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
          </TabsContent>
          <TabsContent value="bundles">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" value={bundleQ} onChange={(e) => setBundleQ(e.target.value)} placeholder="Bundle filtern…" />
            </div>
            <ScrollArea className="h-80 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead className="w-24 text-right">Positionen</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBundles.map(b => {
                    const count = (bundleItemsMap[b.id] ?? []).filter(x => !x.is_optional).length;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.category ?? '—'}</TableCell>
                        <TableCell className="text-right text-xs">{count}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => applyBundle(b.id)}>Übernehmen</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredBundles.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Keine Bundles verfügbar</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            <p className="text-xs text-muted-foreground mt-2">Bundle-Positionen werden zur Artikel-Auswahl hinzugefügt. Optionale Artikel manuell im Tab „Artikel" ergänzen.</p>
          </TabsContent>
        </Tabs>


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
