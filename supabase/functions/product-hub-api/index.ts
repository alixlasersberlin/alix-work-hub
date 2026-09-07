// ALIXWORK PRODUCT HUB – öffentliche, serverseitige Lese-API für die Webseiten (COM/DE).
// Auth über Header x-api-key = PRODUCT_HUB_API_KEY. Keine Secrets im Frontend.
// Routen:
//   GET /product-hub-api/products?channel=de
//   GET /product-hub-api/products/{alix_product_id}
//   GET /product-hub-api/products/{alix_product_id}/media
//   GET /product-hub-api/products/{alix_product_id}/documents
//   GET /product-hub-api/content?channel=website          → alle freigegebenen Content-Hub-Releases
//   GET /product-hub-api/products/{alix_product_id}/content?channel=website
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const PUBLIC_FIELDS =
  "alix_product_id,name,model,sku,slug,status,product_group,categories,applications,short_description,long_description,features,smart_ki,tech_specs,wavelengths,power,fluence,pulse_duration,frequency,spot_sizes,cooling,laser_class,intended_use,manufacturer,ce_status,mdr_status,iso_status,standards,hero_image_url,seo_title,seo_description,sort_order,featured,active_de,active_com,active_at,active_usa,active_dubai,updated_at,price_public,price_uvp,vk_min_mode,vk_min_value,vk_max_mode,vk_max_value,promo_active,promo_name,price_countries";

const PRICE_FIELDS = ["price_uvp", "vk_min_mode", "vk_min_value", "vk_max_mode", "vk_max_value", "promo_active", "promo_name"];

/** Kanal -> Länderschlüssel in price_countries */
const CHANNEL_COUNTRY: Record<string, string> = {
  de: "de", com: "de", at: "at", usa: "usa", vietnam: "vietnam", dubai: "dubai", ae: "dubai", uae: "dubai",
};

/**
 * Preise sind standardmäßig nicht öffentlich.
 * Länderpreise werden nur ausgeliefert, wenn das jeweilige Land freigeschaltet ist;
 * bei gesetztem Kanal wird auf dessen Land reduziert. Brutto-/Nettowerte werden mitgeliefert.
 */
function stripPrices<T extends Record<string, unknown>>(row: T, channel?: string | null): T {
  if (!row) return row;
  const out: Record<string, unknown> = { ...row };

  const all = (row.price_countries && typeof row.price_countries === "object")
    ? row.price_countries as Record<string, any>
    : {};
  const wanted = channel ? [CHANNEL_COUNTRY[channel]].filter(Boolean) : Object.keys(all);
  const pub: Record<string, unknown> = {};
  for (const code of wanted) {
    const p = all[code];
    if (!p || p.public !== true) continue;
    const vat = Number(p.vat_rate || 0);
    const f = 1 + vat / 100;
    const conv = (v: unknown) => {
      const n = Number(v || 0);
      if (!n) return null;
      return p.input_mode === "gross"
        ? { gross: n, net: +(n / f).toFixed(2) }
        : { net: n, gross: +(n * f).toFixed(2) };
    };
    const uvp = Number(p.uvp || 0);
    const eff = (mode: string, val: unknown) =>
      mode === "percent" ? uvp * (1 + Number(val || 0) / 100) : Number(val || 0);
    pub[code] = {
      currency: p.currency, vat_rate: vat,
      uvp: conv(p.uvp),
      vk_min: conv(eff(p.vk_min_mode, p.vk_min_value)),
      vk_max: conv(eff(p.vk_max_mode, p.vk_max_value)),
      promo_active: p.promo_active === true,
      promo_name: p.promo_active === true ? (p.promo_name || null) : null,
    };
  }
  out.prices = pub;
  delete out.price_countries;

  if (row.price_public !== true) {
    for (const f of PRICE_FIELDS) delete out[f];
  }
  return out as T;
}

/**
 * UAE-Freigabe (alix-lasers.ae):
 * Die Dubai-Markierung (active_dubai) ist die verbindliche Freigabe für die UAE-Webseite.
 * Ein Gerät ist dort nur öffentlich sichtbar, wenn status = 'published' UND active_dubai = true.
 * Medizinische Aussagen (CE/MDR/ISO/Zweckbestimmung) dürfen nur veröffentlicht werden,
 * wenn die Compliance-Freigabe (ph_compliance.approval_status = 'approved') vorliegt.
 */
function withUae<T extends Record<string, any>>(row: T, comp?: Record<string, any> | null): T {
  const published = row.status === "published";
  const approved = comp?.approval_status === "approved";
  return {
    ...row,
    published_ae: published && row.active_dubai === true,
    available_in_uae: row.active_dubai === true,
    medical_claims_approved: approved,
    medical_claims: approved
      ? {
          is_medical_device: comp?.is_medical_device === true,
          ce_status: row.ce_status ?? comp?.ce_status ?? null,
          mdr_status: row.mdr_status ?? comp?.mdr_status ?? null,
          iso_13485: comp?.iso_13485 ?? row.iso_status ?? null,
          laser_class: row.laser_class ?? comp?.laser_class ?? null,
          risk_class: comp?.risk_class ?? null,
          udi_di: comp?.udi_di ?? null,
          basic_udi_di: comp?.basic_udi_di ?? null,
          intended_use: row.intended_use ?? null,
          approved_at: comp?.approved_at ?? null,
        }
      : null,
  } as T;
}

async function complianceMap(supabase: any, ids: string[]) {
  if (!ids.length) return {} as Record<string, any>;
  const { data } = await supabase.from("ph_compliance")
    .select("product_id,approval_status,approved_at,is_medical_device,ce_status,mdr_status,iso_13485,laser_class,risk_class,udi_di,basic_udi_di")
    .in("product_id", ids);
  return Object.fromEntries((data || []).map((r: any) => [r.product_id, r]));
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const key = req.headers.get("x-api-key");
  const expected = Deno.env.get("PRODUCT_HUB_API_KEY");
  if (!expected || key !== expected) return json(401, { error: "unauthorized" });
  if (req.method !== "GET") return json(405, { error: "read_only" });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // [product-hub-api, products, {id}, media?]
  const idx = parts.indexOf("products");
  const productId = idx >= 0 ? parts[idx + 1] : undefined;
  const sub = idx >= 0 ? parts[idx + 2] : undefined;
  const rawChannel = url.searchParams.get("channel");
  // alix-lasers.ae darf als ae/uae/dubai angefragt werden – intern immer "dubai"
  const channel = rawChannel === "ae" || rawChannel === "uae" ? "dubai" : rawChannel;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const activeCol: Record<string, string> = {
    com: "active_com", de: "active_de", at: "active_at", usa: "active_usa",
    dubai: "active_dubai", ae: "active_dubai", uae: "active_dubai",
  };

  // Content Hub: nur freigegebene, veröffentlichte Snapshots ausliefern (EDIT ONCE · PUBLISH EVERYWHERE)
  const CH_ALLOWED = ["website", "offer", "datasheet", "comparison", "portal", "social"];

  try {
    if (parts.includes("content") && !productId) {
      const ch = CH_ALLOWED.includes(channel || "") ? channel! : "website";
      const { data, error } = await supabase
        .from("ch_channel_state")
        .select("product_id,channel,published_version,published_at,published_hash,payload")
        .eq("channel", ch)
        .not("published_at", "is", null);
      if (error) throw error;
      const ids = (data || []).map((r: any) => r.product_id);
      const { data: prods } = ids.length
        ? await supabase.from("ph_products").select("id,alix_product_id,slug,status").in("id", ids)
        : { data: [] as any[] };
      const byId = Object.fromEntries((prods || []).map((p: any) => [p.id, p]));
      return json(200, {
        channel: ch,
        items: (data || [])
          .filter((r: any) => byId[r.product_id]?.status === "published")
          .map((r: any) => ({
            alix_product_id: byId[r.product_id]?.alix_product_id,
            slug: byId[r.product_id]?.slug,
            version: r.published_version,
            published_at: r.published_at,
            content_hash: r.published_hash,
            content: r.payload,
          })),
      });
    }

    if (!productId) {
      let q = supabase.from("ph_products").select(`id,${PUBLIC_FIELDS}`).eq("status", "published").order("sort_order");
      if (channel && activeCol[channel]) q = q.eq(activeCol[channel], true);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      const comps = await complianceMap(supabase, rows.map((r) => r.id));
      return json(200, {
        products: rows.map((r) => {
          const { id, ...rest } = withUae(stripPrices(r, channel), comps[r.id]);
          return rest;
        }),
      });
    }

    const { data: prod, error: pe } = await supabase.from("ph_products")
      .select(`id,${PUBLIC_FIELDS}`).eq("alix_product_id", productId).maybeSingle();
    if (pe) throw pe;
    if (!prod) return json(404, { error: "not_found" });
    const comps1 = await complianceMap(supabase, [(prod as any).id]);
    const pubProd = withUae(stripPrices(prod as any, channel), comps1[(prod as any).id]);

    if (sub === "media") {
      const { data } = await supabase.from("ph_media")
        .select("url,kind,media_type,title,alt_text,channels,sort_order,is_primary")
        .eq("product_id", (prod as any).id).order("sort_order");
      return json(200, { media: (data || []).filter(m => !channel || (m.channels || []).length === 0 || m.channels.includes(channel)) });
    }
    if (sub === "documents") {
      const { data } = await supabase.from("ph_documents")
        .select("title,doc_type,visibility,language,version,url,channels")
        .eq("product_id", (prod as any).id).eq("visibility", "website");
      return json(200, { documents: (data || []).filter(d => !channel || (d.channels || []).length === 0 || d.channels.includes(channel)) });
    }
    if (sub === "content") {
      const ch = CH_ALLOWED.includes(channel || "") ? channel! : "website";
      const { data } = await supabase.from("ch_channel_state")
        .select("published_version,published_at,published_hash,payload")
        .eq("product_id", (prod as any).id).eq("channel", ch).maybeSingle();
      if (!data?.published_at) return json(404, { error: "not_published" });
      return json(200, {
        channel: ch, version: data.published_version, published_at: data.published_at,
        content_hash: data.published_hash, content: data.payload,
      });
    }

    const { id, ...pub } = pubProd as any;
    return json(200, { product: pub });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
