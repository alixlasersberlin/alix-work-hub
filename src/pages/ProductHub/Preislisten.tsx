import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, Plus, Copy, Archive, Loader2, ExternalLink, FileText, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  catList, catCreate, catUpdate, catDuplicate, catTemplates, defaultCover, defaultSettings,
  phCatalogSlug, PH_CATALOG_STATUS, PH_CATALOG_VARIANTS, hubPrices, catalogMoney,
} from '@/lib/producthub/catalog';
import { PH_PRICE_COUNTRIES } from '@/lib/producthub/countryPricing';

const db = supabase as any;

export default function ProductHubPreislisten() {
  const nav = useNavigate();
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));

  const [rows, setRows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [itemRows, setItemRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quickCatalog, setQuickCatalog] = useState<string>('');

  const [form, setForm] = useState<any>({
    name: '', internal_name: '', variant: 'endkunde', language: 'de', currency: 'EUR',
    country: 'de', valid_from: '', valid_to: '', contact: '', notes: '', template_key: 'standard',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [cats, tpl, prods, items] = await Promise.all([
        catList(),
        catTemplates(),
        db.from('ph_products').select('id, name, model, categories, applications, status, hero_image_url, price_countries, config_powers').order('name'),
        db.from('ph_catalog_items').select('*'),
      ]);
      setRows(cats);
      setTemplates(tpl);
      setProducts(prods.data || []);
      setItemRows(items.data || []);
    } catch (e: any) { toast.error(e.message || 'Laden fehlgeschlagen'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const withoutPrice = products.filter(p => {
      const h = hubPrices(p, 'de');
      return !h.uvp && !h.vk;
    }).length;
    return {
      total: rows.length,
      draft: rows.filter(r => r.status === 'draft').length,
      review: rows.filter(r => r.status === 'review').length,
      published: rows.filter(r => r.status === 'published').length,
      online: rows.filter(r => r.status === 'published' && r.is_public).length,
      pdfs: rows.filter(r => r.pdf_generated_at).length,
      archived: rows.filter(r => r.status === 'archived').length,
      expired: rows.filter(r => r.valid_to && r.valid_to < today).length,
      withoutPrice,
    };
  }, [rows, products]);

  const create = async () => {
    if (!form.name.trim()) { toast.error('Bitte einen Namen vergeben'); return; }
    setBusy(true);
    try {
      const tpl = templates.find(t => t.key === form.template_key);
      const cfg = tpl?.config || {};
      const cat = await catCreate({
        ...form,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        slug: `${phCatalogSlug(form.name)}-${Math.random().toString(36).slice(2, 6)}`,
        cover: defaultCover({ subtitle: form.name.toUpperCase() }),
        settings: defaultSettings({
          layout: cfg.layout || 'layout1',
          priceKinds: cfg.priceKinds || ['uvp', 'promo', 'rent'],
        }),
      });
      toast.success('Preisliste angelegt');
      setOpen(false);
      nav(`/product-hub/preislisten/${cat.id}`);
    } catch (e: any) { toast.error(e.message || 'Anlegen fehlgeschlagen'); }
    finally { setBusy(false); }
  };

  const duplicate = async (row: any) => {
    const name = window.prompt('Name der Kopie', `${row.name} (Kopie)`);
    if (!name) return;
    try { const c = await catDuplicate(row, name); toast.success('Dupliziert'); nav(`/product-hub/preislisten/${c.id}`); }
    catch (e: any) { toast.error(e.message || 'Duplizieren fehlgeschlagen'); }
  };

  const setStatus = async (row: any, status: string) => {
    try { await catUpdate(row.id, { status }); await load(); toast.success('Status aktualisiert'); }
    catch (e: any) { toast.error(e.message); }
  };

  const listByStatus = (s: string) => rows.filter(r => r.status === s);

  const quickItems = useMemo(
    () => itemRows.filter(i => i.catalog_id === quickCatalog),
    [itemRows, quickCatalog],
  );
  const quickCat = rows.find(r => r.id === quickCatalog);

  const saveQuick = async (item: any, kind: string, value: string) => {
    const num = value === '' ? null : Number(value.replace(',', '.'));
    const prices = { ...(item.prices || {}), [kind]: num };
    await db.from('ph_catalog_items').update({ prices }).eq('id', item.id);
    if (quickCat) await catUpdate(quickCat.id, { pdf_stale: true });
    setItemRows(rs => rs.map(r => (r.id === item.id ? { ...r, prices } : r)));
  };

  const CatalogCard = ({ row }: { row: any }) => {
    const c = PH_PRICE_COUNTRIES.find(x => x.code === row.country);
    return (
      <Card className="hover:border-primary/50 transition">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold truncate">{row.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {c?.flag} {c?.label} · {row.currency} · {PH_CATALOG_VARIANTS.find(v => v.key === row.variant)?.label}
              </div>
            </div>
            <Badge variant={row.status === 'published' ? 'default' : 'outline'}>
              {PH_CATALOG_STATUS.find(s => s.key === row.status)?.label}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
            <span>{itemRows.filter(i => i.catalog_id === row.id).length} Geräte</span>
            {row.valid_to && <span>· gültig bis {row.valid_to}</span>}
            {row.version_label && <span>· {row.version_label}</span>}
            {row.pdf_stale && row.pdf_generated_at && <Badge variant="destructive" className="text-[10px]">PDF nicht aktuell</Badge>}
            {row.is_public && row.status === 'published' && <Badge className="text-[10px]"><Globe className="w-3 h-3 mr-1" />online</Badge>}
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            <Button size="sm" onClick={() => nav(`/product-hub/preislisten/${row.id}`)}>Öffnen</Button>
            {canWrite && <Button size="sm" variant="outline" onClick={() => duplicate(row)}><Copy className="w-3.5 h-3.5" /></Button>}
            {canWrite && row.status !== 'archived' && (
              <Button size="sm" variant="outline" onClick={() => setStatus(row, 'archived')}><Archive className="w-3.5 h-3.5" /></Button>
            )}
            {row.status === 'published' && row.is_public && row.slug && (
              <Button size="sm" variant="outline" onClick={() => window.open(`/preisliste/${row.slug}`, '_blank')}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const kpi = [
    { label: 'Aktive Kataloge', value: stats.total - stats.archived },
    { label: 'Entwürfe', value: stats.draft },
    { label: 'In Freigabe', value: stats.review },
    { label: 'Veröffentlicht', value: stats.published },
    { label: 'Online-Kataloge', value: stats.online },
    { label: 'PDFs', value: stats.pdfs },
    { label: 'Geräte ohne Preis', value: stats.withoutPrice },
    { label: 'Abgelaufen', value: stats.expired },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Product Hub · Preislisten & Kataloge"
        subtitle="Kataloge aus den vorhandenen Product-Hub-Geräten – ohne doppelte Produktpflege"
        icon={BookOpen}
        actions={canWrite ? <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Neue Preisliste</Button> : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpi.map(k => (
          <Card key={k.label}><CardContent className="p-3">
            <div className="text-2xl font-semibold">{k.value}</div>
            <div className="text-[11px] text-muted-foreground">{k.label}</div>
          </CardContent></Card>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lade…</div>
      ) : (
        <Tabs defaultValue="alle">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="alle">Bestehende Preislisten</TabsTrigger>
            <TabsTrigger value="draft">Entwürfe</TabsTrigger>
            <TabsTrigger value="published">Veröffentlicht</TabsTrigger>
            <TabsTrigger value="archived">Archiv</TabsTrigger>
            <TabsTrigger value="quick">Schnelle Preisänderung</TabsTrigger>
            <TabsTrigger value="templates">Katalogvorlagen</TabsTrigger>
          </TabsList>

          {(['alle', 'draft', 'published', 'archived'] as const).map(key => (
            <TabsContent key={key} value={key}>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {(key === 'alle' ? rows.filter(r => r.status !== 'archived') : listByStatus(key)).map(r => (
                  <CatalogCard key={r.id} row={r} />
                ))}
                {(key === 'alle' ? rows.filter(r => r.status !== 'archived') : listByStatus(key)).length === 0 && (
                  <div className="text-sm text-muted-foreground">Keine Einträge.</div>
                )}
              </div>
            </TabsContent>
          ))}

          <TabsContent value="quick">
            <Card><CardContent className="p-3 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Label className="text-xs">Preisliste</Label>
                <Select value={quickCatalog} onValueChange={setQuickCatalog}>
                  <SelectTrigger className="w-72"><SelectValue placeholder="Preisliste wählen" /></SelectTrigger>
                  <SelectContent>{rows.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {quickCat && (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Produkt</TableHead><TableHead>UVP (Hub)</TableHead><TableHead>Verkauf (Hub)</TableHead>
                    <TableHead>Aktion</TableHead><TableHead>Miete</TableHead><TableHead>Leasing</TableHead>
                    <TableHead>Katalogpreis</TableHead><TableHead>Sichtbar</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {quickItems.map(item => {
                      const p = products.find(x => x.id === item.product_id);
                      if (!p) return null;
                      const h = hubPrices(p, quickCat.country);
                      const cell = (kind: string) => (
                        <TableCell>
                          <Input
                            className="h-8 w-28"
                            defaultValue={item.prices?.[kind] ?? ''}
                            disabled={!canWrite}
                            onBlur={e => saveQuick(item, kind, e.target.value)}
                          />
                        </TableCell>
                      );
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{catalogMoney(h.uvp, quickCat.country, quickCat.currency)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{catalogMoney(h.vk, quickCat.country, quickCat.currency)}</TableCell>
                          {cell('promo')}{cell('rent')}{cell('leasing')}{cell('custom')}
                          <TableCell>
                            <Badge variant={item.visible ? 'default' : 'outline'} className="cursor-pointer" onClick={async () => {
                              if (!canWrite) return;
                              await db.from('ph_catalog_items').update({ visible: !item.visible }).eq('id', item.id);
                              setItemRows(rs => rs.map(r => (r.id === item.id ? { ...r, visible: !item.visible } : r)));
                            }}>{item.visible ? 'ja' : 'nein'}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {quickItems.length === 0 && <TableRow><TableCell colSpan={8} className="text-sm text-muted-foreground">Noch keine Geräte in dieser Preisliste.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="templates">
            <div className="grid md:grid-cols-3 gap-3">
              {templates.map(t => (
                <Card key={t.id}><CardContent className="p-4 space-y-2">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                  {canWrite && (
                    <Button size="sm" variant="outline" onClick={() => { setForm((f: any) => ({ ...f, template_key: t.key })); setOpen(true); }}>
                      Preisliste aus Vorlage
                    </Button>
                  )}
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Neue Preisliste · Grunddaten</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Name der Preisliste</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="ALIX LASERS Deutschland 2026" />
            </div>
            <div><Label className="text-xs">Interne Bezeichnung</Label>
              <Input value={form.internal_name} onChange={e => setForm({ ...form, internal_name: e.target.value })} /></div>
            <div><Label className="text-xs">Katalogvariante</Label>
              <Select value={form.variant} onValueChange={v => setForm({ ...form, variant: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PH_CATALOG_VARIANTS.map(v => <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label className="text-xs">Sprache</Label>
              <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['de', 'en', 'fr', 'es', 'vi', 'ar'].map(l => <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div><Label className="text-xs">Land / Markt</Label>
              <Select value={form.country} onValueChange={v => {
                const c = PH_PRICE_COUNTRIES.find(x => x.code === v);
                setForm({ ...form, country: v, currency: c?.currency || 'EUR' });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PH_PRICE_COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.label}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label className="text-xs">Währung</Label>
              <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
            <div><Label className="text-xs">Gültig ab</Label>
              <Input type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
            <div><Label className="text-xs">Gültig bis</Label>
              <Input type="date" value={form.valid_to} onChange={e => setForm({ ...form, valid_to: e.target.value })} /></div>
            <div><Label className="text-xs">Ansprechpartner</Label>
              <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
            <div><Label className="text-xs">Vorlage</Label>
              <Select value={form.template_key} onValueChange={v => setForm({ ...form, template_key: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{templates.map(t => <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="md:col-span-2"><Label className="text-xs">Interne Notiz</Label>
              <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={create} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />} Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
