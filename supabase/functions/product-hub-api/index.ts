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
  "alix_product_id,name,model,sku,slug,status,product_group,categories,applications,short_description,long_description,features,smart_ki,tech_specs,wavelengths,power,fluence,pulse_duration,frequency,spot_sizes,cooling,laser_class,intended_use,manufacturer,ce_status,mdr_status,iso_status,standards,hero_image_url,seo_title,seo_description,sort_order,featured,active_de,active_com,active_at,active_usa,active_dubai,updated_at";

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
  const channel = url.searchParams.get("channel");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const activeCol: Record<string, string> = { com: "active_com", de: "active_de", at: "active_at", usa: "active_usa", dubai: "active_dubai" };

  try {
    if (!productId) {
      let q = supabase.from("ph_products").select(PUBLIC_FIELDS).eq("status", "published").order("sort_order");
      if (channel && activeCol[channel]) q = q.eq(activeCol[channel], true);
      const { data, error } = await q;
      if (error) throw error;
      return json(200, { products: data || [] });
    }

    const { data: prod, error: pe } = await supabase.from("ph_products")
      .select(`id,${PUBLIC_FIELDS}`).eq("alix_product_id", productId).maybeSingle();
    if (pe) throw pe;
    if (!prod) return json(404, { error: "not_found" });

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

    const { id, ...pub } = prod as any;
    return json(200, { product: pub });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
