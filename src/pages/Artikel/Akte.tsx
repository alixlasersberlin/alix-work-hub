import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, ArrowLeft, Check, Layers, Loader2, Plus, Save, Trash2, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  PM_APPLICATIONS, PM_CATEGORIES, PM_COMPLIANCE_STATUS, PM_LANDINGPAGES, PM_SEGMENTS, PM_STATUS,
  PM_UNITS, PM_WORKFLOW_STEPS, pmComplianceLabel, pmComplianceTone, pmPublishChecks, pmQuality,
  pmScoreTone, pmSeoScore, pmStatusLabel, pmWarnings,
} from '@/lib/produktmaster/config';
import { pmAddWorkflowStep, pmLoadProduct, pmSetAttributeValue, pmUpsertSection } from '@/lib/produktmaster/api';
import { SeoAiButton } from '@/components/producthub/SeoAiButton';


const db = supabase as any;
const n = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));

function PMField({ k, label, obj, set, type = 'text', disabled }: any) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={obj?.[k] ?? ''}
        disabled={disabled}
        onChange={e => set({ ...obj, [k]: e.target.value })}
      />
    </div>
  );
}


export default function ArtikelAkte() {
  const { id = '' } = useParams();
  const { roles } = useAuth();
  const isAdmin = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const canWrite = isAdmin || (roles || []).some((r: string) => ['Marketing', 'Produktion', 'Vertriebsleitung'].includes(r));
  const canCompliance = isAdmin || (roles || []).some((r: string) => ['QM', 'Medical'].includes(r));

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [p, setP] = useState<any>({});
  const [prices, setPrices] = useState<any>({});
  const [comp, setComp] = useState<any>({});
  const [mkt, setMkt] = useState<any>({});
  const [seo, setSeo] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    const d = await pmLoadProduct(id);
    setData(d);
    setP(d.product || {});
    setPrices(d.prices || {});
    setComp(d.compliance || {});
    setMkt(d.marketing || { usps: [] });
    setSeo(d.seo || {});
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const bundle = useMemo(() => ({
    product: p, prices, compliance: comp, marketing: mkt, seo,
    mediaCount: data?.media?.length || 0, docCount: data?.documents?.length || 0,
    attrCount: data?.attrValues?.length || 0,
  }), [p, prices, comp, mkt, seo, data]);

  const quality = useMemo(() => pmQuality(bundle), [bundle]);
  const warnings = useMemo(() => pmWarnings(bundle), [bundle]);
  const checks = useMemo(() => pmPublishChecks(bundle), [bundle]);

  const saveProduct = async (patch?: Record<string, any>) => {
    setSaving(true);
    try {
      const body = patch || {
        name: p.name, sku: p.sku, model: p.model, brand: p.brand, product_family: p.product_family,
        series: p.series, revision: p.revision, segment: p.segment, ean: p.ean,
        manufacturer_sku: p.manufacturer_sku, manufacturer: p.manufacturer, product_group: p.product_group,
        categories: p.categories, applications: p.applications, short_description: p.short_description,
        long_description: p.long_description, status: p.status, intended_use: p.intended_use,
        wavelengths: p.wavelengths, power: p.power, fluence: p.fluence, pulse_duration: p.pulse_duration,
        frequency: p.frequency, spot_sizes: p.spot_sizes, cooling: p.cooling, laser_class: p.laser_class,
        hero_image_url: p.hero_image_url, quality_score: quality.total,
      };
      const { error } = await db.from('ph_products').update({ ...body, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast.success('Gespeichert');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const saveSection = async (table: string, patch: Record<string, any>, label: string) => {
    setSaving(true);
    try { await pmUpsertSection(table, id, patch); toast.success(`${label} gespeichert`); load(); }
    catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data?.product) return <div className="p-10 text-muted-foreground">Artikel nicht gefunden.</div>;


  const toggleArr = (obj: any, set: any, key: string, v: string) => {
    const cur: string[] = obj[key] || [];
    set({ ...obj, [key]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] });
  };

  const websiteStatus = p.status === 'published' ? 'VERÖFFENTLICHT' : p.status === 'approved' ? 'BEREIT ZUR VERÖFFENTLICHUNG' : 'NICHT VERÖFFENTLICHT';

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Sticky Kopf */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to="/artikel/liste"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-[11px] text-muted-foreground">{p.sku || '—'} · {p.alix_product_id}</div>
          </div>
          <Badge variant="outline">{pmStatusLabel(p.status)}</Badge>
          <span className={`text-[10px] px-2 py-0.5 rounded ${pmComplianceTone(comp.approval_status)}`}>{pmComplianceLabel(comp.approval_status)}</span>
          <Badge variant="outline">{websiteStatus}</Badge>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold tabular-nums ${pmScoreTone(quality.total)}`}>{quality.total} %</span>
            <Progress value={quality.total} className="h-1.5 w-24" />
          </div>
          <div className="text-[11px] text-muted-foreground ml-auto">
            Zuletzt geändert {new Date(p.updated_at).toLocaleString('de-DE')}
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/content-hub/${p.id}`}><Layers className="h-4 w-4 mr-1" />Content Hub</Link>
          </Button>
          {canWrite && <Button size="sm" onClick={() => saveProduct()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Speichern</Button>}
        </div>
      </div>

      <Tabs defaultValue="uebersicht">
        <TabsList className="flex flex-wrap h-auto">
          {[['uebersicht', 'Übersicht'], ['stammdaten', 'Stammdaten'], ['technik', 'Technik'], ['varianten', 'Varianten'],
            ['anwendungen', 'Anwendungen'], ['preise', 'Preise'], ['lieferumfang', 'Lieferumfang'], ['medien', 'Medien'],
            ['dokumente', 'Dokumente'], ['compliance', 'Compliance'], ['marketing', 'Marketing'], ['seo', 'SEO'],
            ['website', 'Website'], ['service', 'Service'], ['historie', 'Historie']].map(([v, l]) => (
            <TabsTrigger key={v} value={v}>{l}</TabsTrigger>
          ))}
        </TabsList>

        {/* ÜBERSICHT */}
        <TabsContent value="uebersicht" className="space-y-4 pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Datenqualität</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {quality.sections.map(s => (
                  <div key={s.key} className="space-y-1">
                    <div className="flex justify-between text-xs"><span>{s.label}</span>
                      <span className={pmScoreTone(s.score)}>{s.score} %</span></div>
                    <Progress value={s.score} className="h-1" />
                    {s.missing.length > 0 && <div className="text-[11px] text-muted-foreground">Fehlt: {s.missing.join(', ')}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Warnungen</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {warnings.length === 0 && <div className="text-muted-foreground">Keine Warnungen.</div>}
                  {warnings.map(w => <div key={w} className="text-destructive">• {w}</div>)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Publishing-Kontrolle</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {checks.map(c => (
                    <div key={c.label} className="flex items-center gap-2">
                      {c.ok ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-destructive" />}{c.label}
                    </div>
                  ))}
                  {isAdmin && (
                    <Button className="mt-2" size="sm" disabled={!checks.every(c => c.ok) || p.status === 'published'}
                      onClick={() => saveProduct({ status: 'approved' })}>
                      Zur Veröffentlichung freigeben
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Freigabe-Workflow</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {PM_WORKFLOW_STEPS.map(s => {
                  const last = data.workflow.find((w: any) => w.step === s.code);
                  return (
                    <div key={s.code} className="border rounded px-3 py-2 text-xs">
                      <div className="font-medium">{s.label}</div>
                      <div className="text-muted-foreground">{last ? `${last.status} · ${new Date(last.acted_at || last.created_at).toLocaleDateString('de-DE')}` : 'offen'}</div>
                      {canWrite && (
                        <Button size="sm" variant="outline" className="mt-1 h-6 text-[11px]"
                          onClick={async () => {
                            const c = window.prompt(`Kommentar zur ${s.label}?`) || '';
                            await pmAddWorkflowStep(id, s.code, 'passed', c);
                            toast.success('Prüfschritt dokumentiert'); load();
                          }}>Prüfung bestätigen</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STAMMDATEN */}
        <TabsContent value="stammdaten" className="pt-4">
          <Card><CardContent className="p-4 grid gap-3 md:grid-cols-3">
            <PMField disabled={!canWrite} k="name" label="Produktname *" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="sku" label="Artikelnummer / SKU *" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="model" label="Modellbezeichnung" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="product_family" label="Produktfamilie" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="brand" label="Marke" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="manufacturer" label="Hersteller" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="manufacturer_sku" label="Hersteller-Artikelnummer" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="ean" label="EAN" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="revision" label="Revision / Version" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="product_group" label="Produktgruppe" obj={p} set={setP} />
            <PMField disabled={!canWrite} k="series" label="Serie" obj={p} set={setP} />
            <div><Label className="text-xs">Segment</Label>
              <Select value={p.segment || ''} onValueChange={v => setP({ ...p, segment: v })} disabled={!canWrite}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{PM_SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label className="text-xs">Status</Label>
              <Select value={p.status || 'draft'} onValueChange={v => setP({ ...p, status: v })} disabled={!canWrite}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PM_STATUS.map(s => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="md:col-span-3"><Label className="text-xs">Kategorien</Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {PM_CATEGORIES.map(c => (
                  <Badge key={c} variant={(p.categories || []).includes(c) ? 'default' : 'outline'} className="cursor-pointer text-[10px]"
                    onClick={() => canWrite && toggleArr(p, setP, 'categories', c)}>{c}</Badge>
                ))}
              </div></div>
            <div className="md:col-span-3"><Label className="text-xs">Kurzbeschreibung</Label>
              <Textarea rows={2} value={p.short_description ?? ''} disabled={!canWrite} onChange={e => setP({ ...p, short_description: e.target.value })} /></div>
            <div className="md:col-span-3"><Label className="text-xs">Langbeschreibung</Label>
              <Textarea rows={5} value={p.long_description ?? ''} disabled={!canWrite} onChange={e => setP({ ...p, long_description: e.target.value })} /></div>
          </CardContent></Card>
        </TabsContent>

        {/* TECHNIK */}
        <TabsContent value="technik" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Kerndaten</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <PMField disabled={!canWrite} k="wavelengths" label="Wellenlängen" obj={p} set={setP} />
              <PMField disabled={!canWrite} k="power" label="Laserleistung" obj={p} set={setP} />
              <PMField disabled={!canWrite} k="fluence" label="Energiedichte J/cm²" obj={p} set={setP} />
              <PMField disabled={!canWrite} k="pulse_duration" label="Pulsbreite" obj={p} set={setP} />
              <PMField disabled={!canWrite} k="frequency" label="Frequenz" obj={p} set={setP} />
              <PMField disabled={!canWrite} k="spot_sizes" label="Spotgrößen / Aufsätze" obj={p} set={setP} />
              <PMField disabled={!canWrite} k="cooling" label="Kühltechnologie" obj={p} set={setP} />
              <PMField disabled={!canWrite} k="laser_class" label="Laserklasse" obj={p} set={setP} />
              <div className="md:col-span-3"><Label className="text-xs">Zweckbestimmung</Label>
                <Textarea rows={2} value={p.intended_use ?? ''} disabled={!canWrite} onChange={e => setP({ ...p, intended_use: e.target.value })} /></div>
            </CardContent>
          </Card>
          <AttributeEditor productId={id} attributes={data.attributes} values={data.attrValues} canWrite={canWrite} onSaved={load} categories={p.categories || []} />
        </TabsContent>

        {/* VARIANTEN */}
        <TabsContent value="varianten" className="pt-4">
          <ChildTable
            title="Varianten" table="ph_variants" productId={id} rows={data.variants} canWrite={canWrite} onChanged={load}
            columns={[
              { k: 'name', label: 'Bezeichnung' }, { k: 'sku', label: 'SKU' }, { k: 'variant_type', label: 'Typ' },
              { k: 'price_net', label: 'Preis netto', type: 'number' }, { k: 'stock', label: 'Bestand', type: 'number' },
              { k: 'image_url', label: 'Bild-URL' },
            ]}
            defaults={{ name: 'Neue Variante' }}
          />
        </TabsContent>

        {/* ANWENDUNGEN */}
        <TabsContent value="anwendungen" className="pt-4">
          <Card><CardContent className="p-4 space-y-3">
            <Label className="text-xs">Anwendungen (Mehrfachauswahl)</Label>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set([...PM_APPLICATIONS, ...(p.applications || [])])).map(a => (
                <Badge key={a} variant={(p.applications || []).includes(a) ? 'default' : 'outline'} className="cursor-pointer"
                  onClick={() => canWrite && toggleArr(p, setP, 'applications', a)}>{a}</Badge>
              ))}
            </div>
            {canWrite && (
              <Button size="sm" variant="outline" onClick={() => {
                const v = window.prompt('Neue Anwendung?');
                if (v) setP({ ...p, applications: [...(p.applications || []), v] });
              }}><Plus className="h-4 w-4 mr-1" />Anwendung ergänzen</Button>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* PREISE */}
        <TabsContent value="preise" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Verkauf & Preise</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              {isAdmin && <PMField disabled={!canWrite} k="purchase_price" label="Einkaufspreis" obj={prices} set={setPrices} type="number" />}
              {isAdmin && <PMField disabled={!canWrite} k="production_cost" label="Herstellkosten" obj={prices} set={setPrices} type="number" />}
              <PMField disabled={!canWrite} k="rrp_net" label="UVP netto" obj={prices} set={setPrices} type="number" />
              <PMField disabled={!canWrite} k="sale_price_net" label="Verkaufspreis netto" obj={prices} set={setPrices} type="number" />
              <PMField disabled={!canWrite} k="promo_price_net" label="Aktionspreis" obj={prices} set={setPrices} type="number" />
              <PMField disabled={!canWrite} k="promo_from" label="Aktionsbeginn" obj={prices} set={setPrices} type="date" />
              <PMField disabled={!canWrite} k="promo_to" label="Aktionsende" obj={prices} set={setPrices} type="date" />
              <PMField disabled={!canWrite} k="vat_rate" label="MwSt. %" obj={prices} set={setPrices} type="number" />
              <div><Label className="text-xs">Bruttopreis</Label>
                <Input readOnly value={prices.sale_price_net ? (Number(prices.sale_price_net) * (1 + Number(prices.vat_rate ?? 19) / 100)).toFixed(2) : ''} /></div>
              <PMField disabled={!canWrite} k="down_payment" label="Anzahlung" obj={prices} set={setPrices} type="number" />
              <PMField disabled={!canWrite} k="monthly_rate" label="Monatliche Rate" obj={prices} set={setPrices} type="number" />
              <PMField disabled={!canWrite} k="delivery_time" label="Lieferzeit" obj={prices} set={setPrices} />
              <PMField disabled={!canWrite} k="stock_status" label="Lagerstatus" obj={prices} set={setPrices} />
              <PMField disabled={!canWrite} k="min_stock" label="Mindestbestand" obj={prices} set={setPrices} type="number" />
              <PMField disabled={!canWrite} k="warranty" label="Garantie" obj={prices} set={setPrices} />
              <div className="md:col-span-4 grid gap-2 md:grid-cols-3 pt-1">
                {([['price_from', 'Preis „ab"'], ['financing_available', 'Finanzierung möglich'], ['leasing_available', 'Leasing möglich'],
                   ['training_included', 'Schulung inklusive'], ['briefing_included', 'Einweisung inklusive'],
                   ['delivery_included', 'Lieferung inklusive'], ['installation_included', 'Installation inklusive']] as const).map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Switch checked={!!prices[k]} disabled={!canWrite} onCheckedChange={v => setPrices({ ...prices, [k]: v })} />{l}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
          {canWrite && (
            <Button onClick={() => saveSection('ph_prices', {
              purchase_price: n(prices.purchase_price), production_cost: n(prices.production_cost),
              rrp_net: n(prices.rrp_net), sale_price_net: n(prices.sale_price_net), promo_price_net: n(prices.promo_price_net),
              promo_from: prices.promo_from || null, promo_to: prices.promo_to || null, vat_rate: n(prices.vat_rate) ?? 19,
              down_payment: n(prices.down_payment), monthly_rate: n(prices.monthly_rate),
              delivery_time: prices.delivery_time || null, stock_status: prices.stock_status || null,
              min_stock: n(prices.min_stock), warranty: prices.warranty || null,
              price_from: !!prices.price_from, financing_available: !!prices.financing_available,
              leasing_available: !!prices.leasing_available, training_included: !!prices.training_included,
              briefing_included: !!prices.briefing_included, delivery_included: !!prices.delivery_included,
              installation_included: !!prices.installation_included,
            }, 'Preise')} disabled={saving}><Save className="h-4 w-4 mr-1" />Preise speichern</Button>
          )}
          <PriceHistory productId={id} />
        </TabsContent>

        {/* LIEFERUMFANG */}
        <TabsContent value="lieferumfang" className="pt-4">
          <ChildTable
            title="Lieferumfang" table="ph_scope_items" productId={id} rows={data.scope} canWrite={canWrite} onChanged={load}
            columns={[
              { k: 'title', label: 'Position' }, { k: 'description', label: 'Beschreibung' },
              { k: 'quantity', label: 'Menge', type: 'number' }, { k: 'unit', label: 'Einheit', options: PM_UNITS as any },
              { k: 'mandatory', label: 'Pflicht', type: 'bool' },
            ]}
            defaults={{ title: 'Neue Position', quantity: 1, unit: 'Stk', mandatory: true }}
          />
        </TabsContent>

        {/* MEDIEN */}
        <TabsContent value="medien" className="pt-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {data.media.map((m: any) => (
              <Card key={m.id}><CardContent className="p-2 space-y-1">
                {m.media_type === 'image'
                  ? <div className="w-full aspect-square rounded bg-white p-2 flex items-center justify-center overflow-hidden"><img src={m.url} alt={m.alt_text || m.title || p.name} loading="lazy" className="w-full h-full object-contain" /></div>
                  : <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground border rounded">Video</div>}
                <div className="text-[11px] truncate">{m.title || m.kind}</div>
                <Badge variant="outline" className="text-[10px]">{m.kind}</Badge>
              </CardContent></Card>
            ))}
            {data.media.length === 0 && <div className="text-sm text-muted-foreground col-span-full">Keine Medien hinterlegt.</div>}
          </div>
          <Button variant="outline" asChild><Link to="/product-hub/medien">Medienbibliothek öffnen</Link></Button>
        </TabsContent>

        {/* DOKUMENTE */}
        <TabsContent value="dokumente" className="pt-4 space-y-3">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Typ</TableHead><TableHead>Sichtbarkeit</TableHead><TableHead>Version</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.documents.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Keine Dokumente.</TableCell></TableRow>}
                {data.documents.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.url ? <a className="text-primary hover:underline" href={d.url} target="_blank" rel="noreferrer">{d.title}</a> : d.title}</TableCell>
                    <TableCell className="text-xs">{d.doc_type}</TableCell>
                    <TableCell className="text-xs">{d.visibility}</TableCell>
                    <TableCell className="text-xs">{d.version || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
          <Button variant="outline" asChild><Link to="/product-hub/dokumente">Dokumentenverwaltung öffnen</Link></Button>
        </TabsContent>

        {/* COMPLIANCE */}
        <TabsContent value="compliance" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Compliance & Regulatory</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {([['ce_relevant', 'CE relevant'], ['mdr_relevant', 'MDR relevant'], ['is_medical_device', 'Medizinprodukt'],
                 ['udi_required', 'UDI erforderlich'], ['doc_declaration', 'Konformitätserklärung vorhanden'],
                 ['doc_technical', 'Technische Dokumentation vorhanden'], ['doc_ifu', 'IFU vorhanden'],
                 ['doc_test_reports', 'Prüfberichte vorhanden'], ['made_in_germany_approved', '„Made in Germany" freigegeben'],
                 ['nisv_relevant', 'NiSV relevant'], ['iso_13485', 'ISO 13485']] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Switch checked={!!comp[k]} disabled={!canCompliance} onCheckedChange={v => setComp({ ...comp, [k]: v })} />{l}
                </label>
              ))}
              <PMField disabled={!canWrite} k="ce_status" label="CE Status" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="mdr_status" label="MDR Status" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="risk_class" label="Risikoklasse" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="laser_class" label="Laserklasse" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="udi_di" label="UDI-DI" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="basic_udi_di" label="Basic UDI-DI" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="manufacturer" label="Hersteller" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="eu_representative" label="EU Representative" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="importer" label="Importeur" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="country_of_origin" label="Ursprungsland" obj={comp} set={setComp} />
              <PMField disabled={!canWrite} k="country_of_manufacture" label="Herstellungsland" obj={comp} set={setComp} />
              <div className="md:col-span-3"><Label className="text-xs">Weitere regulatorische Hinweise</Label>
                <Textarea rows={3} value={comp.notes ?? ''} disabled={!canCompliance} onChange={e => setComp({ ...comp, notes: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Compliance-Freigabe</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Regulatorische Aussagen (CE, MDR, Medizinprodukt, ISO 13485, Made in Germany, UDI, Zertifizierungen)
                werden erst nach ausdrücklicher Freigabe durch QM / Compliance veröffentlicht.
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${pmComplianceTone(comp.approval_status)}`}>{pmComplianceLabel(comp.approval_status)}</span>
                {canCompliance && (
                  <Select value={comp.approval_status || 'not_checked'} onValueChange={v => setComp({ ...comp, approval_status: v })}>
                    <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{PM_COMPLIANCE_STATUS.map(s => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <Textarea rows={2} placeholder="Kommentar zur Freigabe" value={comp.approval_comment ?? ''}
                disabled={!canCompliance} onChange={e => setComp({ ...comp, approval_comment: e.target.value })} />
              {canCompliance ? (
                <Button disabled={saving} onClick={async () => {
                  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
                  await saveSection('ph_compliance', {
                    ce_relevant: !!comp.ce_relevant, mdr_relevant: !!comp.mdr_relevant, is_medical_device: !!comp.is_medical_device,
                    udi_required: !!comp.udi_required, doc_declaration: !!comp.doc_declaration, doc_technical: !!comp.doc_technical,
                    doc_ifu: !!comp.doc_ifu, doc_test_reports: !!comp.doc_test_reports, made_in_germany_approved: !!comp.made_in_germany_approved,
                    nisv_relevant: !!comp.nisv_relevant, iso_13485: !!comp.iso_13485,
                    ce_status: comp.ce_status || null, mdr_status: comp.mdr_status || null, risk_class: comp.risk_class || null,
                    laser_class: comp.laser_class || null, udi_di: comp.udi_di || null, basic_udi_di: comp.basic_udi_di || null,
                    manufacturer: comp.manufacturer || null, eu_representative: comp.eu_representative || null,
                    importer: comp.importer || null, country_of_origin: comp.country_of_origin || null,
                    country_of_manufacture: comp.country_of_manufacture || null, notes: comp.notes || null,
                    approval_status: comp.approval_status || 'not_checked', approval_comment: comp.approval_comment || null,
                    approved_by: comp.approval_status === 'approved' ? uid : null,
                    approved_at: comp.approval_status === 'approved' ? new Date().toISOString() : null,
                  }, 'Compliance');
                }}><Save className="h-4 w-4 mr-1" />Compliance speichern</Button>
              ) : <div className="text-xs text-muted-foreground">Nur QM / Compliance / Admin dürfen diese Angaben freigeben.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MARKETING */}
        <TabsContent value="marketing" className="pt-4 space-y-4">
          <Card><CardContent className="p-4 grid gap-3 md:grid-cols-2">
            <PMField disabled={!canWrite} k="headline" label="Produktheadline" obj={mkt} set={setMkt} />
            <PMField disabled={!canWrite} k="slogan" label="Slogan" obj={mkt} set={setMkt} />
            <div className="md:col-span-2"><Label className="text-xs">Kurzbeschreibung</Label>
              <Textarea rows={2} value={mkt.short_text ?? ''} disabled={!canWrite} onChange={e => setMkt({ ...mkt, short_text: e.target.value })} /></div>
            <div className="md:col-span-2"><Label className="text-xs">Langbeschreibung</Label>
              <Textarea rows={4} value={mkt.long_text ?? ''} disabled={!canWrite} onChange={e => setMkt({ ...mkt, long_text: e.target.value })} /></div>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i}><Label className="text-xs">USP {i + 1}</Label>
                <Input value={(mkt.usps || [])[i] ?? ''} disabled={!canWrite}
                  onChange={e => { const u = [...(mkt.usps || [])]; u[i] = e.target.value; setMkt({ ...mkt, usps: u }); }} /></div>
            ))}
            <div className="md:col-span-2"><Label className="text-xs">Warum dieses Gerät?</Label>
              <Textarea rows={3} value={mkt.why_this_device ?? ''} disabled={!canWrite} onChange={e => setMkt({ ...mkt, why_this_device: e.target.value })} /></div>
            <PMField disabled={!canWrite} k="target_group" label="Zielgruppe" obj={mkt} set={setMkt} />
            <div><Label className="text-xs">CTA</Label>
              <Select value={mkt.cta || ''} onValueChange={v => setMkt({ ...mkt, cta: v })} disabled={!canWrite}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {['Jetzt beraten lassen', 'Vorführung buchen', 'Angebot anfordern', 'Finanzierung berechnen'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select></div>
            <div className="md:col-span-2"><Label className="text-xs">Marketing Claims (Komma-getrennt)</Label>
              <Input value={(mkt.claims || []).join(', ')} disabled={!canWrite}
                onChange={e => setMkt({ ...mkt, claims: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={!!mkt.approved} disabled={!canWrite}
              onCheckedChange={v => setMkt({ ...mkt, approved: v })} />Marketing freigegeben</label>
          </CardContent></Card>
          {canWrite && (
            <Button disabled={saving} onClick={async () => {
              const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
              saveSection('ph_marketing', {
                headline: mkt.headline || null, slogan: mkt.slogan || null, short_text: mkt.short_text || null,
                long_text: mkt.long_text || null, usps: (mkt.usps || []).filter(Boolean), why_this_device: mkt.why_this_device || null,
                target_group: mkt.target_group || null, claims: mkt.claims || [], cta: mkt.cta || null,
                approved: !!mkt.approved, approved_by: mkt.approved ? uid : null,
                approved_at: mkt.approved ? new Date().toISOString() : null,
              }, 'Marketing');
            }}><Save className="h-4 w-4 mr-1" />Marketing speichern</Button>
          )}
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
              <span>SEO</span>
              <span className="flex items-center gap-2">
                {canWrite && (
                  <SeoAiButton
                    productId={p.id}
                    current={{
                      seo_title: seo.seo_title, meta_description: seo.meta_description, h1: seo.h1,
                      main_keyword: seo.main_keyword, secondary_keywords: seo.secondary_keywords,
                      url_slug: seo.url_slug, og_title: seo.og_title, og_description: seo.og_description,
                    }}
                    onApply={r => setSeo({
                      ...seo,
                      seo_title: r.seo_title || seo.seo_title,
                      meta_description: r.meta_description || seo.meta_description,
                      h1: r.h1 || seo.h1,
                      main_keyword: r.main_keyword || seo.main_keyword,
                      secondary_keywords: r.secondary_keywords?.length ? r.secondary_keywords : seo.secondary_keywords,
                      url_slug: seo.url_slug || r.url_slug,
                      og_title: r.og_title || seo.og_title,
                      og_description: r.og_description || seo.og_description,
                    })}
                  />
                )}
                <span className={pmScoreTone(pmSeoScore(seo, p))}>SEO Score {pmSeoScore(seo, p)} / 100</span>
              </span>
            </CardTitle></CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-2">
              <PMField disabled={!canWrite} k="seo_title" label="SEO Titel" obj={seo} set={setSeo} />
              <PMField disabled={!canWrite} k="url_slug" label="URL Slug" obj={seo} set={setSeo} />
              <div className="md:col-span-2"><Label className="text-xs">Meta Description</Label>
                <Textarea rows={2} value={seo.meta_description ?? ''} disabled={!canWrite} onChange={e => setSeo({ ...seo, meta_description: e.target.value })} /></div>
              <PMField disabled={!canWrite} k="h1" label="H1" obj={seo} set={setSeo} />
              <PMField disabled={!canWrite} k="main_keyword" label="Hauptkeyword" obj={seo} set={setSeo} />
              <div className="md:col-span-2"><Label className="text-xs">Nebenkeywords (Komma-getrennt)</Label>
                <Input value={(seo.secondary_keywords || []).join(', ')} disabled={!canWrite}
                  onChange={e => setSeo({ ...seo, secondary_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
              <PMField disabled={!canWrite} k="canonical_url" label="Canonical URL" obj={seo} set={setSeo} />
              <label className="flex items-center gap-2 text-sm pt-5"><Switch checked={!!seo.noindex} disabled={!canWrite}
                onCheckedChange={v => setSeo({ ...seo, noindex: v })} />Noindex</label>
              <PMField disabled={!canWrite} k="og_title" label="OpenGraph Titel" obj={seo} set={setSeo} />
              <PMField disabled={!canWrite} k="og_image" label="OpenGraph Bild (URL)" obj={seo} set={setSeo} />
              <div className="md:col-span-2"><Label className="text-xs">OpenGraph Beschreibung</Label>
                <Textarea rows={2} value={seo.og_description ?? ''} disabled={!canWrite} onChange={e => setSeo({ ...seo, og_description: e.target.value })} /></div>
              <div className="md:col-span-2"><Label className="text-xs">Landingpage-Zuordnung</Label>
                <div className="flex flex-wrap gap-1 pt-1">
                  {PM_LANDINGPAGES.map(l => (
                    <Badge key={l} variant={(seo.landingpages || []).includes(l) ? 'default' : 'outline'} className="cursor-pointer text-[10px]"
                      onClick={() => canWrite && toggleArr(seo, setSeo, 'landingpages', l)}>{l}</Badge>
                  ))}
                </div></div>
            </CardContent>
          </Card>
          {canWrite && (
            <Button disabled={saving} onClick={() => saveSection('ph_seo', {
              seo_title: seo.seo_title || null, meta_description: seo.meta_description || null,
              url_slug: seo.url_slug || null, h1: seo.h1 || null, main_keyword: seo.main_keyword || null,
              secondary_keywords: seo.secondary_keywords || [], canonical_url: seo.canonical_url || null,
              noindex: !!seo.noindex, og_title: seo.og_title || null, og_description: seo.og_description || null,
              og_image: seo.og_image || null, landingpages: seo.landingpages || [], seo_score: pmSeoScore(seo, p),
            }, 'SEO')}><Save className="h-4 w-4 mr-1" />SEO speichern</Button>
          )}
        </TabsContent>

        {/* WEBSITE */}
        <TabsContent value="website" className="pt-4">
          <Card><CardContent className="p-4 space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Website Status</span><Badge variant="outline">{websiteStatus}</Badge></div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-muted-foreground">AlixWork-Version</span><span>{new Date(p.updated_at).toLocaleString('de-DE')}</span></div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-muted-foreground">Kanäle aktiv</span>
              <span>{[p.active_de && 'DE', p.active_com && 'COM', p.active_at && 'AT', p.active_usa && 'USA', p.active_dubai && 'DUBAI'].filter(Boolean).join(', ') || '—'}</span></div>
            <div className="text-xs text-muted-foreground">
              Nur als „public" freigegebene Felder werden über die Website-API ausgeliefert. Einkaufspreise, Herstellkosten,
              interne Notizen, interne Dokumente und nicht freigegebene Compliance-Daten bleiben intern.
            </div>
            <Button variant="outline" asChild><Link to="/product-hub/webseiten">Website-Synchronisation öffnen</Link></Button>
          </CardContent></Card>
        </TabsContent>

        {/* SERVICE */}
        <TabsContent value="service" className="pt-4">
          <Card><CardContent className="p-4 space-y-3 text-sm">
            <div className="text-muted-foreground">Service- und Ersatzteildaten werden aus den bestehenden Modulen übernommen.</div>
            <div className="flex gap-2">
              <Button variant="outline" asChild><Link to="/ersatzteile">Ersatzteile</Link></Button>
              <Button variant="outline" asChild><Link to="/reparatur">Reparaturannahme</Link></Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* HISTORIE */}
        <TabsContent value="historie" className="pt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Zeitpunkt</TableHead><TableHead>Feld</TableHead><TableHead>Alt</TableHead><TableHead>Neu</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.history.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Keine Änderungen protokolliert.</TableCell></TableRow>}
                {data.history.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{new Date(h.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="text-xs">{h.field_name || h.field}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{h.old_value ?? '—'}</TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate">{h.new_value ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Attribut-Editor ---------- */
function AttributeEditor({ productId, attributes, values, canWrite, onSaved, categories }:
  { productId: string; attributes: any[]; values: any[]; canWrite: boolean; onSaved: () => void; categories: string[] }) {
  const [draft, setDraft] = useState<Record<string, any>>({});
  const relevant = attributes.filter(a => !(a.categories || []).length || (a.categories || []).some((c: string) => categories.includes(c)));
  const groups = Array.from(new Set(relevant.map(a => a.group_name || 'Sonstiges')));

  const valueOf = (a: any) => {
    if (draft[a.id] !== undefined) return draft[a.id];
    const v = values.find(x => x.attribute_id === a.id);
    if (!v) return '';
    if (a.value_type === 'number') return v.value_number ?? '';
    if (a.value_type === 'multiselect') return (v.value_list || []).join(', ');
    return v.value_text ?? '';
  };

  const save = async () => {
    try {
      for (const [attrId, raw] of Object.entries(draft)) {
        const a = attributes.find(x => x.id === attrId);
        const patch = a.value_type === 'number'
          ? { value_number: raw === '' ? null : Number(raw), value_text: null, value_list: null }
          : a.value_type === 'multiselect'
            ? { value_list: String(raw).split(',').map(s => s.trim()).filter(Boolean), value_text: null, value_number: null }
            : { value_text: String(raw), value_number: null, value_list: null };
        await pmSetAttributeValue(productId, attrId, patch);
      }
      toast.success('Technische Attribute gespeichert');
      setDraft({}); onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  if (relevant.length === 0) return (
    <Card><CardContent className="p-4 text-sm text-muted-foreground">
      Noch keine passenden Attribute definiert. <Link className="text-primary hover:underline" to="/artikel/attribute">Attribute verwalten</Link>
    </CardContent></Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Technische Attribute</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {groups.map(g => (
          <div key={g} className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">{g}</div>
            <div className="grid gap-3 md:grid-cols-3">
              {relevant.filter(a => (a.group_name || 'Sonstiges') === g).map(a => (
                <div key={a.id}>
                  <Label className="text-xs">{a.label}{a.unit ? ` (${a.unit})` : ''}{a.is_critical && <span className="text-destructive"> *</span>}</Label>
                  {a.value_type === 'select' ? (
                    <Select value={String(valueOf(a))} disabled={!canWrite} onValueChange={v => setDraft({ ...draft, [a.id]: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{(a.options || []).map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    <Input type={a.value_type === 'number' ? 'number' : 'text'} disabled={!canWrite}
                      value={valueOf(a)} onChange={e => setDraft({ ...draft, [a.id]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {canWrite && <Button size="sm" onClick={save} disabled={!Object.keys(draft).length}><Save className="h-4 w-4 mr-1" />Attribute speichern</Button>}
      </CardContent>
    </Card>
  );
}

/* ---------- generische Untertabelle (Varianten, Lieferumfang) ---------- */
function ChildTable({ title, table, productId, rows, columns, canWrite, onChanged, defaults }: any) {
  const [busy, setBusy] = useState(false);

  const update = async (rowId: string, patch: Record<string, any>) => {
    const { error } = await db.from(table).update(patch).eq('id', rowId);
    if (error) toast.error(error.message); else onChanged();
  };
  const add = async () => {
    setBusy(true);
    const { error } = await db.from(table).insert({ product_id: productId, ...defaults, sort_order: rows.length });
    setBusy(false);
    if (error) toast.error(error.message); else onChanged();
  };
  const del = async (rowId: string) => {
    const { error } = await db.from(table).delete().eq('id', rowId);
    if (error) toast.error(error.message); else onChanged();
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        {canWrite && <Button size="sm" variant="outline" onClick={add} disabled={busy}><Plus className="h-4 w-4 mr-1" />Position</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            {columns.map((c: any) => <TableHead key={c.k}>{c.label}</TableHead>)}<TableHead className="w-10" />
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">Keine Einträge.</TableCell></TableRow>}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                {columns.map((c: any) => (
                  <TableCell key={c.k}>
                    {c.type === 'bool' ? (
                      <Switch checked={!!r[c.k]} disabled={!canWrite} onCheckedChange={v => update(r.id, { [c.k]: v })} />
                    ) : c.options ? (
                      <Select value={r[c.k] ?? ''} disabled={!canWrite} onValueChange={v => update(r.id, { [c.k]: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{c.options.map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <Input className="h-8" type={c.type === 'number' ? 'number' : 'text'} defaultValue={r[c.k] ?? ''} disabled={!canWrite}
                        onBlur={e => {
                          const v = c.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
                          if (v !== r[c.k]) update(r.id, { [c.k]: v });
                        }} />
                    )}
                  </TableCell>
                ))}
                <TableCell>{canWrite && <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------- Preishistorie ---------- */
function PriceHistory({ productId }: { productId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await db.from('ph_price_history').select('*').eq('product_id', productId)
        .order('changed_at', { ascending: false }).limit(50);
      setRows(data || []);
    })();
  }, [productId]);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Preishistorie</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Zeitpunkt</TableHead><TableHead>Feld</TableHead><TableHead>Alt</TableHead><TableHead>Neu</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Keine Preisänderungen.</TableCell></TableRow>}
            {rows.map(h => (
              <TableRow key={h.id}>
                <TableCell className="text-xs">{new Date(h.changed_at).toLocaleString('de-DE')}</TableCell>
                <TableCell className="text-xs">{h.field}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{h.old_value ?? '—'}</TableCell>
                <TableCell className="text-xs">{h.new_value ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
