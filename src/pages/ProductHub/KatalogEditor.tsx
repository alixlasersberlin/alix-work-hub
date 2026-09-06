import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen, Save, Loader2, Plus, Trash2, GripVertical, Printer, Globe, Sparkles, Copy,
  Monitor, Tablet, Smartphone, FileText, History, Image as ImageIcon, ArrowLeft, Upload, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CatalogView } from '@/components/producthub/CatalogRenderer';
import {
  catGet, catUpdate, catItems, catItemUpsert, catItemUpdate, catItemRemove, catPages,
  catPageInsert, catPageUpdate, catPageDelete, catMedia, catUploadImage, catVersions, catSnapshot,
  catTemplates, catDuplicate, defaultCover, defaultSettings, phCatalogSlug, hubPrices, catalogMoney,
  PH_PRICE_KINDS, PH_PRICE_DISPLAY, PH_LAYOUTS, PH_PAGE_TYPES, PH_BADGES, PH_PRODUCT_FIELDS,
  PH_CATALOG_STATUS,
} from '@/lib/producthub/catalog';
import { PH_APPLICATIONS } from '@/lib/producthub/config';
import { PH_PRICE_COUNTRIES } from '@/lib/producthub/countryPricing';

const db = supabase as any;

export default function KatalogEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));

  const [cat, setCat] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile' | 'pdf'>('desktop');
  const [q, setQ] = useState('');
  const [fCat, setFCat] = useState('all');
  const [selPage, setSelPage] = useState<string>('');
  const [selItem, setSelItem] = useState<string>('');
  const [uploadTarget, setUploadTarget] = useState<'cover' | 'page' | 'item' | 'library'>('cover');
  const fileRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);

  const cover = { ...defaultCover(), ...(cat?.cover || {}) };
  const settings = { ...defaultSettings(), ...(cat?.settings || {}) };
  const publicUrl = cat?.slug ? `${window.location.origin}/preisliste/${cat.slug}` : undefined;

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, it, pg, prods, md, vs, tpl] = await Promise.all([
        catGet(id), catItems(id), catPages(id),
        db.from('ph_products').select('*').order('sort_order').order('name'),
        catMedia(id), catVersions(id), catTemplates(),
      ]);
      setCat(c); setItems(it); setPages(pg);
      setProducts(prods.data || []); setMedia(md); setVersions(vs); setTemplates(tpl);
    } catch (e: any) { toast.error(e.message || 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const patch = (p: any) => setCat((c: any) => ({ ...c, ...p }));
  const patchCover = (p: any) => patch({ cover: { ...cover, ...p } });
  const patchSettings = (p: any) => patch({ settings: { ...settings, ...p } });

  const save = async (extra: any = {}) => {
    if (!cat || !canWrite) return;
    setSaving(true);
    try {
      await catUpdate(cat.id, {
        name: cat.name, internal_name: cat.internal_name, variant: cat.variant, language: cat.language,
        currency: cat.currency, country: cat.country, valid_from: cat.valid_from || null,
        valid_to: cat.valid_to || null, contact: cat.contact, notes: cat.notes, status: cat.status,
        cover: cat.cover, settings: cat.settings, slug: cat.slug, is_public: cat.is_public,
        access_password: cat.access_password || null, expires_at: cat.expires_at || null,
        noindex: cat.noindex, pdf_stale: true, ...extra,
      });
      toast.success('Gespeichert');
      await load();
    } catch (e: any) { toast.error(e.message || 'Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  };

  /* ---------- Produktauswahl ---------- */
  const inCatalog = useMemo(() => new Set(items.map(i => i.product_id)), [items]);
  const filteredProducts = useMemo(() => products.filter(p =>
    (fCat === 'all' || (p.applications || []).includes(fCat) || (p.categories || []).includes(fCat)) &&
    (!q || `${p.name} ${p.model} ${(p.categories || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  ), [products, q, fCat]);

  const toggleProduct = async (p: any, on: boolean) => {
    if (!canWrite || !cat) return;
    if (on) {
      await catItemUpsert({ catalog_id: cat.id, product_id: p.id, sort_order: items.length + 1, layout: settings.layout });
    } else {
      await catItemRemove(cat.id, p.id);
    }
    setItems(await catItems(cat.id));
    await catUpdate(cat.id, { pdf_stale: true });
  };

  const selectAll = async () => {
    if (!canWrite || !cat) return;
    const missing = filteredProducts.filter(p => !inCatalog.has(p.id));
    if (!missing.length) return;
    await db.from('ph_catalog_items').insert(missing.map((p, i) => ({
      catalog_id: cat.id, product_id: p.id, sort_order: items.length + i + 1, layout: settings.layout,
    })));
    setItems(await catItems(cat.id));
  };

  const onDrop = async (targetId: string) => {
    if (!dragId.current || dragId.current === targetId) return;
    const list = [...items];
    const from = list.findIndex(i => i.id === dragId.current);
    const to = list.findIndex(i => i.id === targetId);
    if (from < 0 || to < 0) return;
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    setItems(list);
    dragId.current = null;
    await Promise.all(list.map((i, idx) => catItemUpdate(i.id, { sort_order: idx + 1 })));
  };

  /* ---------- Seiten ---------- */
  const addPage = async (type: string) => {
    if (!cat) return;
    const p = await catPageInsert({
      catalog_id: cat.id, sort_order: pages.length + 1, page_type: type,
      title: PH_PAGE_TYPES.find(t => t.key === type)?.label || type, config: {},
    });
    setPages(ps => [...ps, p]); setSelPage(p.id);
  };
  const updPage = async (pid: string, p: any) => {
    setPages(ps => ps.map(x => (x.id === pid ? { ...x, ...p } : x)));
    await catPageUpdate(pid, p);
  };
  const delPage = async (pid: string) => {
    await catPageDelete(pid); setPages(ps => ps.filter(p => p.id !== pid));
  };
  const dragPageId = useRef<string | null>(null);
  const onDropPage = async (targetId: string) => {
    if (!dragPageId.current || dragPageId.current === targetId) return;
    const list = [...pages];
    const from = list.findIndex(p => p.id === dragPageId.current);
    const to = list.findIndex(p => p.id === targetId);
    if (from < 0 || to < 0) return;
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    setPages(list.map((p, i) => ({ ...p, sort_order: i + 1 })));
    dragPageId.current = null;
    await Promise.all(list.map((p, i) => catPageUpdate(p.id, { sort_order: i + 1 })));
  };

  /* ---------- Medien ---------- */
  const onFile = async (f: File) => {
    if (!cat) return;
    try {
      const m = await catUploadImage(cat.id, f);
      setMedia(ms => [m, ...ms]);
      if (uploadTarget === 'cover') patchCover({ image: m.url });
      if (uploadTarget === 'page' && selPage) {
        const pg = pages.find(p => p.id === selPage);
        await updPage(selPage, { config: { ...(pg?.config || {}), image: m.url } });
      }
      if (uploadTarget === 'item' && selItem) {
        await catItemUpdate(selItem, { image_mode: 'custom', image_url: m.url });
        setItems(await catItems(cat.id));
      }
      toast.success('Bild hochgeladen');
    } catch (e: any) { toast.error(e.message || 'Upload fehlgeschlagen'); }
  };

  /* ---------- Magic Design ---------- */
  const magicDesign = async () => {
    if (!cat) return;
    const existing = pages.map(p => p.page_type);
    const plan = [
      { page_type: 'cover', title: 'Cover' },
      { page_type: 'toc', title: 'Inhalt' },
      { page_type: 'overview', title: 'Produktübersicht' },
      { page_type: 'products', title: 'Produktseiten' },
      { page_type: 'pricelist', title: 'Preisübersicht' },
      { page_type: 'back', title: 'Kontakt & Rückseite' },
    ].filter(p => !existing.includes(p.page_type));
    for (const [i, p] of plan.entries()) {
      await catPageInsert({ catalog_id: cat.id, sort_order: pages.length + i + 1, ...p, config: {} });
    }
    patchCover({ subtitle: cat.name.toUpperCase(), validity: cat.valid_to ? `Gültig bis ${cat.valid_to}` : cover.validity });
    setPages(await catPages(cat.id));
    toast.success('Katalog automatisch gestaltet – Feinschliff jetzt möglich');
  };

  const newProducts = useMemo(
    () => products.filter(p => p.status === 'published' && !inCatalog.has(p.id)),
    [products, inCatalog],
  );

  const publish = async () => {
    await save({ status: 'published', is_public: true, pdf_stale: true });
  };

  const makeVersion = async () => {
    if (!cat) return;
    await catSnapshot(cat);
    const v = Number(cat.version || 1) + 1;
    await catUpdate(cat.id, { version: v, version_label: `${(cat.country || 'DE').toUpperCase()}-V${v}` });
    toast.success('Version gesichert');
    await load();
  };

  const printPdf = async () => {
    if (cat) await catUpdate(cat.id, { pdf_stale: false, pdf_generated_at: new Date().toISOString() });
    setDevice('pdf');
    setTimeout(() => window.print(), 400);
  };

  if (loading || !cat) {
    return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lade Katalog…</div>;
  }

  const selectedItem = items.find(i => i.id === selItem);
  const selectedPage = pages.find(p => p.id === selPage);

  return (
    <div className="p-4 md:p-6 space-y-4 ph-editor">
      <div className="print:hidden space-y-4">
        <PageHeader
          title={cat.name}
          subtitle={`Katalog-Editor · ${PH_CATALOG_STATUS.find(s => s.key === cat.status)?.label} · Version ${cat.version || 1}`}
          icon={BookOpen}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => nav('/product-hub/preislisten')}><ArrowLeft className="w-4 h-4 mr-1" />Zurück</Button>
              <Button variant="outline" size="sm" onClick={magicDesign} disabled={!canWrite}><Sparkles className="w-4 h-4 mr-1" />Magic Design</Button>
              <Button variant="outline" size="sm" onClick={printPdf}><Printer className="w-4 h-4 mr-1" />PDF erstellen</Button>
              <Button size="sm" onClick={() => save()} disabled={!canWrite || saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}Speichern
              </Button>
            </div>
          }
        />

        {newProducts.length > 0 && (
          <Card className="border-amber-500/50"><CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="text-sm">{newProducts.length} neue Produkte verfügbar – sie werden nicht automatisch aufgenommen.</div>
            <Button size="sm" variant="outline" onClick={() => (document.getElementById('tab-produkte') as HTMLElement)?.click()}>Produkte prüfen</Button>
          </CardContent></Card>
        )}
        {cat.pdf_stale && cat.pdf_generated_at && (
          <Card className="border-destructive/50"><CardContent className="p-3 text-sm">PDF nicht aktuell – bereits versendete PDFs bleiben unverändert.</CardContent></Card>
        )}

        <div className="grid xl:grid-cols-[300px_minmax(0,1fr)_320px] gap-4">
          {/* LINKS: Seiten & Elemente */}
          <Card className="h-fit"><CardContent className="p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seiten</div>
            <div className="space-y-1">
              {pages.map(p => (
                <div key={p.id}
                  draggable={canWrite}
                  onDragStart={() => { dragPageId.current = p.id; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onDropPage(p.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${selPage === p.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                  onClick={() => setSelPage(p.id)}>
                  <GripVertical className="w-3.5 h-3.5 opacity-40 cursor-grab" />
                  <span className="flex-1 truncate">{p.title}</span>
                  <Badge variant="outline" className="text-[10px]">{PH_PAGE_TYPES.find(t => t.key === p.page_type)?.label}</Badge>
                  {canWrite && <Trash2 className="w-3.5 h-3.5 opacity-50 hover:opacity-100" onClick={e => { e.stopPropagation(); delPage(p.id); }} />}
                </div>
              ))}
              {pages.length === 0 && <div className="text-xs text-muted-foreground">Ohne Seiten wird automatisch je Gerät eine Produktseite erzeugt.</div>}
              {pages.length > 1 && canWrite && <div className="text-[10px] text-muted-foreground">Seiten per Ziehen sortieren.</div>}
            </div>
            {canWrite && (
              <Select value="" onValueChange={addPage}>
                <SelectTrigger className="h-8"><SelectValue placeholder="+ Seite hinzufügen" /></SelectTrigger>
                <SelectContent>{PH_PAGE_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            )}

            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Geräte im Katalog</div>
            <ScrollArea className="h-64">
              <div className="space-y-1 pr-2">
                {items.map(it => {
                  const p = products.find(x => x.id === it.product_id);
                  return (
                    <div key={it.id}
                      draggable={canWrite}
                      onDragStart={() => { dragId.current = it.id; }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onDrop(it.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${selItem === it.id ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                      onClick={() => setSelItem(it.id)}>
                      <GripVertical className="w-3.5 h-3.5 opacity-40" />
                      <span className="flex-1 truncate">{p?.name || '—'}</span>
                      {!it.visible && <Badge variant="outline" className="text-[10px]">aus</Badge>}
                    </div>
                  );
                })}
                {items.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Geräte gewählt.</div>}
              </div>
            </ScrollArea>
          </CardContent></Card>

          {/* MITTE: Live-Vorschau */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1 items-center">
              {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone], ['pdf', FileText]] as const).map(([k, Icon]) => (
                <Button key={k} size="sm" variant={device === k ? 'default' : 'outline'} onClick={() => setDevice(k as any)}>
                  <Icon className="w-3.5 h-3.5 mr-1" />{k === 'pdf' ? 'PDF' : k}
                </Button>
              ))}
              {publicUrl && cat.is_public && (
                <Button size="sm" variant="outline" onClick={() => window.open(publicUrl, '_blank')}><Globe className="w-3.5 h-3.5 mr-1" />Online-Katalog</Button>
              )}
            </div>
            <Card><CardContent className="p-4 bg-muted/30 max-h-[75vh] overflow-auto">
              <CatalogView catalog={cat} items={items} products={products} pages={pages} device={device} publicUrl={publicUrl} />
            </CardContent></Card>
          </div>

          {/* RECHTS: Einstellungen */}
          <Card className="h-fit"><CardContent className="p-3">
            <Tabs defaultValue="produkte">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="produkte" id="tab-produkte">Produkte</TabsTrigger>
                <TabsTrigger value="preise">Preise</TabsTrigger>
                <TabsTrigger value="cover">Cover</TabsTrigger>
                <TabsTrigger value="seite">Seite</TabsTrigger>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="online">Online</TabsTrigger>
                <TabsTrigger value="versionen">Versionen</TabsTrigger>
              </TabsList>

              {/* Produkte */}
              <TabsContent value="produkte" className="space-y-2">
                <Input placeholder="Produktsuche…" value={q} onChange={e => setQ(e.target.value)} className="h-8" />
                <Select value={fCat} onValueChange={setFCat}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kategorien</SelectItem>
                    {PH_APPLICATIONS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                {canWrite && <Button size="sm" variant="outline" className="w-full" onClick={selectAll}>Alle auswählen</Button>}
                <ScrollArea className="h-[420px]">
                  <div className="space-y-2 pr-2">
                    {filteredProducts.map(p => {
                      const h = hubPrices(p, cat.country);
                      const on = inCatalog.has(p.id);
                      return (
                        <div key={p.id} className="flex gap-2 items-start border rounded p-2">
                          <Checkbox checked={on} disabled={!canWrite} onCheckedChange={v => toggleProduct(p, !!v)} />
                          {p.hero_image_url
                            ? <img src={p.hero_image_url} alt={p.name} className="w-12 h-12 object-contain bg-white rounded" loading="lazy" />
                            : <div className="w-12 h-12 rounded bg-muted" />}
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{p.model} · {(p.categories || [])[0] || (p.applications || [])[0] || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">
                              UVP {catalogMoney(h.uvp, cat.country, cat.currency)} · VK {catalogMoney(h.vk, cat.country, cat.currency)}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Preise */}
              <TabsContent value="preise" className="space-y-3">
                <div className="text-xs font-semibold">Preisarten im Katalog</div>
                <div className="space-y-1">
                  {PH_PRICE_KINDS.map(k => {
                    const on = (settings.priceKinds || []).includes(k.key);
                    return (
                      <div key={k.key} className="flex items-center gap-2">
                        <Checkbox checked={on} disabled={!canWrite} onCheckedChange={v => patchSettings({
                          priceKinds: v ? [...(settings.priceKinds || []), k.key] : (settings.priceKinds || []).filter((x: string) => x !== k.key),
                        })} />
                        <span className="text-xs flex-1">{k.label}{k.auto ? ' (aus Hub)' : ''}</span>
                        <Select value={settings.priceDisplay?.[k.key] || 'show'} onValueChange={v => patchSettings({ priceDisplay: { ...(settings.priceDisplay || {}), [k.key]: v } })}>
                          <SelectTrigger className="h-7 w-36 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{PH_PRICE_DISPLAY.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between"><Label className="text-xs">„Sie sparen XX %" anzeigen</Label>
                  <Switch checked={settings.showSavings} disabled={!canWrite} onCheckedChange={v => patchSettings({ showSavings: v })} /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Preise brutto anzeigen</Label>
                  <Switch checked={settings.vatMode === 'gross'} disabled={!canWrite} onCheckedChange={v => patchSettings({ vatMode: v ? 'gross' : 'net' })} /></div>

                <div className="text-xs font-semibold pt-2">Preisregel (Masterpreis bleibt unverändert)</div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={settings.priceRule?.mode || 'hub'} onValueChange={v => patchSettings({ priceRule: { ...settings.priceRule, mode: v } })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hub">Preis aus Product Hub</SelectItem>
                      <SelectItem value="discount">Abschlag in %</SelectItem>
                      <SelectItem value="surcharge">Aufschlag in %</SelectItem>
                      <SelectItem value="fixed">Festpreis</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input className="h-8 text-xs" type="number" value={settings.priceRule?.value ?? ''} disabled={!canWrite}
                    onChange={e => patchSettings({ priceRule: { ...settings.priceRule, value: e.target.value === '' ? null : Number(e.target.value) } })} />
                </div>
                <div><Label className="text-xs">Rechtlicher Preishinweis</Label>
                  <Textarea rows={3} value={settings.legal} disabled={!canWrite} onChange={e => patchSettings({ legal: e.target.value })} /></div>

                {selectedItem && (
                  <div className="border rounded p-2 space-y-2">
                    <div className="text-xs font-semibold">
                      Gerät: {products.find(p => p.id === selectedItem.product_id)?.name}
                    </div>
                    {(settings.priceKinds || []).map((k: string) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-[11px] w-28">{PH_PRICE_KINDS.find(x => x.key === k)?.label}</span>
                        <Input className="h-7 text-xs" defaultValue={selectedItem.prices?.[k] ?? ''} disabled={!canWrite}
                          onBlur={async e => {
                            const v = e.target.value === '' ? null : Number(e.target.value.replace(',', '.'));
                            await catItemUpdate(selectedItem.id, { prices: { ...(selectedItem.prices || {}), [k]: v } });
                            setItems(await catItems(cat.id));
                          }} />
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-1">
                      {PH_BADGES.map(b => {
                        const on = (selectedItem.badges || []).includes(b);
                        return (
                          <Badge key={b} variant={on ? 'default' : 'outline'} className="text-[10px] cursor-pointer"
                            onClick={async () => {
                              if (!canWrite) return;
                              const badges = on ? (selectedItem.badges || []).filter((x: string) => x !== b) : [...(selectedItem.badges || []), b];
                              await catItemUpdate(selectedItem.id, { badges });
                              setItems(await catItems(cat.id));
                            }}>{b}</Badge>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={selectedItem.layout || settings.layout} onValueChange={async v => { await catItemUpdate(selectedItem.id, { layout: v }); setItems(await catItems(cat.id)); }}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PH_LAYOUTS.map(l => <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Product-Hub-Bild verwenden</Label>
                      <Switch checked={selectedItem.image_mode !== 'custom'} disabled={!canWrite}
                        onCheckedChange={async v => { await catItemUpdate(selectedItem.id, { image_mode: v ? 'hub' : 'custom' }); setItems(await catItems(cat.id)); }} />
                    </div>
                    <Button size="sm" variant="outline" className="w-full" disabled={!canWrite}
                      onClick={() => { setUploadTarget('item'); fileRef.current?.click(); }}>
                      <Upload className="w-3.5 h-3.5 mr-1" />Katalogbild hochladen
                    </Button>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Im Katalog sichtbar</Label>
                      <Switch checked={selectedItem.visible !== false} disabled={!canWrite}
                        onCheckedChange={async v => { await catItemUpdate(selectedItem.id, { visible: v }); setItems(await catItems(cat.id)); }} />
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Cover */}
              <TabsContent value="cover" className="space-y-2">
                <div><Label className="text-xs">Titel</Label><Input value={cover.title || ''} disabled={!canWrite} onChange={e => patchCover({ title: e.target.value })} /></div>
                <div><Label className="text-xs">Untertitel</Label><Input value={cover.subtitle || ''} disabled={!canWrite} onChange={e => patchCover({ subtitle: e.target.value })} /></div>
                <div><Label className="text-xs">Claim</Label><Textarea rows={2} value={cover.claim || ''} disabled={!canWrite} onChange={e => patchCover({ claim: e.target.value })} /></div>
                <div><Label className="text-xs">Aktionshinweis</Label><Input value={cover.promoNote || ''} disabled={!canWrite} onChange={e => patchCover({ promoNote: e.target.value })} /></div>
                <div><Label className="text-xs">Gültigkeitszeitraum</Label><Input value={cover.validity || ''} disabled={!canWrite} onChange={e => patchCover({ validity: e.target.value })} /></div>
                <div><Label className="text-xs">Button-Text (optional)</Label><Input value={cover.button || ''} disabled={!canWrite} onChange={e => patchCover({ button: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Hintergrund</Label><Input type="color" value={cover.bg || '#0b0b0d'} disabled={!canWrite} onChange={e => patchCover({ bg: e.target.value })} /></div>
                  <div><Label className="text-xs">Schriftfarbe</Label><Input type="color" value={cover.color || '#ffffff'} disabled={!canWrite} onChange={e => patchCover({ color: e.target.value })} /></div>
                </div>
                <div><Label className="text-xs">Schriftgröße {cover.fontSize} px</Label>
                  <Slider value={[cover.fontSize || 56]} min={24} max={110} step={2} disabled={!canWrite} onValueChange={v => patchCover({ fontSize: v[0] })} /></div>
                <div><Label className="text-xs">Overlay {cover.overlay} %</Label>
                  <Slider value={[cover.overlay ?? 45]} min={0} max={90} step={5} disabled={!canWrite} onValueChange={v => patchCover({ overlay: v[0] })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={cover.align || 'left'} onValueChange={v => patchCover({ align: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="left">links</SelectItem><SelectItem value="center">zentriert</SelectItem><SelectItem value="right">rechts</SelectItem></SelectContent>
                  </Select>
                  <Select value={cover.imagePosition || 'cover'} onValueChange={v => patchCover({ imagePosition: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cover">Bild füllend</SelectItem><SelectItem value="contain">Bild vollständig</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between"><Label className="text-xs">QR-Code auf Cover</Label>
                  <Switch checked={!!cover.qr} disabled={!canWrite} onCheckedChange={v => patchCover({ qr: v })} /></div>
                <Button size="sm" variant="outline" className="w-full" disabled={!canWrite} onClick={() => { setUploadTarget('cover'); fileRef.current?.click(); }}>
                  <ImageIcon className="w-3.5 h-3.5 mr-1" />Titelbild hochladen
                </Button>
                <div className="grid grid-cols-3 gap-1">
                  {media.slice(0, 12).map(m => (
                    <img key={m.id} src={m.url} alt={m.title} loading="lazy"
                      className="w-full h-14 object-cover rounded cursor-pointer border hover:border-primary"
                      onClick={() => patchCover({ image: m.url })} />
                  ))}
                </div>
                {cover.image && <Button size="sm" variant="ghost" onClick={() => patchCover({ image: null })}>Titelbild entfernen</Button>}
              </TabsContent>

              {/* Seite */}
              <TabsContent value="seite" className="space-y-2">
                {!selectedPage && <div className="text-xs text-muted-foreground">Links eine Seite wählen.</div>}
                {selectedPage && (
                  <>
                    <div><Label className="text-xs">Titel</Label>
                      <Input value={selectedPage.title || ''} disabled={!canWrite} onChange={e => updPage(selectedPage.id, { title: e.target.value })} /></div>
                    <div><Label className="text-xs">Seitentyp</Label>
                      <Select value={selectedPage.page_type} onValueChange={v => updPage(selectedPage.id, { page_type: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PH_PAGE_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                      </Select></div>
                    <div><Label className="text-xs">Text</Label>
                      <Textarea rows={5} value={selectedPage.config?.text || ''} disabled={!canWrite}
                        onChange={e => updPage(selectedPage.id, { config: { ...(selectedPage.config || {}), text: e.target.value } })} /></div>
                    <Button size="sm" variant="outline" className="w-full" disabled={!canWrite} onClick={() => { setUploadTarget('page'); fileRef.current?.click(); }}>
                      <ImageIcon className="w-3.5 h-3.5 mr-1" />Seitenbild hochladen
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Design */}
              <TabsContent value="design" className="space-y-2">
                <div><Label className="text-xs">Standard-Layout</Label>
                  <Select value={settings.layout} onValueChange={v => patchSettings({ layout: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{PH_LAYOUTS.map(l => <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-[10px]">Hintergrund</Label><Input type="color" value={settings.theme.bg} disabled={!canWrite} onChange={e => patchSettings({ theme: { ...settings.theme, bg: e.target.value } })} /></div>
                  <div><Label className="text-[10px]">Text</Label><Input type="color" value={settings.theme.text} disabled={!canWrite} onChange={e => patchSettings({ theme: { ...settings.theme, text: e.target.value } })} /></div>
                  <div><Label className="text-[10px]">Akzent</Label><Input type="color" value={settings.theme.accent} disabled={!canWrite} onChange={e => patchSettings({ theme: { ...settings.theme, accent: e.target.value } })} /></div>
                </div>
                <div className="text-xs font-semibold pt-1">Felder auf Produktseiten</div>
                <div className="grid grid-cols-2 gap-1">
                  {PH_PRODUCT_FIELDS.map(f => (
                    <label key={f.key} className="flex items-center gap-2 text-[11px]">
                      <Checkbox checked={settings.fields?.[f.key] !== false} disabled={!canWrite}
                        onCheckedChange={v => patchSettings({ fields: { ...(settings.fields || {}), [f.key]: !!v } })} />
                      {f.label}
                    </label>
                  ))}
                </div>
                <div className="text-xs font-semibold pt-1">Kopfzeile</div>
                <div className="flex items-center justify-between"><Label className="text-xs">Kopfzeile anzeigen</Label>
                  <Switch checked={settings.header.enabled} disabled={!canWrite} onCheckedChange={v => patchSettings({ header: { ...settings.header, enabled: v } })} /></div>
                <Input className="h-8 text-xs" placeholder="Kopfzeilen-Titel" value={settings.header.title} disabled={!canWrite}
                  onChange={e => patchSettings({ header: { ...settings.header, title: e.target.value } })} />
                <div className="text-xs font-semibold pt-1">Fußzeile</div>
                {(['company', 'address', 'phone', 'email', 'website'] as const).map(k => (
                  <Input key={k} className="h-8 text-xs" placeholder={k} value={(settings.footer as any)[k] || ''} disabled={!canWrite}
                    onChange={e => patchSettings({ footer: { ...settings.footer, [k]: e.target.value } })} />
                ))}
                <div className="flex items-center justify-between"><Label className="text-xs">Seitenzahlen</Label>
                  <Switch checked={settings.footer.pageNumbers} disabled={!canWrite} onCheckedChange={v => patchSettings({ footer: { ...settings.footer, pageNumbers: v } })} /></div>
                <div className="text-xs font-semibold pt-1">Vorlage übernehmen</div>
                <Select value="" onValueChange={key => {
                  const t = templates.find(x => x.key === key);
                  if (t?.config) patchSettings({ ...(t.config.settings || {}), layout: t.config.layout || settings.layout, priceKinds: t.config.priceKinds || settings.priceKinds, theme: t.config.theme || settings.theme });
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Vorlage wählen" /></SelectTrigger>
                  <SelectContent>{templates.map(t => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </TabsContent>

              {/* Online */}
              <TabsContent value="online" className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs">Online-Katalog aktiv</Label>
                  <Switch checked={!!cat.is_public} disabled={!canWrite} onCheckedChange={v => patch({ is_public: v })} /></div>
                <div><Label className="text-xs">Adresse</Label>
                  <Input value={cat.slug || ''} disabled={!canWrite} onChange={e => patch({ slug: phCatalogSlug(e.target.value) })} />
                  <div className="text-[10px] text-muted-foreground break-all">{publicUrl}</div></div>
                <div><Label className="text-xs">Passwortschutz (optional)</Label>
                  <Input value={cat.access_password || ''} disabled={!canWrite} onChange={e => patch({ access_password: e.target.value })} /></div>
                <div><Label className="text-xs">Ablaufdatum</Label>
                  <Input type="date" value={(cat.expires_at || '').slice(0, 10)} disabled={!canWrite} onChange={e => patch({ expires_at: e.target.value || null })} /></div>
                <div className="flex items-center justify-between"><Label className="text-xs">Nicht in Suchmaschinen (noindex)</Label>
                  <Switch checked={cat.noindex !== false} disabled={!canWrite} onCheckedChange={v => patch({ noindex: v })} /></div>
                <div><Label className="text-xs">Status</Label>
                  <Select value={cat.status} onValueChange={v => patch({ status: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{PH_CATALOG_STATUS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                  </Select></div>
                <Button size="sm" className="w-full" disabled={!canWrite} onClick={publish}><Globe className="w-3.5 h-3.5 mr-1" />Veröffentlichen</Button>
                <Button size="sm" variant="outline" className="w-full" onClick={async () => {
                  const name = window.prompt('Name der Kopie', `${cat.name} (Kopie)`);
                  if (!name) return;
                  const c = await catDuplicate(cat, name); nav(`/product-hub/preislisten/${c.id}`);
                }}><Copy className="w-3.5 h-3.5 mr-1" />Katalog duplizieren</Button>
              </TabsContent>

              {/* Versionen */}
              <TabsContent value="versionen" className="space-y-2">
                <Button size="sm" variant="outline" className="w-full" disabled={!canWrite} onClick={makeVersion}>
                  <History className="w-3.5 h-3.5 mr-1" />Aktuelle Fassung als Version sichern
                </Button>
                {versions.map(v => (
                  <div key={v.id} className="text-xs border rounded p-2 flex justify-between">
                    <span>{v.version_label || `V${v.version}`}</span>
                    <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                ))}
                {versions.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Versionen.</div>}
                <Button size="sm" variant="ghost" className="w-full" onClick={load}><RefreshCw className="w-3.5 h-3.5 mr-1" />Neu laden</Button>
              </TabsContent>
            </Tabs>
          </CardContent></Card>
        </div>
      </div>

      {/* Druckansicht */}
      <div className="hidden print:block">
        <CatalogView catalog={cat} items={items} products={products} pages={pages} device="pdf" publicUrl={publicUrl} />
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />

      <style>{`
        @media print {
          @page { size: A4 ${settings.pdf?.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 0; }
          body { background: #fff; }
          .ph-cat-page { break-after: page; box-shadow: none !important; border-radius: 0 !important; width: 100% !important; margin: 0 !important; }
        }
      `}</style>
    </div>
  );
}
