import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const password = url.searchParams.get('pw') ?? '';
    if (!token) return json({ error: 'token required' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const ipRaw = req.headers.get('cf-connecting-ip')
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? '';
    const ipHash = ipRaw ? await sha256(`${ipRaw}|catalog-share`) : null;
    const ua = req.headers.get('user-agent')?.slice(0, 300) ?? null;

    const logAccess = (linkId: string, outcome: string) => {
      // fire-and-forget
      sb.from('catalog_share_access_log')
        .insert({ link_id: linkId, ip_hash: ipHash, user_agent: ua, outcome })
        .then(() => {});
    };

    const { data: link, error: linkErr } = await sb
      .from('catalog_share_links')
      .select('id, item_id, language_code, country_id, expires_at, revoked_at, view_count, password_hash, max_views')
      .eq('token', token)
      .maybeSingle();
    if (linkErr || !link) return json({ error: 'not_found' }, 404);
    if (link.revoked_at) { logAccess(link.id, 'revoked'); return json({ error: 'revoked' }, 410); }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      logAccess(link.id, 'expired'); return json({ error: 'expired' }, 410);
    }
    if (link.max_views != null && (link.view_count ?? 0) >= link.max_views) {
      logAccess(link.id, 'max_views'); return json({ error: 'max_views' }, 410);
    }
    if (link.password_hash) {
      if (!password) { logAccess(link.id, 'password_required'); return json({ error: 'password_required' }, 401); }
      const attempt = await sha256(password);
      if (attempt !== link.password_hash) {
        logAccess(link.id, 'password_wrong');
        return json({ error: 'password_wrong' }, 401);
      }
    }

    const [{ data: item }, { data: desc }, { data: images }, { data: price }] = await Promise.all([
      sb.from('catalog_items').select('id, sku, name, brand, model, status').eq('id', link.item_id).maybeSingle(),
      sb.from('catalog_item_descriptions').select('short_text, long_text, technical_text, warranty_text, scope_text')
        .eq('item_id', link.item_id).eq('language_code', link.language_code).maybeSingle(),
      sb.from('catalog_item_images').select('storage_path, is_primary, sort_order')
        .eq('item_id', link.item_id).order('sort_order', { ascending: true }),
      link.country_id
        ? sb.from('catalog_item_prices').select('uvp_net, uvp_gross, sale_net, sale_gross, tax_rate, currency_id')
            .eq('item_id', link.item_id).eq('country_id', link.country_id).eq('price_status', 'freigegeben').maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!item || !['freigegeben', 'aktiv'].includes(item.status)) {
      logAccess(link.id, 'not_available');
      return json({ error: 'not_available' }, 404);
    }

    // signierte URLs
    const paths = (images ?? []).map((i: any) => i.storage_path).filter(Boolean);
    let signedImages: string[] = [];
    if (paths.length) {
      const { data: signed } = await sb.storage.from('catalog-media').createSignedUrls(paths, 900);
      signedImages = (signed ?? []).map((s: any) => s.signedUrl).filter(Boolean);
    }

    // View-Count erhöhen (fire and forget) + Zugriff loggen
    sb.from('catalog_share_links')
      .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq('id', link.id).then(() => {});
    logAccess(link.id, 'ok');

    return json({
      item: { sku: item.sku, name: item.name, brand: item.brand, model: item.model },
      description: desc ?? null,
      images: signedImages,
      price: price ?? null,
      language: link.language_code,
    });
  } catch (e: any) {
    console.error('catalog-share-resolve error', e);
    return json({ error: 'internal', details: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
