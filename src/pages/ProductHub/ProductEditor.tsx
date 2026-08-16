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
import { Cpu, Save, Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  PH_APPLICATIONS, PH_CHANNELS, PH_CRITICAL_FIELDS, PH_STATUS, phLabel, PH_ACTIVE_FIELD,
} from '@/lib/producthub/config';
import { phGetProduct, phUpdateProduct, phChannelRows, phUpsertChannel } from '@/lib/producthub/api';
import { useAuth } from '@/hooks/useAuth';

const db = supabase as any;

function Field({ k, form, set, disabled, area }: any) {
  const critical = PH_CRITICAL_FIELDS.includes(k);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        {phLabel(k)}
        {critical && <ShieldAlert className="w-3 h-3 text-amber-500" title="Kritisches Feld – Änderung wird protokolliert" />}
      </Label>
      {area
        ? <Textarea rows={5} value={form[k] ?? ''} disabled={disabled} onChange={e => set(k, e.target.value)} />
        : <Input value={form[k] ?? ''} disabled={disabled} onChange={e => set(k, e.target.value)} />}
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

  const load = async () => {
    if (!id) return;
    const p = await phGetProduct(id);
    setForm(p);
    const [h, m, d, c] = await Promise.all([
      db.from('ph_field_history').select('*').eq('product_id', id).order('created_at', { ascending: false }).limit(200),
      db.from('ph_media').select('*').eq('product_id', id).order('sort_order'),
      db.from('ph_documents').select('*').eq('product_id', id),
      phChannelRows(id),
    ]);
    setHistory(h.data || []); setMedia(m.data || []); setDocs(d.data || []); setChannels(c);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!id || !form) return;
    setSaving(true);
    try {
      const { id: _i, created_at, updated_at, ...patch } = form;
      await phUpdateProduct(id, patch);
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
            {canWrite && <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Speichern</Button>}
          </div>
        } />

      <Tabs defaultValue="allgemein">
        <TabsList className="flex-wrap h-auto">
          {['allgemein', 'technik', 'anwendungen', 'smartki', 'medien', 'dokumente', 'regulatory', 'webseiten', 'seo', 'historie'].map(t => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === 'smartki' ? 'Smart KI' : t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="allgemein">
          <Card><CardContent className="p-4 grid md:grid-cols-3 gap-4">
            {['name', 'internal_name', 'model', 'sku', 'slug', 'alix_product_id', 'product_group'].map(k => (
              <Field key={k} k={k} form={form} set={set} disabled={!canWrite} />
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
            <div className="md:col-span-3"><Field k="short_description" form={form} set={set} disabled={!canWrite} area /></div>
            <div className="md:col-span-3"><Field k="long_description" form={form} set={set} disabled={!canWrite} area /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="technik">
          <Card><CardContent className="p-4 grid md:grid-cols-3 gap-4">
            {['wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes', 'cooling', 'laser_class'].map(k => (
              <Field key={k} k={k} form={form} set={set} disabled={!canWrite} />
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="anwendungen">
          <Card><CardContent className="p-4 flex flex-wrap gap-2">
            {PH_APPLICATIONS.map(a => (
              <Badge key={a} variant={(form.applications || []).includes(a) ? 'default' : 'outline'}
                className="cursor-pointer" onClick={() => canWrite && toggleApp(a)}>{a}</Badge>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="smartki">
          <Card><CardContent className="p-4 space-y-2">
            <Label className="text-xs">Smart-KI-Funktionen (JSON)</Label>
            <Textarea rows={10} disabled={!canWrite} value={JSON.stringify(form.smart_ki ?? {}, null, 2)}
              onChange={e => { try { set('smart_ki', JSON.parse(e.target.value || '{}')); } catch { /* live typing */ } }} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="medien">
          <Card><CardContent className="p-4 space-y-3">
            <Field k="hero_image_url" form={form} set={set} disabled={!canWrite} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {media.map(m => (
                <div key={m.id} className="border border-border rounded-md p-2 space-y-1">
                  {m.media_type === 'image'
                    ? <img src={m.url} alt={m.alt_text || m.title || ''} loading="lazy" className="w-full h-24 object-cover rounded" />
                    : <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">Video</div>}
                  <div className="text-[11px] truncate">{m.title || m.kind}</div>
                  <Badge variant="outline" className="text-[10px]">{m.kind}</Badge>
                </div>
              ))}
              {media.length === 0 && <div className="text-sm text-muted-foreground">Keine Medien.</div>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="dokumente">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Titel</TableHead><TableHead>Typ</TableHead><TableHead>Sichtbarkeit</TableHead><TableHead>Version</TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.map(d => (
                  <TableRow key={d.id}><TableCell>{d.url ? <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{d.title}</a> : d.title}</TableCell>
                    <TableCell>{d.doc_type}</TableCell><TableCell><Badge variant="outline">{d.visibility}</Badge></TableCell><TableCell>{d.version || '—'}</TableCell></TableRow>
                ))}
                {docs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Keine Dokumente.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="regulatory">
          <Card><CardContent className="p-4 grid md:grid-cols-3 gap-4">
            {['mdr_status', 'ce_status', 'iso_status', 'intended_use', 'manufacturer', 'production_site'].map(k => (
              <Field key={k} k={k} form={form} set={set} disabled={!canWrite} area={k === 'intended_use'} />
            ))}
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">Normen <ShieldAlert className="w-3 h-3 text-amber-500" /></Label>
              <Input value={(form.standards || []).join(', ')} disabled={!canWrite}
                onChange={e => set('standards', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
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
          <Card><CardContent className="p-4 grid md:grid-cols-2 gap-4">
            <Field k="seo_title" form={form} set={set} disabled={!canWrite} />
            <Field k="slug" form={form} set={set} disabled={!canWrite} />
            <div className="md:col-span-2"><Field k="seo_description" form={form} set={set} disabled={!canWrite} area /></div>
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
