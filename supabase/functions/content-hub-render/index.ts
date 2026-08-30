// ALIX CONTENT HUB — EDIT ONCE · CHECK ONCE · APPROVE ONCE · PUBLISH EVERYWHERE
// Rendert aus dem Product Master (ph_*) alle Kanalausgaben und veröffentlicht sie revisionssicher.
// Aktionen: preview | publish | check
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

export const CH_CHANNELS = ['website', 'offer', 'datasheet', 'comparison', 'portal', 'social'] as const;
type Channel = typeof CH_CHANNELS[number];

// Regulatorisch relevante Felder — Änderung erzwingt erneute Compliance-Prüfung
const CRITICAL_FIELDS = [
  'wavelengths', 'power', 'fluence', 'pulse_duration', 'frequency', 'spot_sizes',
  'laser_class', 'intended_use', 'manufacturer', 'ce_status', 'mdr_status', 'iso_status', 'standards',
];

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadBundle(sb: any, productId: string) {
  const [p, prices, compliance, marketing, seo, variants, scope, attrs, values, media, docs] = await Promise.all([
    sb.from('ph_products').select('*').eq('id', productId).maybeSingle(),
    sb.from('ph_prices').select('*').eq('product_id', productId).is('variant_id', null).maybeSingle(),
    sb.from('ph_compliance').select('*').eq('product_id', productId).maybeSingle(),
    sb.from('ph_marketing').select('*').eq('product_id', productId).maybeSingle(),
    sb.from('ph_seo').select('*').eq('product_id', productId).maybeSingle(),
    sb.from('ph_variants').select('*').eq('product_id', productId).order('sort_order'),
    sb.from('ph_scope_items').select('*').eq('product_id', productId).order('sort_order'),
    sb.from('ph_attributes').select('*').eq('active', true).order('sort_order'),
    sb.from('ph_attribute_values').select('*').eq('product_id', productId).is('variant_id', null),
    sb.from('ph_media').select('*').eq('product_id', productId).order('sort_order'),
    sb.from('ph_documents').select('*').eq('product_id', productId),
  ]);
  return {
    product: p.data, prices: prices.data, compliance: compliance.data, marketing: marketing.data,
    seo: seo.data, variants: variants.data ?? [], scope: scope.data ?? [], attributes: attrs.data ?? [],
    attrValues: values.data ?? [], media: media.data ?? [], documents: docs.data ?? [],
  };
}

function techBlock(b: any) {
  const p = b.product ?? {};
  const base: Record<string, unknown> = {
    Wellenlängen: p.wavelengths, Leistung: p.power, Fluence: p.fluence, Pulsdauer: p.pulse_duration,
    Frequenz: p.frequency, Spotgrößen: p.spot_sizes, Kühlung: p.cooling, Laserklasse: p.laser_class,
  };
  for (const a of b.attributes) {
    const v = b.attrValues.find((x: any) => x.attribute_id === a.id);
    if (!v) continue;
    const val = v.value_text ?? v.value_number ?? (v.value_list?.length ? v.value_list.join(', ') : null);
    if (val === null || val === undefined || val === '') continue;
    base[a.label + (a.unit ? ` (${a.unit})` : '')] = val;
  }
  return Object.fromEntries(Object.entries(base).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

/** Kanalausgabe — immer aus demselben Datensatz. Keine kanalspezifische Datenhaltung. */
function render(channel: Channel, b: any) {
  const p = b.product ?? {};
  const tech = techBlock(b);
  const scope = b.scope.map((s: any) => ({ title: s.title, quantity: s.quantity, unit: s.unit, mandatory: s.mandatory }));
  const gallery = b.media.filter((m: any) => m.media_type === 'image').map((m: any) => ({ url: m.url, alt: m.alt_text ?? m.title }));
  const price = b.prices ?? {};

  switch (channel) {
    case 'website':
      return {
        alix_product_id: p.alix_product_id, name: p.name, model: p.model, slug: b.seo?.url_slug ?? p.slug,
        short_description: p.short_description, long_description: p.long_description,
        features: p.features, applications: p.applications, categories: p.categories,
        tech, hero_image_url: p.hero_image_url, gallery,
        seo: {
          title: b.seo?.seo_title ?? p.seo_title, description: b.seo?.meta_description ?? p.seo_description,
          h1: b.seo?.h1 ?? p.name, canonical: b.seo?.canonical_url, noindex: b.seo?.noindex ?? false,
          og_title: b.seo?.og_title, og_image: b.seo?.og_image, faq: b.seo?.faq ?? [],
        },
        price_from: price.price_from ?? null,
        documents: b.documents.filter((d: any) => d.visibility === 'website').map((d: any) => ({ title: d.title, url: d.url, type: d.doc_type })),
      };
    case 'offer':
      return {
        position_title: [p.name, p.model].filter(Boolean).join(' · '),
        position_text: p.short_description,
        tech, scope,
        sale_price_net: price.sale_price_net ?? null, rrp_net: price.rrp_net ?? null,
        vat_rate: price.vat_rate ?? null, delivery_time: price.delivery_time ?? null,
        warranty: price.warranty ?? null,
        included: {
          training: !!price.training_included, briefing: !!price.briefing_included,
          delivery: !!price.delivery_included, installation: !!price.installation_included,
        },
      };
    case 'datasheet':
      return {
        title: p.name, model: p.model, sku: p.sku, brand: p.brand, manufacturer: p.manufacturer,
        intended_use: p.intended_use, tech, scope,
        applications: p.applications ?? [], features: p.features ?? [],
        compliance: {
          ce_status: b.compliance?.ce_status ?? p.ce_status, mdr_status: b.compliance?.mdr_status ?? p.mdr_status,
          laser_class: b.compliance?.laser_class ?? p.laser_class, risk_class: b.compliance?.risk_class,
          iso_13485: b.compliance?.iso_13485, standards: p.standards ?? [],
          country_of_origin: b.compliance?.country_of_origin,
        },
        hero_image_url: p.hero_image_url,
        warranty: price.warranty ?? null, delivery_time: price.delivery_time ?? null,
        stand: new Date().toISOString().slice(0, 10),
      };
    case 'comparison':
      return {
        name: p.name, model: p.model, hero_image_url: p.hero_image_url,
        values: {
          ...tech,
          Garantie: price.warranty ?? null, Lieferzeit: price.delivery_time ?? null,
          Preis: price.sale_price_net ?? price.rrp_net ?? null,
        },
      };
    case 'portal':
      return {
        name: p.name, model: p.model, hero_image_url: p.hero_image_url,
        applications: p.applications ?? [], short_description: p.short_description,
        warranty: price.warranty ?? null,
        included: scope,
        documents: b.documents.filter((d: any) => d.visibility !== 'internal').map((d: any) => ({ title: d.title, url: d.url, type: d.doc_type })),
      };
    case 'social':
      return {
        headline: b.marketing?.headline ?? p.name,
        claim: b.marketing?.slogan ?? null,
        usps: b.marketing?.usps ?? [],
        target_group: b.marketing?.target_group ?? null,
        cta: b.marketing?.cta ?? null,
        short_text: b.marketing?.short_text ?? p.short_description,
        image: p.hero_image_url,
        facts: { Wellenlängen: p.wavelengths, Leistung: p.power, Laserklasse: p.laser_class },
      };
  }
}

function complianceRequired(b: any) {
  const p = b.product ?? {};
  const c = b.compliance ?? {};
  return !!(c.ce_relevant || c.mdr_relevant || c.is_medical_device || c.udi_required || c.made_in_germany_approved ||
    c.iso_13485 || p.laser_class || p.intended_use || p.ce_status || p.mdr_status);
}

function gate(b: any) {
  const p = b.product ?? {};
  const c = b.compliance ?? {};
  const checks = [
    { label: 'Pflichtfelder (Name, SKU, Kategorie)', ok: !!p.name && !!p.sku && (p.categories ?? []).length > 0 },
    { label: 'Preis vorhanden', ok: !!(b.prices?.sale_price_net || b.prices?.rrp_net) },
    { label: 'Hauptbild vorhanden', ok: !!p.hero_image_url || b.media.length > 0 },
    { label: 'Technische Daten vorhanden', ok: Object.keys(techBlock(b)).length > 0 },
    { label: 'SEO vorhanden', ok: !!(b.seo?.seo_title || p.seo_title) && !!(b.seo?.meta_description || p.seo_description) },
    { label: 'Marketing freigegeben', ok: !!b.marketing?.approved },
  ];
  if (complianceRequired(b)) {
    checks.push({ label: 'Compliance freigegeben (QM / Regulatory)', ok: c.approval_status === 'approved' });
  }
  return checks;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401);
    const userId = (claims.claims as any).sub as string;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'preview');
    const productIds: string[] = Array.isArray(body.product_ids)
      ? body.product_ids.filter((x: unknown) => typeof x === 'string').slice(0, 100)
      : (typeof body.product_id === 'string' ? [body.product_id] : []);
    if (!productIds.length) return json({ error: 'product_id(s) erforderlich' }, 400);
    const channels: Channel[] = Array.isArray(body.channels) && body.channels.length
      ? body.channels.filter((c: string) => (CH_CHANNELS as readonly string[]).includes(c))
      : [...CH_CHANNELS];

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Berechtigung serverseitig prüfen (Zero Trust)
    const { data: canEdit } = await userClient.rpc('ph_can_edit');
    if (action !== 'preview' && action !== 'check' && !canEdit) return json({ error: 'forbidden' }, 403);

    const results: any[] = [];

    for (const productId of productIds) {
      const b = await loadBundle(sb, productId);
      if (!b.product) { results.push({ product_id: productId, error: 'not_found' }); continue; }

      const rendered: Record<string, unknown> = {};
      for (const c of channels) rendered[c] = render(c, b);

      const hash = await sha256(JSON.stringify({
        p: b.product, pr: b.prices, c: b.compliance, m: b.marketing, s: b.seo,
        sc: b.scope, av: b.attrValues, md: b.media.map((x: any) => x.url),
      }));
      const checks = gate(b);
      const blocked = checks.filter(c => !c.ok);

      if (action === 'preview' || action === 'check') {
        const { data: state } = await sb.from('ch_channel_state').select('*').eq('product_id', productId);
        results.push({
          product_id: productId, name: b.product.name, hash, checks, blocked: blocked.map(c => c.label),
          compliance_required: complianceRequired(b),
          rendered: action === 'preview' ? rendered : undefined,
          channel_state: state ?? [],
          drift: (state ?? []).filter((s: any) => s.published_hash && s.published_hash !== hash).map((s: any) => s.channel),
        });
        continue;
      }

      // action === 'publish'
      if (blocked.length) {
        results.push({ product_id: productId, name: b.product.name, published: false, blocked: blocked.map(c => c.label) });
        continue;
      }

      const { data: last } = await sb.from('ch_releases')
        .select('version, content_hash').eq('product_id', productId).order('version', { ascending: false }).limit(1).maybeSingle();

      let version = last?.version ?? 0;
      if (!last || last.content_hash !== hash) {
        version = (last?.version ?? 0) + 1;
        const { error: relErr } = await sb.from('ch_releases').insert({
          product_id: productId, version, content_hash: hash,
          snapshot: { product: b.product, prices: b.prices, compliance: b.compliance, marketing: b.marketing, seo: b.seo, scope: b.scope, rendered },
          status: 'approved',
          compliance_required: complianceRequired(b),
          compliance_approved_by: b.compliance?.approved_by ?? null,
          compliance_approved_at: b.compliance?.approved_at ?? null,
          approved_by: userId,
          note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
        });
        if (relErr) throw relErr;
      }

      const now = new Date().toISOString();
      for (const c of channels) {
        await sb.from('ch_channel_state').upsert({
          product_id: productId, channel: c, published_version: version, published_at: now,
          published_hash: hash, is_stale: false, last_error: null, payload: rendered[c] as any,
        }, { onConflict: 'product_id,channel' });
      }

      if (channels.includes('website')) {
        await sb.from('ph_products').update({ status: 'published', updated_at: now }).eq('id', productId);
        await sb.from('ph_sync_log').insert({
          channel_code: 'de', direction: 'outbound', operation: 'content_hub_publish',
          product_id: productId, status: 'success',
          message: `Content Hub Release v${version} veröffentlicht (${channels.join(', ')})`,
          payload: { version, hash, channels },
        });
      }

      results.push({ product_id: productId, name: b.product.name, published: true, version, hash, channels });
    }

    return json({ success: true, action, results });
  } catch (e) {
    return json({ error: (e as Error).message ?? 'error' }, 500);
  }
});
