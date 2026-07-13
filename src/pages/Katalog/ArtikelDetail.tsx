import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Save, Upload, Trash2, Star, CheckCircle2, ShieldCheck, FolderTree, Plus, Link2, Sparkles, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const ITEM_STATUSES = ['entwurf','zur_pruefung','korrektur','freigegeben','gesperrt','archiviert','aktiv','inaktiv','ausverkauft','vorbestellung','nur_auf_anfrage','nicht_lieferbar'];
const PRICE_STATUSES = ['entwurf','zur_freigabe','freigegeben','abgelehnt','abgelaufen'];
const TRANSLATION_STATUSES = ['nicht_begonnen','in_bearbeitung','maschinell','geprueft','freigegeben'];

export default function KatalogArtikelDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user, roles } = useAuth();
  const client = supabase as any;
  const canApprove = (roles ?? []).some((r: string) => ['Super Admin', 'Admin', 'Katalog Preise'].includes(r));

  const [item, setItem] = useState<any>(null);
  const [languages, setLanguages] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [descriptions, setDescriptions] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [changeLog, setChangeLog] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [assignedCatIds, setAssignedCatIds] = useState<string[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeLang, setActiveLang] = useState<string>('de');

  const load = async () => {
    const [itemRes, langsRes, countriesRes, branchesRes, currRes, descRes, imgRes, priceRes, logRes, catsRes, assignRes, usageRes] = await Promise.all([
      client.from('catalog_items').select('*').eq('id', id).maybeSingle(),
      client.from('catalog_languages').select('*').eq('is_active', true).order('sort_order'),
      client.from('catalog_countries').select('*').eq('is_active', true).order('sort_order'),
      client.from('catalog_branches').select('*').eq('is_active', true).order('sort_order'),
      client.from('catalog_currencies').select('*').eq('is_active', true).order('code'),
      client.from('catalog_item_descriptions').select('*').eq('item_id', id),
      client.from('catalog_item_images').select('*').eq('item_id', id).order('sort_order'),
      client.from('catalog_item_prices').select('*').eq('item_id', id).order('created_at', { ascending: false }),
      client.from('catalog_change_log').select('*').eq('entity_id', id).order('performed_at', { ascending: false }).limit(200),
      client.from('catalog_categories').select('id, slug, names, parent_id, sort_order').order('sort_order'),
      client.from('item_category_assignments').select('category_id').eq('item_id', id),
      client.from('catalog_item_snapshots').select('id, used_in_type, used_in_id, created_at').eq('item_id', id).order('created_at', { ascending: false }).limit(100),
    ]);
    setItem(itemRes.data);
    setLanguages(langsRes.data ?? []);
    setCountries(countriesRes.data ?? []);
    setBranches(branchesRes.data ?? []);
    setCurrencies(currRes.data ?? []);
    setDescriptions(descRes.data ?? []);
    setImages(imgRes.data ?? []);
    setPrices(priceRes.data ?? []);
    setChangeLog(logRes.data ?? []);
    setCategories(catsRes.data ?? []);
    setAssignedCatIds(((assignRes.data ?? []) as any[]).map((a: any) => a.category_id));
    setUsage(usageRes.data ?? []);
    const def = (langsRes.data ?? []).find((l: any) => l.is_default);
    if (def) setActiveLang(def.code);
  };

  useEffect(() => { if (id) load(); }, [id]);

  const saveItem = async () => {
    if (!item) return;
    setSaving(true);
    const { error } = await client.from('catalog_items').update({
      name: item.name, sku: item.sku, brand: item.brand, model: item.model,
      manufacturer: item.manufacturer, variant: item.variant, item_type: item.item_type,
      ean: item.ean, internal_number: item.internal_number,
      status: item.status, notes_internal: item.notes_internal,
    }).eq('id', id);
    setSaving(false);
    if (error) return toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
    toast({ title: 'Gespeichert' });
    load();
  };

  const upsertDescription = async (patch: any) => {
    const existing = descriptions.find((d) => d.language_code === activeLang);
    if (existing) {
      const { error } = await client.from('catalog_item_descriptions').update(patch).eq('id', existing.id);
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    } else {
      const { error } = await client.from('catalog_item_descriptions').insert({ item_id: id, language_code: activeLang, ...patch });
      if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    }
    toast({ title: 'Übersetzung gespeichert' });
    load();
  };

  const uploadImage = async (file: File) => {
    const path = `${id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from('catalog-media').upload(path, file, { upsert: false });
    if (upErr) return toast({ title: 'Upload fehlgeschlagen', description: upErr.message, variant: 'destructive' });
    const { error } = await client.from('catalog_item_images').insert({
      item_id: id, storage_path: path, file_name: file.name, file_type: file.type,
      file_size: file.size, sort_order: (images.length + 1) * 10, is_primary: images.length === 0,
    });
    if (error) return toast({ title: 'DB-Fehler', description: error.message, variant: 'destructive' });
    toast({ title: 'Bild hochgeladen' });
    load();
  };

  const setPrimary = async (imgId: string) => {
    await client.from('catalog_item_images').update({ is_primary: false }).eq('item_id', id);
    await client.from('catalog_item_images').update({ is_primary: true }).eq('id', imgId);
    load();
  };

  const deleteImage = async (img: any) => {
    if (!confirm('Bild wirklich löschen?')) return;
    await supabase.storage.from('catalog-media').remove([img.storage_path]);
    await client.from('catalog_item_images').delete().eq('id', img.id);
    load();
  };

  const addPrice = async () => {
    if (!countries[0]) return toast({ title: 'Bitte zuerst Land konfigurieren' });
    const c = countries[0];
    await client.from('catalog_item_prices').insert({
      item_id: id, country_id: c.id, currency_code: c.currency_code,
      tax_rate: c.default_tax_rate, price_status: 'entwurf',
    });
    load();
  };

  const updatePrice = async (pid: string, patch: any) => {
    const { error } = await client.from('catalog_item_prices').update(patch).eq('id', pid);
    if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
    load();
  };

  const deletePrice = async (pid: string) => {
    if (!confirm('Preis löschen?')) return;
    await client.from('catalog_item_prices').delete().eq('id', pid);
    load();
  };

  const [signed, setSigned] = useState<Record<string,string>>({});
  useEffect(() => {
    (async () => {
      const out: Record<string,string> = {};
      for (const img of images) {
        const { data } = await supabase.storage.from('catalog-media').createSignedUrl(img.storage_path, 3600);
        if (data?.signedUrl) out[img.id] = data.signedUrl;
      }
      setSigned(out);
    })();
  }, [images]);

  if (!item) {
    return <div className="text-muted-foreground">Lade Artikel…</div>;
  }

  const desc = descriptions.find((d) => d.language_code === activeLang) ?? {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/katalog/artikel"><ArrowLeft className="h-4 w-4 mr-1" />Zurück</Link></Button>
          <div>
            <h2 className="text-xl font-semibold">{item.name}</h2>
            <p className="text-xs font-mono text-muted-foreground">{item.sku}</p>
          </div>
          <Badge variant="secondary">{item.status}</Badge>
          {item.approved_at ? (
            <Badge className="bg-green-600/20 text-green-500 border-green-600/40"><CheckCircle2 className="h-3 w-3 mr-1" />Freigegeben</Badge>
          ) : item.submitted_at ? (
            <Badge variant="outline">Zur Prüfung</Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          {!item.submitted_at && (
            <Button variant="outline" onClick={async () => {
              const { error } = await client.from('catalog_items').update({ submitted_by: user?.id, submitted_at: new Date().toISOString(), status: 'zur_pruefung' }).eq('id', id);
              if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
              toast({ title: 'Zur Prüfung eingereicht' }); load();
            }}>Zur Prüfung einreichen</Button>
          )}
          {canApprove && item.submitted_at && !item.approved_at && item.last_edited_by !== user?.id && (
            <Button onClick={async () => {
              const { error } = await client.from('catalog_items').update({ approved_by: user?.id, status: 'freigegeben' }).eq('id', id);
              if (error) return toast({ title: 'Freigabe fehlgeschlagen', description: error.message, variant: 'destructive' });
              toast({ title: 'Freigegeben' }); load();
            }}><ShieldCheck className="h-4 w-4 mr-2" />Freigeben (4-Augen)</Button>
          )}
          {canApprove && item.submitted_at && !item.approved_at && item.last_edited_by === user?.id && (
            <Badge variant="outline" className="self-center">Freigabe durch anderen Nutzer nötig</Badge>
          )}
          <Button onClick={saveItem} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? 'Speichere…' : 'Speichern'}</Button>
        </div>
      </div>

      <Tabs defaultValue="stammdaten">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
          <TabsTrigger value="beschreibungen">Beschreibungen</TabsTrigger>
          <TabsTrigger value="bilder">Bilder</TabsTrigger>
          <TabsTrigger value="preise">Länderpreise</TabsTrigger>
          <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
          <TabsTrigger value="verwendung">Verwendung</TabsTrigger>
          <TabsTrigger value="verlauf">Änderungsverlauf</TabsTrigger>
        </TabsList>

        <TabsContent value="stammdaten">
          <Card><CardContent className="pt-6 grid gap-3 md:grid-cols-2">
            <div><Label>SKU</Label><Input value={item.sku ?? ''} onChange={(e) => setItem({ ...item, sku: e.target.value })} /></div>
            <div><Label>Interne Artikelnummer</Label><Input value={item.internal_number ?? ''} onChange={(e) => setItem({ ...item, internal_number: e.target.value })} /></div>
            <div><Label>Name</Label><Input value={item.name ?? ''} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
            <div><Label>EAN</Label><Input value={item.ean ?? ''} onChange={(e) => setItem({ ...item, ean: e.target.value })} /></div>
            <div><Label>Hersteller</Label><Input value={item.manufacturer ?? ''} onChange={(e) => setItem({ ...item, manufacturer: e.target.value })} /></div>
            <div><Label>Marke</Label><Input value={item.brand ?? ''} onChange={(e) => setItem({ ...item, brand: e.target.value })} /></div>
            <div><Label>Modell</Label><Input value={item.model ?? ''} onChange={(e) => setItem({ ...item, model: e.target.value })} /></div>
            <div><Label>Variante</Label><Input value={item.variant ?? ''} onChange={(e) => setItem({ ...item, variant: e.target.value })} /></div>
            <div><Label>Artikeltyp</Label><Input value={item.item_type ?? ''} onChange={(e) => setItem({ ...item, item_type: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={item.status} onValueChange={(v) => setItem({ ...item, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ITEM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Interne Notiz (nur intern sichtbar)</Label>
              <Textarea rows={3} value={item.notes_internal ?? ''} onChange={(e) => setItem({ ...item, notes_internal: e.target.value })} />
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="beschreibungen">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Label>Sprache</Label>
              <Select value={activeLang} onValueChange={setActiveLang}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{languages.map((l) => <SelectItem key={l.code} value={l.code}>{l.name} ({l.code})</SelectItem>)}</SelectContent>
              </Select>
              <Badge variant="secondary">{desc.translation_status ?? 'nicht_begonnen'}</Badge>
            </div>
            <div className="grid gap-3">
              <div><Label>Kurzbeschreibung</Label><Textarea rows={2} defaultValue={desc.short_description ?? ''} onBlur={(e) => upsertDescription({ short_description: e.target.value })} /></div>
              <div><Label>Vollständige Beschreibung</Label><Textarea rows={5} defaultValue={desc.long_description ?? ''} onBlur={(e) => upsertDescription({ long_description: e.target.value })} /></div>
              <div><Label>Technische Beschreibung</Label><Textarea rows={3} defaultValue={desc.technical_description ?? ''} onBlur={(e) => upsertDescription({ technical_description: e.target.value })} /></div>
              <div><Label>Lieferumfang</Label><Textarea rows={3} defaultValue={desc.scope_of_delivery ?? ''} onBlur={(e) => upsertDescription({ scope_of_delivery: e.target.value })} /></div>
              <div><Label>Zubehör</Label><Textarea rows={2} defaultValue={desc.accessories ?? ''} onBlur={(e) => upsertDescription({ accessories: e.target.value })} /></div>
              <div><Label>Garantie</Label><Textarea rows={2} defaultValue={desc.warranty ?? ''} onBlur={(e) => upsertDescription({ warranty: e.target.value })} /></div>
              <div>
                <Label>Übersetzungsstatus</Label>
                <Select value={desc.translation_status ?? 'nicht_begonnen'} onValueChange={(v) => upsertDescription({ translation_status: v })}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>{TRANSLATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="bilder">
          <Card><CardContent className="pt-6 space-y-4">
            <div>
              <Label htmlFor="img-upload" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">
                <Upload className="h-4 w-4" /> Bild hochladen
              </Label>
              <input id="img-upload" type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((img) => (
                <Card key={img.id} className="overflow-hidden">
                  {signed[img.id] ? (
                    <img src={signed[img.id]} alt={img.alt_text ?? ''} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 bg-muted animate-pulse" />
                  )}
                  <div className="p-2 flex items-center justify-between text-xs">
                    <span className="truncate">{img.file_name}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant={img.is_primary ? 'default' : 'ghost'} onClick={() => setPrimary(img.id)}>
                        <Star className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteImage(img)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              {images.length === 0 && <p className="text-muted-foreground text-sm col-span-full">Noch keine Bilder</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="preise">
          <Card><CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Verkaufspreise auf UVP-Basis. Einkaufspreise sind hier bewusst nicht vorgesehen.
              </p>
              <Button onClick={addPrice} size="sm">+ Länderpreis</Button>
            </div>
            <div className="space-y-2">
              {prices.map((p) => {
                const country = countries.find((c) => c.id === p.country_id);
                const branch = branches.find((b) => b.id === p.branch_id);
                return (
                  <Card key={p.id} className="p-3 grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
                    <div>
                      <Label className="text-xs">Land</Label>
                      <Select value={p.country_id} onValueChange={(v) => updatePrice(p.id, { country_id: v })}>
                        <SelectTrigger><SelectValue placeholder={country?.name ?? '—'} /></SelectTrigger>
                        <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Niederlassung</Label>
                      <Select value={p.branch_id ?? '__none'} onValueChange={(v) => updatePrice(p.id, { branch_id: v === '__none' ? null : v })}>
                        <SelectTrigger><SelectValue placeholder={branch?.name ?? '—'} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— (alle)</SelectItem>
                          {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Währung</Label>
                      <Select value={p.currency_code} onValueChange={(v) => updatePrice(p.id, { currency_code: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{currencies.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">UVP netto</Label>
                      <Input type="number" step="0.01" defaultValue={p.uvp_net ?? ''} onBlur={(e) => updatePrice(p.id, { uvp_net: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div>
                      <Label className="text-xs">UVP brutto</Label>
                      <Input type="number" step="0.01" defaultValue={p.uvp_gross ?? ''} onBlur={(e) => updatePrice(p.id, { uvp_gross: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div>
                      <Label className="text-xs">Standard netto</Label>
                      <Input type="number" step="0.01" defaultValue={p.standard_net ?? ''} onBlur={(e) => updatePrice(p.id, { standard_net: e.target.value ? Number(e.target.value) : null })} />
                    </div>
                    <div className="flex gap-1">
                      <Select value={p.price_status} onValueChange={(v) => updatePrice(p.id, { price_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PRICE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => deletePrice(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </Card>
                );
              })}
              {prices.length === 0 && <p className="text-muted-foreground text-sm">Noch keine Länderpreise.</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="kategorien">
          <Card><CardContent className="pt-6 space-y-3">
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <FolderTree className="h-4 w-4" /> Zuordnung zu Katalog-Kategorien. Änderungen werden sofort gespeichert.
            </div>
            {categories.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kategorien angelegt.</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {categories.map((c: any) => {
                const checked = assignedCatIds.includes(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={async (v) => {
                        if (v) {
                          const { error } = await client.from('item_category_assignments').insert({ item_id: id, category_id: c.id });
                          if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
                          setAssignedCatIds([...assignedCatIds, c.id]);
                        } else {
                          const { error } = await client.from('item_category_assignments').delete().eq('item_id', id).eq('category_id', c.id);
                          if (error) return toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
                          setAssignedCatIds(assignedCatIds.filter((x) => x !== c.id));
                        }
                      }}
                    />
                    <span className="text-sm">{c.names?.de ?? c.slug}</span>
                    <span className="text-xs font-mono text-muted-foreground ml-auto">{c.slug}</span>
                  </label>
                );
              })}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="verwendung">
          <Card><CardContent className="pt-6 space-y-2">
            <div className="text-sm text-muted-foreground flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4" /> Snapshots zeigen, wo dieser Artikel in Angeboten und Aufträgen verwendet wurde.
            </div>
            {usage.length === 0 && <p className="text-sm text-muted-foreground">Noch nicht in Angeboten oder Aufträgen verwendet.</p>}
            {usage.map((u: any) => (
              <div key={u.id} className="text-xs border-b py-2 flex justify-between items-center">
                <div>
                  <Badge variant="secondary" className="mr-2">{u.used_in_type}</Badge>
                  <span className="font-mono">{u.used_in_id ? String(u.used_in_id).slice(0, 8) : '— (Entwurf)'}</span>
                </div>
                <span className="text-muted-foreground">{new Date(u.created_at).toLocaleString('de-DE')}</span>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="verlauf">
          <Card><CardContent className="pt-6 space-y-2">
            {changeLog.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>}
            {changeLog.map((l) => (
              <div key={l.id} className="text-xs border-b py-2 flex justify-between">
                <span>{l.action} · {l.field_name ?? '—'}</span>
                <span className="text-muted-foreground">{new Date(l.performed_at).toLocaleString('de-DE')}</span>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
