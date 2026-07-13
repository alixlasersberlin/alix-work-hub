import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { BookOpen, Search, MessageSquarePlus, Loader2, ShoppingCart } from 'lucide-react';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

interface Item { id: string; sku: string; name: string; brand: string | null; model: string | null; }
interface Country { id: string; iso_code: string; name: string; }
interface Language { code: string; name: string; }

export default function CustomerPortalKatalog() {
  const ctx = useOutletContext<Ctx>();
  const client = supabase as any;
  const [items, setItems] = useState<Item[]>([]);
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [descs, setDescs] = useState<Record<string, any>>({});
  const [images, setImages] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<Country[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [itemCategories, setItemCategories] = useState<Record<string, string[]>>({});
  const [category, setCategory] = useState<string>('all');
  const [country, setCountry] = useState<string>('');
  const [language, setLanguage] = useState('de');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [askItem, setAskItem] = useState<Item | null>(null);
  const [askText, setAskText] = useState('');
  const [asking, setAsking] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cs }, { data: ls }, { data: its }] = await Promise.all([
        client.from('catalog_countries').select('id, iso_code, name').order('iso_code'),
        client.from('catalog_languages').select('code, name').eq('is_active', true).order('code'),
        client.from('catalog_items').select('id, sku, name, brand, model').in('status', ['freigegeben', 'aktiv']).order('name').limit(500),
      ]);
      setCountries(cs ?? []);
      setLanguages(ls ?? []);
      setItems((its ?? []) as Item[]);
      const de = (cs ?? []).find((c: any) => c.iso_code === 'DE');
      setCountry(de?.id ?? cs?.[0]?.id ?? '');
      setLoading(false);
    })();
  }, [client]);

  useEffect(() => {
    if (!country || items.length === 0) return;
    (async () => {
      const ids = items.map((i) => i.id);
      const [{ data: ps }, { data: ds }, { data: imgs }] = await Promise.all([
        client.from('catalog_item_prices').select('item_id, uvp_net, uvp_gross, sale_net, sale_gross, tax_rate, currency_code').in('item_id', ids).eq('country_id', country).eq('price_status', 'freigegeben'),
        client.from('catalog_item_descriptions').select('item_id, short_text, long_text').in('item_id', ids).eq('language_code', language).eq('status', 'freigegeben'),
        client.from('catalog_item_images').select('item_id, url').in('item_id', ids).eq('is_primary', true),
      ]);
      const pm: Record<string, any> = {};
      (ps ?? []).forEach((p: any) => { pm[p.item_id] = p; });
      const dm: Record<string, any> = {};
      (ds ?? []).forEach((d: any) => { dm[d.item_id] = d; });
      const im: Record<string, string> = {};
      (imgs ?? []).forEach((i: any) => { im[i.item_id] = i.url; });
      setPrices(pm); setDescs(dm); setImages(im);
    })();
  }, [country, language, items, client]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = n ? items.filter((i) =>
      i.name.toLowerCase().includes(n) || i.sku.toLowerCase().includes(n) ||
      (i.brand ?? '').toLowerCase().includes(n) || (i.model ?? '').toLowerCase().includes(n)
    ) : items;
    // Nur Artikel mit freigegebenem Preis im gewählten Land
    return base.filter((i) => prices[i.id]);
  }, [items, q, prices]);

  const submitInquiry = async () => {
    if (!askItem || !askText.trim()) return;
    setAsking(true);
    try {
      const { error } = await client.from('customer_communication_log').insert({
        customer_id: ctx.customerId,
        channel: 'portal',
        direction: 'inbound',
        subject: `Katalog-Anfrage: ${askItem.name} (${askItem.sku})`,
        content: askText.trim(),
        metadata: { source: 'portal_catalog', item_id: askItem.id, sku: askItem.sku, country_id: country, language },
      });
      if (error) throw error;
      toast.success('Anfrage gesendet — unser Team meldet sich zeitnah.');
      setAskItem(null); setAskText('');
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? String(e)));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold">Katalog</h2>
        <Badge variant="outline" className="ml-2 text-xs">Nur freigegebene Preise</Badge>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Land</label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Land" /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.iso_code} · {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sprache</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {languages.map((l) => <SelectItem key={l.code} value={l.code}>{l.code.toUpperCase()} · {l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Suche</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="SKU, Name, Marke…" className="pl-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-muted-foreground">Lade…</div>}

      {!loading && filtered.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Keine Artikel für das gewählte Land verfügbar.</CardContent></Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((i) => {
          const p = prices[i.id];
          const d = descs[i.id];
          const img = images[i.id];
          const price = p?.sale_gross ?? p?.uvp_gross ?? p?.sale_net ?? p?.uvp_net;
          const isGross = p?.sale_gross != null || p?.uvp_gross != null;
          return (
            <Card key={i.id} className="overflow-hidden flex flex-col">
              {img && <img src={img} alt={i.name} loading="lazy" className="w-full h-40 object-cover bg-muted" />}
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{i.name}</CardTitle>
                <div className="text-xs text-muted-foreground font-mono">{i.sku}{i.brand ? ` · ${i.brand}` : ''}</div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 text-sm">
                {d?.short_text && <p className="text-muted-foreground line-clamp-3">{d.short_text}</p>}
                {price != null && (
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-lg font-semibold text-primary">
                      {Number(price).toLocaleString('de-DE', { minimumFractionDigits: 2 })} {p?.currency_code ?? 'EUR'}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">{isGross ? 'brutto' : 'netto'}</span>
                  </div>
                )}
              </CardContent>
              <div className="p-3 pt-0 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setAskItem(i); setAskText(''); }}>
                  <MessageSquarePlus className="h-4 w-4 mr-1" /> Anfrage
                </Button>
                <Button size="sm" className="flex-1" onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  const { data: pu } = await (supabase as any).from('customer_portal_users').select('id').eq('user_id', user.id).eq('status', 'active').maybeSingle();
                  if (!pu) { toast.error('Kein Portal-Zugang'); return; }
                  const countryObj = countries.find(x => x.id === country);
                  const { error } = await (supabase as any).from('catalog_portal_cart_items').insert({
                    portal_user_id: pu.id, item_id: i.id, quantity: 1,
                    country_iso: countryObj?.iso_code ?? null, language_code: language,
                  });
                  if (error) toast.error(error.message); else toast.success(`${i.name} zum Warenkorb hinzugefügt`);
                }}>
                  <ShoppingCart className="h-4 w-4 mr-1" /> In den Warenkorb
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!askItem} onOpenChange={(v) => !v && setAskItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anfrage zu {askItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground text-xs">SKU: <span className="font-mono">{askItem?.sku}</span></div>
            <Textarea rows={5} value={askText} onChange={(e) => setAskText(e.target.value)} placeholder="Menge, Fragen, gewünschter Liefertermin…" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAskItem(null)}>Abbrechen</Button>
            <Button onClick={submitInquiry} disabled={asking || !askText.trim()}>
              {asking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageSquarePlus className="h-4 w-4 mr-1" />}
              Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
