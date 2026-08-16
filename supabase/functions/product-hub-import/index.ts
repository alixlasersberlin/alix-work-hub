// ALIXWORK PRODUCT HUB – Import bestehender Produktdaten (z. B. 31 Geräte aus alix-lasers.de)
// Additiv: es wird niemals gelöscht; Dubletten werden über Mapping vermieden.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-alix-key",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const norm = (s?: string | null) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function mapProduct(raw: any) {
  const specs = raw.specs || raw.tech_specs || raw.technische_daten || {};
  const name = raw.name || raw.product_name || raw.title || raw.produktname;
  return {
    alix_product_id: raw.alix_product_id || raw.alixProductId || null,
    source_product_id: raw.source_product_id || raw.id?.toString?.() || null,
    name,
    internal_name: raw.internal_name || null,
    model: raw.model || raw.modell || null,
    sku: raw.sku || null,
    slug: raw.slug || (name ? slugify(name) : null),
    status: raw.status && ["draft", "review", "approved", "published", "archived"].includes(raw.status) ? raw.status : "approved",
    product_group: raw.product_group || raw.produktgruppe || null,
    categories: raw.categories || raw.kategorien || [],
    applications: raw.applications || raw.anwendungen || [],
    short_description: raw.short_description || raw.kurzbeschreibung || null,
    long_description: raw.long_description || raw.langbeschreibung || raw.description || null,
    features: raw.features || [],
    smart_ki: raw.smart_ki || raw.smartKi || {},
    tech_specs: specs,
    wavelengths: raw.wavelengths || specs.wellenlaengen || specs.wavelengths || null,
    power: raw.power || specs.leistung || specs.power || null,
    fluence: raw.fluence || specs.fluence || null,
    pulse_duration: raw.pulse_duration || specs.pulsdauer || null,
    frequency: raw.frequency || specs.frequenz || null,
    spot_sizes: raw.spot_sizes || specs.spotgroessen || null,
    cooling: raw.cooling || specs.kuehlung || null,
    laser_class: raw.laser_class || specs.laserklasse || null,
    intended_use: raw.intended_use || raw.zweckbestimmung || null,
    manufacturer: raw.manufacturer || raw.hersteller || null,
    production_site: raw.production_site || null,
    ce_status: raw.ce_status || null,
    mdr_status: raw.mdr_status || null,
    iso_status: raw.iso_status || null,
    standards: raw.standards || raw.normen || [],
    hero_image_url: raw.hero_image_url || raw.main_image || raw.image || null,
    seo_title: raw.seo_title || null,
    seo_description: raw.seo_description || null,
    sort_order: raw.sort_order ?? 0,
    featured: !!raw.featured,
    protected: !!(raw.protected || raw.protection_status === "protected"),
    active_de: raw.active_de ?? true,
    active_com: raw.active_com ?? false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now();
  try {
    const body = await req.json();
    const channel = body.channel || "de";
    let list: any[] = body.products || [];

    if (!list.length && body.source_url) {
      const headers: Record<string, string> = { Accept: "application/json" };
      const key = Deno.env.get("PRODUCT_HUB_SOURCE_KEY");
      if (key) headers["x-api-key"] = key;
      const res = await fetch(body.source_url, { headers });
      if (!res.ok) return json(400, { error: `source_fetch_failed_${res.status}` });
      const data = await res.json();
      list = Array.isArray(data) ? data : (data.products || data.data || []);
    }
    if (!Array.isArray(list) || list.length === 0) return json(400, { error: "no_products" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await supabase.from("ph_products").select("*");
    const ex = existing || [];
    let created = 0, updated = 0, duplicates = 0;
    const conflicts: any[] = [];

    for (const raw of list) {
      const p = mapProduct(raw);
      if (!p.name) continue;
      const match = ex.find((e: any) =>
        (p.alix_product_id && e.alix_product_id === p.alix_product_id) ||
        (p.source_product_id && e.source_product_id === p.source_product_id) ||
        (p.sku && e.sku === p.sku) ||
        (p.slug && e.slug === p.slug) ||
        (p.model && e.model && norm(e.model) === norm(p.model)) ||
        norm(e.name) === norm(p.name)
      );

      let productId: string;
      if (match) {
        duplicates++;
        // niemals kritische Werte blind überschreiben: nur leere Felder ergänzen
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(p)) {
          const cur = (match as any)[k];
          const empty = cur === null || cur === undefined || cur === "" ||
            (Array.isArray(cur) && cur.length === 0) ||
            (typeof cur === "object" && cur !== null && !Array.isArray(cur) && Object.keys(cur).length === 0);
          if (empty && v !== null && v !== undefined && v !== "") patch[k] = v;
          else if (!empty && v && String(cur) !== String(v) && typeof v !== "object") {
            conflicts.push({
              product_id: match.id, channel_code: channel, field_name: k,
              master_value: String(cur), channel_value: String(v), severity: "warning",
            });
          }
        }
        if (Object.keys(patch).length) {
          await supabase.from("ph_products").update(patch).eq("id", match.id);
          updated++;
        }
        productId = match.id;
      } else {
        const { data: ins, error } = await supabase.from("ph_products")
          .insert({ ...p, alix_product_id: p.alix_product_id || `ALX-${slugify(p.name).toUpperCase()}` })
          .select("id").single();
        if (error) {
          await supabase.from("ph_sync_log").insert({ channel_code: channel, direction: "import", operation: "create", status: "error", message: `${p.name}: ${error.message}` });
          continue;
        }
        created++;
        productId = ins.id;
      }

      await supabase.from("ph_product_channels").upsert({
        product_id: productId, channel_code: channel,
        status: raw.sync_status || "published",
        remote_id: p.source_product_id,
        live_url: raw.url || raw.live_url || null,
        live_version: raw.version || null,
        last_sync_at: new Date().toISOString(),
        last_sync_status: "ok",
        remote_snapshot: raw,
      }, { onConflict: "product_id,channel_code" });

      // Medien
      const gallery = raw.gallery || raw.images || [];
      for (const [i, g] of (Array.isArray(gallery) ? gallery : []).entries()) {
        const url = typeof g === "string" ? g : g.url;
        if (!url) continue;
        const { data: dup } = await supabase.from("ph_media").select("id").eq("product_id", productId).eq("url", url).maybeSingle();
        if (!dup) {
          await supabase.from("ph_media").insert({
            product_id: productId, url, kind: typeof g === "object" ? (g.kind || "gallery") : "gallery",
            media_type: "image", title: typeof g === "object" ? g.title : null,
            alt_text: typeof g === "object" ? (g.alt || g.alt_text) : null,
            channels: [channel], sort_order: i, source_ref: "import",
          });
        }
      }
      for (const v of (raw.videos || [])) {
        const url = typeof v === "string" ? v : v.url;
        if (!url) continue;
        const { data: dup } = await supabase.from("ph_media").select("id").eq("product_id", productId).eq("url", url).maybeSingle();
        if (!dup) await supabase.from("ph_media").insert({ product_id: productId, url, kind: "video", media_type: "video", channels: [channel], source_ref: "import" });
      }
      // Dokumente
      for (const d of (raw.documents || raw.downloads || [])) {
        const url = typeof d === "string" ? d : d.url;
        if (!url) continue;
        const { data: dup } = await supabase.from("ph_documents").select("id").eq("product_id", productId).eq("url", url).maybeSingle();
        if (!dup) await supabase.from("ph_documents").insert({
          product_id: productId, url,
          title: (typeof d === "object" && (d.title || d.name)) || url.split("/").pop(),
          doc_type: (typeof d === "object" && d.type) || "Datenblatt",
          visibility: "website", channels: [channel],
        });
      }
      // Änderungsverlauf aus Quelle
      for (const h of (raw.history || [])) {
        await supabase.from("ph_field_history").insert({
          product_id: productId, alix_product_id: p.alix_product_id,
          field_name: h.field || h.field_name || "unbekannt",
          old_value: h.old_value ?? null, new_value: h.new_value ?? null,
          source: channel, created_at: h.created_at || new Date().toISOString(),
        });
      }
    }

    if (conflicts.length) await supabase.from("ph_conflicts").insert(conflicts);

    await supabase.from("ph_sync_log").insert({
      channel_code: channel, direction: "import", operation: "bulk_import", status: "ok",
      message: `${created} neu, ${updated} aktualisiert, ${duplicates} bestehende Treffer, ${conflicts.length} Konflikte`,
      duration_ms: Date.now() - started,
    });

    return json(200, { created, updated, duplicates, conflicts: conflicts.length, total: list.length });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
