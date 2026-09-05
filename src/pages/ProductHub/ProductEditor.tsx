import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/infinity/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Cpu, Save, Loader2, ShieldAlert, ArrowLeft, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  PH_APPLICATIONS, PH_CHANNELS, PH_CRITICAL_FIELDS, PH_STATUS, phLabel, PH_ACTIVE_FIELD, PH_DOC_TYPES, PH_DOC_VISIBILITY,
} from '@/lib/producthub/config';
import { phGetProduct, phUpdateProduct, phChannelRows, phUpsertChannel } from '@/lib/producthub/api';
import { useAuth } from '@/hooks/useAuth';
import { EnrichProductButton } from '@/components/producthub/EnrichProductButton';
import { WebPreviewButton } from '@/components/producthub/WebPreviewButton';
import { SmartKiEditor } from '@/components/producthub/SmartKiEditor';
import { SeoAiButton } from '@/components/producthub/SeoAiButton';
import { AiFieldButton } from '@/components/producthub/AiFieldButton';
import { displayMediaUrl, displayMediaFileName } from '@/lib/mediaDisplay';
import { PH_DEFAULT_COLORS, PH_DEFAULT_POWERS } from '@/lib/producthub/deviceConfig';

/** Editor für eine Werteliste (Farben / Leistungen), die im Angebot zur Auswahl steht. */
function OptionListEditor({ label, values, defaults, disabled, onChange }: {
  label: string; values: string[]; defaults: readonly string[]; disabled?: boolean;
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const list = values.length ? values : [...defaults];
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {list.map(v => (
          <Badge key={v} variant="outline" className="gap-1">
            {v}
            {!disabled && (
              <button type="button" className="ml-1 text-destructive"
                onClick={() => onChange(list.filter(x => x !== v))}>×</button>
            )}
          </Badge>
        ))}
        {list.length === 0 && <span className="text-xs text-muted-foreground">Keine Werte hinterlegt</span>}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Wert hinzufügen" className="h-9" />
          <Button size="sm" variant="outline" type="button"
            onClick={() => { const v = draft.trim(); if (v && !list.includes(v)) onChange([...list, v]); setDraft(''); }}>
            Hinzufügen
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => onChange([...defaults])}>Standard</Button>
        </div>
      )}
    </div>
  );
}





const db = supabase as any;

/** Feld-spezifische Hinweise für die KI-Erzeugung */
const AI_HINTS: Record<string, string> = {
  name: 'Marketingtauglicher Produktname des Lasergeräts, kurz und ohne Heilversprechen.',
  internal_name: 'Kurze interne Bezeichnung für die Verwaltung, kein Marketing.',
  model: 'Modellbezeichnung des Geräts, kurz (z. B. "ALIX BlueIce Smart KI").',
  sku: 'Kurze technische Artikelnummer in Großbuchstaben/Ziffern, keine Sonderzeichen außer Bindestrich.',
  slug: 'URL-Slug in Kleinbuchstaben, nur a-z, 0-9 und Bindestriche.',
  product_group: 'Produktgruppe, z. B. Diodenlaser, Alexandrit, HIFU, Kombisystem.',
  short_description: 'Kurzbeschreibung des Geräts, 1–2 Sätze, sachlich, MDR-konform, keine Heilversprechen.',
  long_description: 'Ausführliche Produktbeschreibung mit Nutzen, Technik und Einsatzbereichen, sachlich und MDR-konform.',
  wavelengths: 'Wellenlängen in nm, z. B. "755 / 808 / 1064 nm". Nur plausible Angaben, keine Erfindungen.',
  power: 'Maximale Ausgangsleistung inkl. Einheit, z. B. "1200 W".',
  fluence: 'Fluence-Bereich inkl. Einheit, z. B. "1–60 J/cm²".',
  pulse_duration: 'Pulsdauer-Bereich inkl. Einheit, z. B. "10–400 ms".',
  frequency: 'Frequenzbereich inkl. Einheit, z. B. "1–10 Hz".',
  spot_sizes: 'Verfügbare Spotgrößen, z. B. "12x12 mm, 15x25 mm".',
  cooling: 'Kühlsystem kurz beschrieben, z. B. "Kontaktkühlung bis -5 °C, Peltier + Wasser".',
  laser_class: 'Laserklasse nach IEC 60825-1, z. B. "Klasse 4".',
  mdr_status: 'MDR-Status kurz, z. B. "MDR-konform, Klasse IIb".',
  ce_status: 'CE-Status kurz, z. B. "CE 0123 vorhanden".',
  iso_status: 'ISO-Status kurz, z. B. "ISO 13485 zertifiziert".',
  intended_use: 'Zweckbestimmung im regulatorischen Stil (MDR), präzise, ohne Werbesprache und ohne Heilversprechen.',
  manufacturer: 'Name des Herstellers (Legal Manufacturer).',
  production_site: 'Produktionsstandort (Ort, Land).',
  hero_image_url: 'Nicht erfinden – nur formatieren, wenn bereits ein Wert vorhanden ist.',
};

const AI_LONG = new Set(['short_description', 'long_description', 'intended_use']);

function Field({ k, form, set, disabled, area, ai = true, productId }: any) {
  const critical = PH_CRITICAL_FIELDS.includes(k);
  const showAi = ai && k !== 'alix_product_id' && k !== 'hero_image_url';
  const input = area
    ? <Textarea rows={5} value={form[k] ?? ''} disabled={disabled} onChange={e => set(k, e.target.value)} />
    : <Input value={form[k] ?? ''} disabled={disabled} onChange={e => set(k, e.target.value)} />;
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        {phLabel(k)}
        {critical && <span title="Kritisches Feld – Änderung wird protokolliert"><ShieldAlert className="w-3 h-3 text-amber-500" /></span>}
      </Label>
      {showAi ? (
        <div className="flex items-end gap-1">
          <div className="flex-1">{input}</div>
          <AiFieldButton
            fieldLabel={phLabel(k)}
            hint={AI_HINTS[k]}
            current={form[k] ?? ''}
            maxChars={AI_LONG.has(k) ? (k === 'long_description' ? 1200 : 400) : 120}
            productId={productId}
            context={{
              name: form.name, model: form.model, product_group: form.product_group,
              wavelengths: form.wavelengths, power: form.power, laser_class: form.laser_class,
              applications: form.applications, manufacturer: form.manufacturer,
            }}
            disabled={disabled}
            onGenerated={v => set(k, v)}
          />
        </div>
      ) : input}
    </div>
  );
}

/** Hauptbild: zeigt niemals die Supabase-Domain, sondern eine alixwork.de-Adresse. */
function HeroImageField({ form, set, disabled }: any) {
  const [edit, setEdit] = useState(false);
  const raw = form.hero_image_url ?? '';
  const masked = displayMediaUrl(raw);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Hauptbild</Label>
        {!disabled && (
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline"
            onClick={() => setEdit(v => !v)}>
            {edit ? 'Fertig' : 'Bearbeiten'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {raw && (
          <div className="w-24 h-24 shrink-0 rounded border border-border bg-white p-1 flex items-center justify-center overflow-hidden">
            <img src={raw} alt={form.name || 'Hauptbild'} loading="lazy" className="w-full h-full object-contain" />
          </div>
        )}
        <div className="flex-1">
          {edit
            ? <Input value={raw} disabled={disabled} onChange={e => set('hero_image_url', e.target.value)} />
            : <Input value={masked} readOnly title={masked} className="text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}


/** Angebotsbild: zeigt niemals die Supabase-Domain, sondern eine alixwork.de-Adresse. */
function OfferImageField({ form, set, disabled }: any) {
  const [edit, setEdit] = useState(false);
  const raw = form.offer_image_url ?? '';
  const masked = displayMediaUrl(raw);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end">
        {!disabled && (
          <button type="button" className="text-[11px] text-muted-foreground hover:text-foreground underline"
            onClick={() => setEdit(v => !v)}>
            {edit ? 'Fertig' : 'Bearbeiten'}
          </button>
        )}
      </div>
      {edit
        ? <Input value={raw} disabled={disabled} placeholder="Bild-Adresse eingeben oder unten aus den Medien wählen"
            onChange={e => set('offer_image_url', e.target.value)} />
        : <Input value={masked} readOnly title={masked} className="text-muted-foreground"
            placeholder="Bild unten aus den Medien wählen" />}
    </div>
  );
}

/** Daten eines anderen Geräts übernehmen */
const COPY_GROUPS: { key: string; label: string; fields: string[] }[] = [
  { key: 'texte', label: 'Beschreibungen', fields: ['short_description', 'long_description', 'features'] },
  { key: 'technik', label: 'Technik', fields: ['wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes', 'cooling', 'laser_class'] },
  { key: 'anwendungen', label: 'Anwendungen & Kategorien', fields: ['applications', 'categories', 'product_group'] },
  { key: 'regulatory', label: 'Regulatory', fields: ['intended_use', 'manufacturer', 'production_site', 'ce_status', 'mdr_status', 'iso_status', 'standards'] },
  { key: 'smartki', label: 'Smart KI', fields: ['smart_ki'] },
  { key: 'seo', label: 'SEO', fields: ['seo_title', 'seo_description'] },
];

function CopyFromProduct({ currentId, disabled, onApply }: { currentId?: string; disabled?: boolean; onApply: (patch: Record<string, any>) => void }) {
  const [list, setList] = useState<any[]>([]);
  const [src, setSrc] = useState('');
  const [groups, setGroups] = useState<string[]>(COPY_GROUPS.map(g => g.key));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.from('ph_products').select('id,name,model,alix_product_id').order('name').then(({ data }: any) =>
      setList((data || []).filter((p: any) => p.id !== currentId)));
  }, [currentId]);

  const toggle = (k: string) => setGroups(g => g.includes(k) ? g.filter(x => x !== k) : [...g, k]);

  const apply = async () => {
    if (!src) { toast.error('Bitte ein Gerät auswählen'); return; }
    setBusy(true);
    try {
      const source = await phGetProduct(src);
      const fields = COPY_GROUPS.filter(g => groups.includes(g.key)).flatMap(g => g.fields);
      const patch: Record<string, any> = {};
      fields.forEach(f => { if ((source as any)[f] !== undefined) patch[f] = (source as any)[f]; });
      onApply(patch);
      toast.success('Daten übernommen – bitte prüfen und speichern');
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="md:col-span-3 rounded-md border border-border p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Copy className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Daten eines anderen Geräts übernehmen</span>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Vorlage-Gerät</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={src} disabled={disabled} onChange={e => setSrc(e.target.value)}>
            <option value="">— Gerät wählen —</option>
            {list.map(p => <option key={p.id} value={p.id}>{p.name}{p.model ? ` · ${p.model}` : ''}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button size="sm" variant="outline" className="w-full" disabled={disabled || busy || !src} onClick={apply}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Copy className="w-4 h-4 mr-1" />} Übernehmen
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {COPY_GROUPS.map(g => (
          <Badge key={g.key} variant={groups.includes(g.key) ? 'default' : 'outline'}
            className="cursor-pointer" onClick={() => !disabled && toggle(g.key)}>{g.label}</Badge>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Name, SKU, Slug, Artikel-ID und Medien werden nie übernommen. Änderungen werden erst mit „Speichern“ übernommen.
      </p>
    </div>
  );
}



export default function ProductHubEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { roles } = useAuth();
  const canWrite = (roles || []).some((r: string) => ['Super Admin', 'Admin'].includes(r));
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [mainKeyword, setMainKeyword] = useState('');
  const [kwInput, setKwInput] = useState('');

  const addKeyword = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    setKeywords(prev => (prev.some(x => x.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v]));
  };



  const load = async () => {
    if (!id) return;
    const p = await phGetProduct(id);
    setForm(p);
    const [h, m, d, c, seo] = await Promise.all([
      db.from('ph_field_history').select('*').eq('product_id', id).order('created_at', { ascending: false }).limit(200),
      db.from('ph_media').select('*').eq('product_id', id).order('sort_order'),
      db.from('ph_documents').select('*').eq('product_id', id),
      phChannelRows(id),
      db.from('ph_seo').select('*').eq('product_id', id).maybeSingle(),
    ]);
    setHistory(h.data || []); setMedia(m.data || []); setDocs(d.data || []); setChannels(c);
    setMainKeyword(seo?.data?.main_keyword || '');
    setKeywords(seo?.data?.secondary_keywords || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!id || !form) return;
    setSaving(true);
    try {
      const { id: _i, created_at, updated_at, ...patch } = form;
      await phUpdateProduct(id, patch);
      const { error: seoErr } = await db.from('ph_seo').upsert({
        product_id: id,
        seo_title: form.seo_title ?? null,
        meta_description: form.seo_description ?? null,
        url_slug: form.slug ?? null,
        main_keyword: mainKeyword.trim() || null,
        secondary_keywords: keywords,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id' });
      if (seoErr) throw seoErr;
      toast.success('Gespeichert – Änderungen wurden protokolliert');
      await load();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };


  const toggleApp = (a: string) => {
    const cur: string[] = form.applications || [];
    set('applications', cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a]);
  };

  if (!form) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader title={form.name} subtitle={`${form.alix_product_id || '—'} · ${form.model || ''}`} icon={Cpu}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => nav('/product-hub/geraete')}><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</Button>
            {id && <WebPreviewButton productId={id} product={form} />}
            {canWrite && id && <EnrichProductButton productId={id} productName={form.name} onDone={load} />}
            {canWrite && <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Speichern</Button>}
          </div>
        } />

      <Tabs defaultValue="allgemein">
        <TabsList className="flex-wrap h-auto">
          {['allgemein', 'technik', 'konfiguration', 'anwendungen', 'smartki', 'medien', 'dokumente', 'regulatory', 'webseiten', 'seo', 'historie'].map(t => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'smartki' ? 'Smart KI' : t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="allgemein">
          <Card><CardContent className="p-4 grid md:grid-cols-3 gap-4">
            <CopyFromProduct currentId={id} disabled={!canWrite} onApply={patch => setForm((f: any) => ({ ...f, ...patch }))} />
            {['name', 'internal_name', 'model', 'sku', 'slug', 'alix_product_id', 'product_group'].map(k => (
              <Field key={k} k={k} form={form} set={set} productId={id} disabled={!canWrite} />
            ))}
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.status}
                disabled={!canWrite} onChange={e => set('status', e.target.value)}>
                {PH_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6"><Switch checked={form.featured} disabled={!canWrite} onCheckedChange={v => set('featured', v)} /><Label className="text-xs">Featured</Label></div>
            <div className="flex items-center gap-2 pt-6"><Switch checked={form.protected} disabled={!canWrite} onCheckedChange={v => set('protected', v)} /><Label className="text-xs">Geschützt</Label></div>
            <div className="md:col-span-3"><Field k="short_description" form={form} set={set} productId={id} disabled={!canWrite} area /></div>
            <div className="md:col-span-3"><Field k="long_description" form={form} set={set} productId={id} disabled={!canWrite} area /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="technik">
          <Card><CardContent className="p-4 grid md:grid-cols-3 gap-4">
            {['wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes', 'cooling', 'laser_class'].map(k => (
              <Field key={k} k={k} form={form} set={set} productId={id} disabled={!canWrite} />
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="konfiguration">
          <Card><CardContent className="p-4 space-y-6">
            <p className="text-xs text-muted-foreground">
              Diese Werte werden bei der Angebotserstellung je Geräteposition abgefragt.
            </p>
            <OptionListEditor
              label="Farbe des Gerätes"
              values={(form.config_colors as string[]) || []}
              defaults={PH_DEFAULT_COLORS}
              disabled={!canWrite}
              onChange={v => set('config_colors', v)}
            />
            <OptionListEditor
              label="Leistung Lasermodul"
              values={(form.config_powers as string[]) || []}
              defaults={PH_DEFAULT_POWERS}
              disabled={!canWrite}
              onChange={v => set('config_powers', v)}
            />
            <div className="flex items-center gap-3">
              <Switch checked={form.config_required !== false} disabled={!canWrite}
                onCheckedChange={v => set('config_required', v)} />
              <Label className="text-xs">Konfiguration im Angebot verpflichtend abfragen</Label>
            </div>
          </CardContent></Card>
        </TabsContent>


        <TabsContent value="anwendungen">
          <Card><CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Passende Anwendungen wählen – oder per KI vorschlagen lassen.</p>
              {canWrite && (
                <AiFieldButton
                  fieldLabel="Passende Anwendungsbereiche"
                  hint={`Wähle ausschließlich aus dieser Liste und gib sie kommagetrennt zurück: ${PH_APPLICATIONS.join(', ')}`}
                  current={(form.applications || []).join(', ')} maxChars={160} productId={id}
                  context={{ name: form.name, wavelengths: form.wavelengths, power: form.power, short_description: form.short_description }}
                  onGenerated={v => {
                    const picked = v.split(',').map(s => s.trim().toLowerCase());
                    const next = PH_APPLICATIONS.filter(a => picked.some(p => p === a.toLowerCase()));
                    if (next.length) set('applications', next);
                  }}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {PH_APPLICATIONS.map(a => (
                <Badge key={a} variant={(form.applications || []).includes(a) ? 'default' : 'outline'}
                  className="cursor-pointer" onClick={() => canWrite && toggleApp(a)}>{a}</Badge>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>


        <TabsContent value="smartki">
          <Card><CardContent className="p-4">
            <SmartKiEditor
              value={form.smart_ki}
              disabled={!canWrite}
              productId={id}
              productName={form.name}
              onChange={v => set('smart_ki', v)}
            />
          </CardContent></Card>
        </TabsContent>


        <TabsContent value="medien">
          <Card><CardContent className="p-4 space-y-3">
            <HeroImageField form={form} set={set} disabled={!canWrite} />
            {canWrite && id && (
              <ImageUpload
                productId={id}
                onDone={async (url) => {
                  if (!form.hero_image_url) set('hero_image_url', url);
                  if (!form.offer_image_url) set('offer_image_url', url);
                  await load();
                }}
              />
            )}

            <div className="rounded-md border border-border p-3 space-y-2">
              <Label className="text-xs">Hauptbild für Angebote</Label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                {(form.offer_image_url || form.hero_image_url) ? (
                  <img src={form.offer_image_url || form.hero_image_url} alt="Angebotsbild" loading="lazy"
                    className="h-20 w-28 rounded bg-white object-contain p-1" />
                ) : (
                  <div className="h-20 w-28 rounded border border-dashed border-amber-500/60 flex items-center justify-center text-[11px] text-amber-500 text-center px-1">
                    kein Angebotsbild
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <OfferImageField form={form} set={set} disabled={!canWrite} />
                  <p className="text-[11px] text-muted-foreground">
                    Dieses Bild wird automatisch in Angeboten, Angebots-PDFs und Aufträgen verwendet.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {media.map(m => (
                <div key={m.id} className="border border-border rounded-md p-2 space-y-1">
                  {m.media_type === 'image'
                    ? <div className="w-full aspect-square rounded bg-white p-2 flex items-center justify-center overflow-hidden"><img src={m.url} alt={m.alt_text || m.title || ''} loading="lazy" className="w-full h-full object-contain" /></div>
                    : <div className="aspect-square flex items-center justify-center text-xs text-muted-foreground">Video</div>}
                  <div className="text-[11px] truncate">{m.title || m.kind}</div>
                  <div className="text-[10px] text-muted-foreground truncate" title={displayMediaUrl(m.url)}>{displayMediaFileName(m.url)}</div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{m.kind}</Badge>
                    {form.hero_image_url === m.url && <Badge className="text-[10px]">Hauptbild</Badge>}
                    {form.offer_image_url === m.url && <Badge className="text-[10px]">Angebotsbild</Badge>}
                  </div>
                  {canWrite && m.media_type === 'image' && (
                    <div className="space-y-1">
                      {form.hero_image_url !== m.url && (
                        <Button size="sm" variant="outline" className="w-full h-7 text-[10px]"
                          onClick={() => set('hero_image_url', m.url)}>
                          Als Hauptbild
                        </Button>
                      )}
                      {form.offer_image_url !== m.url && (
                        <Button size="sm" variant="outline" className="w-full h-7 text-[10px]"
                          onClick={() => set('offer_image_url', m.url)}>
                          Als Angebotsbild
                        </Button>
                      )}
                    </div>
                  )}

                </div>
              ))}
              {media.length === 0 && <div className="text-sm text-muted-foreground">Keine Medien.</div>}
            </div>
          </CardContent></Card>
        </TabsContent>



        <TabsContent value="dokumente">
          <Card><CardContent className="p-4 space-y-4">
            {canWrite && id && <DocUpload productId={id} onDone={load} />}
            <Table>
              <TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Typ</TableHead><TableHead>Sichtbarkeit</TableHead><TableHead>Version</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.map(d => (
                  <TableRow key={d.id}><TableCell>{d.title}</TableCell>
                    <TableCell>{d.doc_type}</TableCell><TableCell><Badge variant="outline">{d.visibility}</Badge></TableCell><TableCell>{d.version || '—'}</TableCell>
                    <TableCell className="text-right"><DocOpenButton doc={d} /></TableCell></TableRow>
                ))}
                {docs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Keine Dokumente.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>

        </TabsContent>

        <TabsContent value="regulatory">
          <Card><CardContent className="p-4 grid md:grid-cols-3 gap-4">
            {['mdr_status', 'ce_status', 'iso_status', 'intended_use', 'manufacturer', 'production_site'].map(k => (
              <Field key={k} k={k} form={form} set={set} productId={id} disabled={!canWrite} area={k === 'intended_use'} />
            ))}
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">Normen <ShieldAlert className="w-3 h-3 text-amber-500" /></Label>
              <div className="flex items-end gap-1">
                <Input className="flex-1" value={(form.standards || []).join(', ')} disabled={!canWrite}
                  onChange={e => set('standards', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
                <AiFieldButton fieldLabel="Angewandte Normen"
                  hint="Nur zutreffende Normen als kommagetrennte Liste, z. B. IEC 60601-1, IEC 60825-1, ISO 14971, ISO 13485. Keine Erklärtexte."
                  current={(form.standards || []).join(', ')} maxChars={200} productId={id}
                  context={{ name: form.name, laser_class: form.laser_class, intended_use: form.intended_use }}
                  disabled={!canWrite}
                  onGenerated={v => set('standards', v.split(',').map(s => s.trim()).filter(Boolean))} />
              </div>
            </div>

          </CardContent></Card>
        </TabsContent>

        <TabsContent value="webseiten">
          <Card><CardContent className="p-4 space-y-4">
            {PH_CHANNELS.map(ch => {
              const row = channels.find(c => c.channel_code === ch.code);
              return (
                <div key={ch.code} className="border border-border rounded-lg p-3 flex flex-wrap items-center gap-4">
                  <div className="font-medium w-44">{ch.label}</div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!form[PH_ACTIVE_FIELD[ch.code]]} disabled={!canWrite}
                      onCheckedChange={v => set(PH_ACTIVE_FIELD[ch.code], v)} />
                    <span className="text-xs text-muted-foreground">aktiv</span>
                  </div>
                  <Badge variant="outline">{row?.status || 'not_published'}</Badge>
                  <span className="text-xs text-muted-foreground">Letzter Sync: {row?.last_sync_at ? new Date(row.last_sync_at).toLocaleString('de-DE') : '—'}</span>
                  <span className="text-xs text-muted-foreground">Live-Version: {row?.live_version || '—'}</span>
                  {row?.has_pending_changes && <Badge className="bg-sky-500 text-white">Änderungen verfügbar</Badge>}
                  <div className="ml-auto flex gap-2">
                    {row?.live_url && <Button size="sm" variant="outline" asChild><a href={row.live_url} target="_blank" rel="noreferrer">Vorschau</a></Button>}
                    {canWrite && (
                      <>
                        <Button size="sm" variant="outline" onClick={async () => {
                          await phUpsertChannel(id!, ch.code, { hold: !row?.hold });
                          toast.success(row?.hold ? 'Freigegeben' : 'Zurückgehalten'); load();
                        }}>{row?.hold ? 'Freigeben' : 'Zurückhalten'}</Button>
                        <Button size="sm" onClick={async () => {
                          await phUpsertChannel(id!, ch.code, {
                            status: 'published', publish_state: 'published', has_pending_changes: false,
                            last_sync_at: new Date().toISOString(), last_sync_status: 'ok',
                          });
                          toast.success(`Für ${ch.short} veröffentlicht (Master-Freigabe)`); load();
                        }}>Veröffentlichen</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Technische Kerndaten bleiben zentral. Marketingtexte/SEO können je Kanal abweichen (Tab SEO bzw. Kanal-Content).
            </p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card><CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Keywords können manuell gepflegt oder per KI vorgeschlagen werden – sie werden mit „Speichern“ übernommen.
              </p>
              {canWrite && (
                <SeoAiButton
                  productId={form.id}
                  current={{ seo_title: form.seo_title, meta_description: form.seo_description, url_slug: form.slug, main_keyword: mainKeyword, secondary_keywords: keywords }}
                  onApply={r => {
                    if (r.seo_title) set('seo_title', r.seo_title);
                    if (r.meta_description) set('seo_description', r.meta_description);
                    if (!form.slug && r.url_slug) set('slug', r.url_slug);
                    if (r.main_keyword) setMainKeyword(r.main_keyword);
                    setKeywords(prev => Array.from(new Set([...prev, ...(r.secondary_keywords || [])].filter(Boolean))));
                  }}
                />
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field k="seo_title" form={form} set={set} productId={id} disabled={!canWrite} />
              <Field k="slug" form={form} set={set} productId={id} disabled={!canWrite} />
              <div className="md:col-span-2">
                <Field k="seo_description" form={form} set={set} productId={id} disabled={!canWrite} area />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Hauptkeyword</Label>
                <Input value={mainKeyword} disabled={!canWrite}
                  placeholder="z. B. Diodenlaser Haarentfernung"
                  onChange={e => setMainKeyword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Keyword hinzufügen</Label>
                <div className="flex gap-2">
                  <Input value={kwInput} disabled={!canWrite}
                    placeholder="Keyword eingeben, Enter oder Komma"
                    onChange={e => {
                      const v = e.target.value;
                      if (v.includes(',')) { v.split(',').forEach(addKeyword); setKwInput(''); }
                      else setKwInput(v);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); addKeyword(kwInput); setKwInput(''); }
                    }} />
                  <Button type="button" size="sm" variant="outline" disabled={!canWrite || !kwInput.trim()}
                    onClick={() => { addKeyword(kwInput); setKwInput(''); }}>Hinzufügen</Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Keywords ({keywords.length})</Label>
              <div className="flex flex-wrap gap-1">
                {keywords.map(k => (
                  <Badge key={k} variant="outline" className="text-[10px] gap-1">
                    <span className="cursor-pointer" title="Kopieren"
                      onClick={() => navigator.clipboard?.writeText(k)}>{k}</span>
                    {canWrite && (
                      <button type="button" aria-label={`${k} entfernen`} className="hover:text-destructive"
                        onClick={() => setKeywords(prev => prev.filter(x => x !== k))}>×</button>
                    )}
                  </Badge>
                ))}
                {keywords.length === 0 && <span className="text-xs text-muted-foreground">Noch keine Keywords hinterlegt.</span>}
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>



        <TabsContent value="historie">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Feld</TableHead><TableHead>Alt</TableHead><TableHead>Neu</TableHead><TableHead>Quelle</TableHead></TableRow></TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id} className={h.is_critical ? 'bg-amber-500/5' : ''}>
                    <TableCell className="text-xs">{new Date(h.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="text-xs">{phLabel(h.field_name)}{h.is_critical && ' ⚠'}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate">{h.old_value ?? '—'}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate">{h.new_value ?? '—'}</TableCell>
                    <TableCell className="text-xs">{h.source}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Keine Historie.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Öffnet ein Dokument – externe URL direkt, Storage-Datei über signierten Link */
function DocOpenButton({ doc }: { doc: any }) {
  const open = async () => {
    try {
      if (doc.storage_path) {
        const { data, error } = await supabase.storage
          .from('product-hub-docs').createSignedUrl(doc.storage_path, 300);
        if (error) throw error;
        window.open(data.signedUrl, '_blank', 'noopener');
        return;
      }
      if (doc.url) { window.open(doc.url, '_blank', 'noopener'); return; }
      toast.error('Keine Datei hinterlegt');
    } catch (e: any) { toast.error(e.message); }
  };
  return <Button size="sm" variant="outline" onClick={open}>Öffnen</Button>;
}

/** Dokument-Upload für ein Gerät */
function DocUpload({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<string>(PH_DOC_TYPES[0]);
  const [visibility, setVisibility] = useState<string>('internal');
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) { toast.error('Bitte eine Datei auswählen'); return; }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${productId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from('product-hub-docs').upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from('ph_documents').insert({
        product_id: productId,
        title: title.trim() || file.name,
        doc_type: docType,
        visibility,
        version: version.trim() || null,
        storage_path: path,
        file_size: file.size,
        resource_type: file.name.split('.').pop()?.toLowerCase() || 'pdf',
        created_by: u?.user?.id ?? null,
      });
      if (error) throw error;
      toast.success('Dokument importiert');
      setFile(null); setTitle(''); setVersion('');
      onDone();
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="text-sm font-medium">Dokument importieren</div>
      <div className="grid md:grid-cols-5 gap-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Datei (PDF, Word, Bild …)</Label>
          <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Titel</Label>
          <Input value={title} placeholder="optional – sonst Dateiname" onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Dokumentart</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={docType} onChange={e => setDocType(e.target.value)}>
            {PH_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sichtbarkeit</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={visibility} onChange={e => setVisibility(e.target.value)}>
            {PH_DOC_VISIBILITY.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5 max-w-[160px]">
          <Label className="text-xs">Version</Label>
          <Input value={version} placeholder="z. B. 1.2" onChange={e => setVersion(e.target.value)} />
        </div>
        <Button onClick={upload} disabled={busy || !file}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Hochladen
        </Button>
      </div>
    </div>
  );
}

/** Bild-Upload für ein Gerät (Medien-Reiter) */
function ImageUpload({ productId, onDone }: { productId: string; onDone: (url: string) => void | Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) { toast.error('Bitte ein Bild auswählen'); return; }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `images/${productId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from('product-hub-docs').upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from('product-hub-docs').createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (sErr || !signed?.signedUrl) throw sErr || new Error('Link konnte nicht erzeugt werden');
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from('ph_media').insert({
        product_id: productId,
        url: signed.signedUrl,
        storage_path: path,
        kind: 'product',
        media_type: 'image',
        title: title.trim() || file.name,
        alt_text: title.trim() || file.name,
        created_by: u?.user?.id ?? null,
      });
      if (error) throw error;
      toast.success('Bild hochgeladen – bitte oben speichern');
      setFile(null); setTitle('');
      await onDone(signed.signedUrl);
    } catch (e: any) { toast.error(e.message || 'Upload fehlgeschlagen'); }
    setBusy(false);
  };

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="text-sm font-medium">Bild hochladen</div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">Bilddatei (JPG, PNG, WEBP)</Label>
          <Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Titel</Label>
          <Input value={title} placeholder="optional – sonst Dateiname" onChange={e => setTitle(e.target.value)} />
        </div>
      </div>
      <Button onClick={upload} disabled={busy || !file} size="sm">
        {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Hochladen
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Das erste hochgeladene Bild wird automatisch als Hauptbild und Angebotsbild übernommen.
      </p>
    </div>
  );
}
