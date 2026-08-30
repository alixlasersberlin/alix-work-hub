import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Globe, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PH_CHANNELS, PH_ACTIVE_FIELD, phLabel } from '@/lib/producthub/config';
import { toast } from 'sonner';

const db = supabase as any;

interface Props {
  productId: string;
  /** falls schon geladen – spart einen Request */
  product?: any;
  variant?: 'button' | 'icon';
}

const TECH_FIELDS = [
  'wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes',
  'cooling', 'laser_class', 'intended_use', 'manufacturer', 'production_site',
];
const REG_FIELDS = ['ce_status', 'mdr_status', 'iso_status', 'standards'];

const val = (v: any) => {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function SpecTable({ fields, data }: { fields: string[]; data: any }) {
  const rows = fields.map(f => [phLabel(f), val(data?.[f])]).filter(r => r[1]);
  if (!rows.length) return <p className="text-sm text-zinc-400">Keine Angaben hinterlegt.</p>;
  return (
    <dl className="divide-y divide-zinc-200">
      {rows.map(([k, v]) => (
        <div key={k as string} className="grid grid-cols-[minmax(140px,32%)_1fr] gap-4 py-2">
          <dt className="text-sm text-zinc-500">{k}</dt>
          <dd className="text-sm text-zinc-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-zinc-200 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function WebPreviewButton({ productId, product, variant = 'button' }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<any>(null);
  const [channel, setChannel] = useState<string>('de');

  const load = async () => {
    setBusy(true);
    try {
      const [p, m, d] = await Promise.all([
        product ? Promise.resolve({ data: product }) : db.from('ph_products').select('*').eq('id', productId).maybeSingle(),
        db.from('ph_media').select('*').eq('product_id', productId).order('sort_order'),
        db.from('ph_documents').select('*').eq('product_id', productId),
      ]);
      setData({ product: (p as any).data, media: m.data || [], docs: d.data || [] });
    } catch (e: any) {
      toast.error(e.message || 'Vorschau konnte nicht geladen werden');
    } finally {
      setBusy(false);
    }
  };

  const openDialog = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen(true);
    setData(null);
    load();
  };

  const p = data?.product;
  const media: any[] = data?.media || [];
  const docs: any[] = (data?.docs || []).filter((d: any) => !d.visibility || ['website', 'customer'].includes(d.visibility));
  const hero = p?.hero_image_url || media.find(m => m.kind === 'hero')?.url || media[0]?.url;
  const gallery = media.filter(m => m.url && m.url !== hero).slice(0, 8);
  const features: string[] = Array.isArray(p?.features) ? p.features : [];
  const apps: string[] = Array.isArray(p?.applications) ? p.applications : [];
  const activeHere = p ? p[PH_ACTIVE_FIELD[channel]] : false;

  return (
    <>
      {variant === 'icon' ? (
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Webseiten-Vorschau" onClick={openDialog}>
          <Globe className="w-4 h-4 text-sky-400" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Globe className="w-4 h-4 mr-1" /> Webseiten-Vorschau
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-0 gap-0" onClick={e => e.stopPropagation()}>
          <DialogHeader className="px-5 py-3 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-base">Webseiten-Vorschau</DialogTitle>
            <div className="flex items-center gap-2 pr-6">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={channel}
                onChange={e => setChannel(e.target.value)}
              >
                {PH_CHANNELS.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${activeHere ? 'border-emerald-500/40 text-emerald-500' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                {activeHere ? 'aktiv' : 'inaktiv'}
              </span>
            </div>
          </DialogHeader>

          <ScrollArea className="h-[75vh] bg-zinc-100">
            {busy || !p ? (
              <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
            ) : (
              <div className="mx-auto my-6 w-full max-w-3xl bg-white text-zinc-900 shadow-sm">
                {/* neutraler Website-Header */}
                <div className="px-8 py-4 border-b border-zinc-200 flex items-center justify-between">
                  <span className="text-sm font-medium tracking-[0.2em] text-zinc-800">
                    {PH_CHANNELS.find(c => c.code === channel)?.label}
                  </span>
                  <span className="text-[11px] uppercase tracking-widest text-zinc-400">Produktseite</span>
                </div>

                <article className="px-8 py-8 space-y-8">
                  <header className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                      {[p.product_group, p.model].filter(Boolean).join(' · ') || 'Gerät'}
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight">{p.name}</h1>
                    {p.short_description && <p className="text-base leading-relaxed text-zinc-600">{p.short_description}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {apps.map(a => (
                        <span key={a} className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">{a}</span>
                      ))}
                    </div>
                  </header>

                  {hero && (
                    <img src={hero} alt={p.name} loading="lazy" className="w-full rounded-md border border-zinc-200 object-cover max-h-[380px]" />
                  )}

                  {p.long_description && (
                    <Section title="Beschreibung">
                      <p className="text-sm leading-7 text-zinc-700 whitespace-pre-line">{p.long_description}</p>
                    </Section>
                  )}

                  {features.length > 0 && (
                    <Section title="Highlights">
                      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                        {features.map((f, i) => (
                          <li key={i} className="text-sm text-zinc-700 flex gap-2">
                            <span className="text-zinc-300">—</span>{typeof f === 'string' ? f : JSON.stringify(f)}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  <Section title="Technische Daten">
                    <SpecTable fields={TECH_FIELDS} data={p} />
                  </Section>

                  {p.tech_specs && Object.keys(p.tech_specs || {}).length > 0 && (
                    <Section title="Weitere Spezifikationen">
                      <dl className="divide-y divide-zinc-200">
                        {Object.entries(p.tech_specs as Record<string, any>).map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[minmax(140px,32%)_1fr] gap-4 py-2">
                            <dt className="text-sm text-zinc-500">{k}</dt>
                            <dd className="text-sm text-zinc-900">{val(v) ?? '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </Section>
                  )}

                  {p.smart_ki && (
                    <Section title="Smart KI">
                      <p className="text-sm leading-7 text-zinc-700 whitespace-pre-line">
                        {typeof p.smart_ki === 'string' ? p.smart_ki : JSON.stringify(p.smart_ki, null, 2)}
                      </p>
                    </Section>
                  )}

                  <Section title="Regulatorik">
                    <SpecTable fields={REG_FIELDS} data={p} />
                  </Section>

                  {gallery.length > 0 && (
                    <Section title="Medien">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {gallery.map(m => (
                          <figure key={m.id} className="space-y-1">
                            <img src={m.url} alt={m.alt_text || p.name} loading="lazy" className="w-full h-24 object-cover rounded border border-zinc-200" />
                            <figcaption className="text-[10px] text-zinc-400 truncate">{m.kind || 'Bild'}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </Section>
                  )}

                  {docs.length > 0 && (
                    <Section title="Dokumente">
                      <ul className="space-y-1.5">
                        {docs.map(d => (
                          <li key={d.id} className="text-sm text-zinc-700 flex justify-between gap-4 border-b border-zinc-100 pb-1.5">
                            <span className="truncate">{d.title || d.file_name || d.doc_type}</span>
                            <span className="text-xs text-zinc-400 shrink-0">{d.doc_type}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  <Section title="SEO-Vorschau">
                    <div className="rounded border border-zinc-200 p-3 space-y-1">
                      <p className="text-[11px] text-zinc-500">
                        {PH_CHANNELS.find(c => c.code === channel)?.label}/{p.slug || ''}
                      </p>
                      <p className="text-base text-blue-800">{p.seo_title || p.name}</p>
                      <p className="text-sm text-zinc-600">{p.seo_description || p.short_description || '—'}</p>
                    </div>
                  </Section>

                  <Section title="Stammdaten">
                    <SpecTable
                      fields={['alix_product_id', 'sku', 'slug', 'internal_name', 'status', 'product_group', 'categories', 'sort_order']}
                      data={p}
                    />
                  </Section>
                </article>

                <div className="px-8 py-4 border-t border-zinc-200 text-[11px] text-zinc-400">
                  Vorschau – neutrales Layout, keine Live-Veröffentlichung.
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
