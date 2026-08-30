import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Importiert alle Geräte/Artikel aus der Website-App alix-lasers.de (com_devices)
// in den ALIX PRODUCT MASTER (ph_products + ph_media/ph_seo/ph_marketing)
// und ordnet sie der Kategorie "Alix Lasers EU" zu.

const SRC_URL = 'https://okvlqyhxdjdxitndmyuc.supabase.co/rest/v1/com_devices';
const SRC_KEY = 'sb_publishable_ZzDCYi_yY1lphu3R97aqQw_7yOKy0x-';
const TARGET_CATEGORY = 'Alix Lasers EU';

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const lines = (t?: string | null) =>
  String(t ?? '').split('\n').map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return j({ error: 'Unauthorized' }, 401);

    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: authErr } = await authed.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authErr || !claims?.claims) return j({ error: 'Unauthorized' }, 401);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1) Quelle laden
    const res = await fetch(`${SRC_URL}?select=*&order=sort_order.asc&limit=1000`, {
      headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}` },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Quelle nicht erreichbar [${res.status}]: ${body}`);
      return j({ error: 'Quelle nicht erreichbar', status: res.status, details: body }, res.status);
    }
    const devices: any[] = await res.json();

    let created = 0, updated = 0, media = 0;
    const errors: string[] = [];

    for (const d of devices) {
      try {
        const slug = String(d.slug ?? '').trim();
        if (!slug) continue;
        const raw = d.raw ?? {};
        const name = d.h1 || raw.source_name || slug;
        const feats = lines(d.functions);

        const payload: Record<string, unknown> = {
          name,
          internal_name: name,
          slug,
          source_product_id: slug,
          source_name: raw.source_name ?? name,
          brand: 'Alix Lasers',
          status: 'aktiv',
          lifecycle_status: 'aktiv',
          product_group: d.subcategory ?? raw.category ?? null,
          categories: [TARGET_CATEGORY],
          applications: Array.isArray(d.application_categories) ? d.application_categories : [],
          short_description: d.brief ?? null,
          long_description: d.body_markdown ?? null,
          features: feats.length ? feats : null,
          tech_specs: d.specs ?? null,
          hero_image_url: d.hero_image ?? null,
          seo_title: d.title ?? null,
          seo_description: d.description ?? null,
          sort_order: d.sort_order ?? 0,
          featured: !!d.featured,
          active_de: d.active_de ?? true,
          active_com: d.active_com ?? true,
          manufacturer: 'Alix Lasers',
          notes: d.source_url ? `Import von ${d.source_url}` : null,
          updated_at: new Date().toISOString(),
        };

        const { data: existing } = await db.from('ph_products').select('id').eq('slug', slug).maybeSingle();
        let productId: string;
        if (existing?.id) {
          const { error } = await db.from('ph_products').update(payload).eq('id', existing.id);
          if (error) throw error;
          productId = existing.id;
          updated++;
        } else {
          const { data: ins, error } = await db.from('ph_products').insert(payload).select('id').single();
          if (error) throw error;
          productId = ins.id;
          created++;
        }

        // 2) Bilder
        const imgs: string[] = Array.from(new Set([
          ...(Array.isArray(d.gallery) ? d.gallery : []),
          ...(Array.isArray(d.images) ? d.images : []),
        ].filter((u: unknown) => typeof u === 'string' && u)));
        if (imgs.length) {
          await db.from('ph_media').delete().eq('product_id', productId).eq('source_ref', 'alix-lasers-de');
          const rows = imgs.map((url, i) => ({
            product_id: productId,
            url,
            kind: 'image',
            media_type: 'image',
            title: name,
            alt_text: name,
            sort_order: i,
            is_primary: i === 0,
            source_ref: 'alix-lasers-de',
          }));
          const { error } = await db.from('ph_media').insert(rows);
          if (error) throw error;
          media += rows.length;
        }

        // 3) SEO
        const seo = {
          product_id: productId,
          seo_title: d.title ?? null,
          meta_description: d.description ?? null,
          url_slug: slug,
          h1: d.h1 ?? name,
          canonical_url: d.source_url ?? null,
          og_title: d.title ?? name,
          og_description: d.description ?? null,
          og_image: d.hero_image ?? null,
          updated_at: new Date().toISOString(),
        };
        const { data: seoRow } = await db.from('ph_seo').select('id').eq('product_id', productId).maybeSingle();
        if (seoRow?.id) await db.from('ph_seo').update(seo).eq('id', seoRow.id);
        else await db.from('ph_seo').insert(seo);

        // 4) Marketing
        const mk = {
          product_id: productId,
          headline: d.h1 ?? name,
          short_text: d.brief ?? null,
          long_text: d.body_markdown ?? null,
          usps: feats.slice(0, 12),
          target_group: raw.target_group ?? null,
          main_applications: Array.isArray(d.application_categories) ? d.application_categories : [],
          updated_at: new Date().toISOString(),
        };
        const { data: mkRow } = await db.from('ph_marketing').select('id').eq('product_id', productId).maybeSingle();
        if (mkRow?.id) await db.from('ph_marketing').update(mk).eq('id', mkRow.id);
        else await db.from('ph_marketing').insert(mk);
      } catch (e) {
        errors.push(`${d.slug}: ${(e as Error).message}`);
      }
    }

    return j({ ok: true, source_total: devices.length, created, updated, media, errors });
  } catch (e) {
    console.error('import-alix-lasers-de failed', e);
    return j({ error: (e as Error).message }, 500);
  }
});
