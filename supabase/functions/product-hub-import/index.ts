// ALIXWORK PRODUCT HUB – kontrollierter Import bestehender Produktdaten (z. B. 31 Geräte aus alix-lasers.de)
// Modi: test (Verbindungstest), preview (Vorschau ohne Schreiben), import (schreibend, additiv)
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

const DEFAULT_SOURCE = {
  name: "ALIX Lasers DE – Product Hub",
  endpoint: "https://alix-lasers.de/api/public/product-hub/export",
  auth_header: "x-api-key",
  secret_name: "DE_EXPORT_API_KEY",
  channel: "de",
};

const EXPECT = {
  schema_version: "1.0",
  source: "alix-lasers.de",
  source_project: "alix-legacy-reborn",
  product_count: 31,
};

function mapProduct(raw: any) {
  const specs = raw.specs || raw.tech_specs || raw.technische_daten || {};
  const name = raw.product_name || raw.name || raw.title || raw.produktname;
  const reviewRequired = !!(raw.review_required || raw.reviewRequired);
  const status = raw.status && ["draft", "review", "approved", "published", "archived"].includes(raw.status)
    ? raw.status : (reviewRequired ? "review" : "approved");
  return {
    alix_product_id: raw.alix_product_id || raw.alixProductId || null,
    source_product_id: raw.source_product_id ?? (raw.id != null ? String(raw.id) : null),
    name,
    internal_name: raw.internal_name || null,
    model: raw.model || raw.modell || null,
    sku: raw.sku || null,
    slug: raw.slug || (name ? slugify(name) : null),
    status: reviewRequired ? "review" : status,
    product_group: raw.product_group || raw.subcategory || raw.produktgruppe || null,
    categories: raw.categories || raw.kategorien || [],
    applications: raw.application_categories || raw.applications || raw.anwendungen || [],
    short_description: raw.short_description || raw.kurzbeschreibung || null,
    long_description: raw.description || raw.long_description || raw.langbeschreibung || null,
    features: raw.features || [],
    // Zusatzstrukturen der Quelle verlustfrei mitführen (keine Interpretation/Normalisierung)
    smart_ki: raw.smart_ai || raw.smart_ki || raw.smartKi || {},
    tech_specs: {
      ...(typeof specs === "object" && specs !== null ? specs : { value: specs }),
      ...(raw.handpieces ? { handpieces: raw.handpieces } : {}),
      ...(raw.signature ? { signature: raw.signature } : {}),
      ...(raw.source_specs ? { source_specs: raw.source_specs } : {}),
      ...(raw.technologies ? { technologies: raw.technologies } : {}),
      ...(raw.subcategory ? { subcategory: raw.subcategory } : {}),
      ...(raw.source_project ? { source_project: raw.source_project } : {}),
      ...(raw.source_hash ? { source_hash: raw.source_hash } : {}),
      ...(raw.target_hash ? { target_hash: raw.target_hash } : {}),
    },
    wavelengths: raw.wavelengths_nm ?? raw.wavelengths ?? specs?.wellenlaengen ?? specs?.wavelengths ?? null,
    power: raw.power ?? specs?.leistung ?? specs?.power ?? null,
    fluence: raw.fluence ?? specs?.fluence ?? null,
    pulse_duration: raw.pulse_duration ?? specs?.pulsdauer ?? null,
    frequency: raw.frequency ?? specs?.frequenz ?? null,
    spot_sizes: raw.spot_sizes ?? specs?.spotgroessen ?? null,
    cooling: raw.cooling ?? specs?.kuehlung ?? null,
    laser_class: raw.laser_class ?? specs?.laserklasse ?? null,
    intended_use: raw.intended_use || raw.zweckbestimmung || null,
    manufacturer: raw.manufacturer || raw.hersteller || null,
    ce_status: raw.ce_status || null,
    mdr_status: raw.mdr_status || null,
    iso_status: raw.iso_status || null,
    standards: raw.standards || raw.normen || [],
    hero_image_url: raw.hero_image_url || raw.main_image || raw.image || null,
    seo_title: raw.seo_title || null,
    seo_description: raw.seo_description || null,
    sort_order: raw.sort_order ?? 0,
    featured: !!raw.featured,
    protected: !!(raw.protected || raw.manual_override || raw.protection_status === "protected"),
    manual_override: !!raw.manual_override,
    active_de: raw.active_de ?? true,
    active_com: raw.active_com ?? false,
  };
}

const isEmpty = (v: any) =>
  v === null || v === undefined || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);

const CRITICAL = new Set([
  "wavelengths", "power", "fluence", "pulse_duration", "frequency", "spot_sizes",
  "cooling", "laser_class", "intended_use", "manufacturer", "ce_status", "mdr_status", "iso_status",
]);

function matchProduct(p: any, ex: any[]) {
  const rules: [string, (e: any) => boolean][] = [
    ["alix_product_id", (e) => !!p.alix_product_id && e.alix_product_id === p.alix_product_id],
    ["source_product_id", (e) => !!p.source_product_id && e.source_product_id === p.source_product_id],
    ["sku", (e) => !!p.sku && e.sku === p.sku],
    ["slug", (e) => !!p.slug && e.slug === p.slug],
    ["model", (e) => !!p.model && !!e.model && norm(e.model) === norm(p.model)],
    ["name", (e) => !!p.name && norm(e.name) === norm(p.name)],
  ];
  for (const [via, fn] of rules) {
    const hits = ex.filter(fn);
    if (hits.length === 1) return { match: hits[0], via };
    if (hits.length > 1) return { match: null, via, ambiguous: true };
  }
  return { match: null, via: null };
}

async function fetchSource(endpoint: string) {
  const key = Deno.env.get("DE_EXPORT_API_KEY") || Deno.env.get("PRODUCT_HUB_SOURCE_KEY");
  if (!key) return { ok: false, error: "missing_secret_DE_EXPORT_API_KEY" as const };
  const res = await fetch(endpoint, { headers: { Accept: "application/json", "x-api-key": key } });
  if (!res.ok) return { ok: false, error: `source_fetch_failed_${res.status}` as const };
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.products || data.data || []);
  return { ok: true as const, data, list };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({}));
    const mode: string = body.mode || (body.products || body.source_url ? "import" : "test");
    const channel = body.channel || DEFAULT_SOURCE.channel;
    const endpoint = body.endpoint || body.source_url || DEFAULT_SOURCE.endpoint;

    // ---------- Quelle laden ----------
    let list: any[] = body.products || [];
    let meta: any = {};
    if (!list.length) {
      const r = await fetchSource(endpoint);
      if (!r.ok) {
        await supabase.from("ph_sync_log").insert({
          channel_code: channel, direction: "import", operation: mode, status: "error", message: r.error,
        });
        return json(400, { error: r.error });
      }
      list = r.list;
      const d: any = r.data;
      meta = {
        schema_version: d.schema_version, source: d.source, source_project: d.source_project,
        product_count: d.product_count ?? list.length, exported_at: d.exported_at ?? null,
      };
    } else {
      meta = { schema_version: EXPECT.schema_version, source: "manual", source_project: null, product_count: list.length };
    }

    const checks = {
      schema_version: { expected: EXPECT.schema_version, actual: meta.schema_version, ok: meta.schema_version === EXPECT.schema_version },
      source: { expected: EXPECT.source, actual: meta.source, ok: meta.source === EXPECT.source },
      source_project: { expected: EXPECT.source_project, actual: meta.source_project, ok: meta.source_project === EXPECT.source_project },
      product_count: { expected: EXPECT.product_count, actual: meta.product_count, ok: Number(meta.product_count) === EXPECT.product_count },
      products_received: { expected: EXPECT.product_count, actual: list.length, ok: list.length === EXPECT.product_count },
    };
    const allOk = Object.values(checks).every((c: any) => c.ok);

    if (mode === "test") {
      await supabase.from("ph_sync_log").insert({
        channel_code: channel, direction: "import", operation: "connection_test",
        status: allOk ? "ok" : "warning", message: `Verbindungstest ${allOk ? "erfolgreich" : "mit Abweichungen"}`,
        payload: checks, duration_ms: Date.now() - started,
      });
      return json(200, { mode: "test", ok: allOk, checks, meta });
    }

    if (!Array.isArray(list) || list.length === 0) return json(400, { error: "no_products" });

    const { data: existing } = await supabase.from("ph_products").select("*");
    const ex = existing || [];
    const before = ex.length;

    // ---------- Vorschau ----------
    const mapped = list.map((raw: any) => ({ raw, p: mapProduct(raw) }));
    const preview = {
      source_products: list.length, new_products: 0, existing_products: 0,
      match_alix_product_id: 0, match_source_product_id: 0, match_sku: 0, match_slug: 0, match_model: 0, match_name: 0,
      possible_duplicates: 0, technical_conflicts: 0, missing_data: 0, protected_products: 0,
      media: 0, videos: 0, documents: 0, with_specs: 0, manual_override: 0, review_required: 0,
    };
    const viaKey: Record<string, keyof typeof preview> = {
      alix_product_id: "match_alix_product_id", source_product_id: "match_source_product_id",
      sku: "match_sku", slug: "match_slug", model: "match_model", name: "match_name",
    };
    for (const { raw, p } of mapped) {
      const m = matchProduct(p, ex);
      if (m.ambiguous) preview.possible_duplicates++;
      else if (m.match) { preview.existing_products++; if (m.via) (preview as any)[viaKey[m.via]]++; }
      else preview.new_products++;
      if (!p.name || !p.model) preview.missing_data++;
      if (p.protected) preview.protected_products++;
      if (p.manual_override) preview.manual_override++;
      if (p.status === "review") preview.review_required++;
      if (!isEmpty(p.tech_specs)) preview.with_specs++;
      const imgs = (raw.images || raw.gallery || []);
      preview.media += Array.isArray(imgs) ? imgs.length : 0;
      preview.videos += (raw.videos || []).length;
      preview.documents += (raw.downloads || raw.documents || []).length;
      if (m.match) {
        for (const [k, v] of Object.entries(p)) {
          const cur = (m.match as any)[k];
          if (!isEmpty(cur) && !isEmpty(v) && typeof v !== "object" && String(cur) !== String(v) && CRITICAL.has(k)) {
            preview.technical_conflicts++;
          }
        }
      }
    }

    if (mode === "preview") return json(200, { mode: "preview", ok: allOk, checks, meta, preview });

    // ---------- Import ----------
    if (!allOk && !body.force) {
      return json(400, { error: "source_validation_failed", checks, meta });
    }

    let created = 0, merged = 0, duplicates = 0, mediaCount = 0, videoCount = 0, docCount = 0, errors = 0;
    const conflicts: any[] = [];
    const errorList: string[] = [];
    const importedBy = body.user_id || null;

    for (const { raw, p } of mapped) {
      try {
        if (!p.name) { errors++; errorList.push("Produkt ohne Namen übersprungen"); continue; }
        const m = matchProduct(p, ex);
        if (m.ambiguous) {
          duplicates++;
          conflicts.push({
            product_id: null, channel_code: channel, field_name: m.via || "match",
            master_value: "mehrdeutiger Treffer", channel_value: p.name, severity: "critical",
          });
          continue;
        }

        let productId: string;
        const importedFields: string[] = [];

        if (m.match) {
          const patch: Record<string, any> = {};
          for (const [k, v] of Object.entries(p)) {
            const cur = (m.match as any)[k];
            if (isEmpty(v)) continue;
            if (isEmpty(cur)) { patch[k] = v; importedFields.push(k); continue; }
            if (typeof v !== "object" && String(cur) !== String(v)) {
              if ((m.match as any).manual_override || (m.match as any).protected) continue; // Schutzstatus nie überschreiben
              conflicts.push({
                product_id: (m.match as any).id, channel_code: channel, field_name: k,
                master_value: String(cur), channel_value: String(v),
                severity: CRITICAL.has(k) ? "critical" : "warning",
              });
            }
          }
          if (Object.keys(patch).length) await supabase.from("ph_products").update(patch).eq("id", (m.match as any).id);
          merged++;
          productId = (m.match as any).id;
        } else {
          const { data: ins, error } = await supabase.from("ph_products")
            .insert({ ...p, alix_product_id: p.alix_product_id || `ALX-${slugify(p.name).toUpperCase()}` })
            .select("*").single();
          if (error) {
            errors++; errorList.push(`${p.name}: ${error.message}`);
            await supabase.from("ph_sync_log").insert({ channel_code: channel, direction: "import", operation: "create", status: "error", message: `${p.name}: ${error.message}` });
            continue;
          }
          created++;
          productId = ins.id;
          ex.push(ins);
          importedFields.push(...Object.keys(p).filter((k) => !isEmpty((p as any)[k])));
        }

        // Kanalzuordnung DE
        await supabase.from("ph_product_channels").upsert({
          product_id: productId, channel_code: channel,
          status: raw.sync_status || "published",
          remote_id: p.source_product_id,
          live_url: raw.url || raw.live_url || null,
          live_version: raw.version || null,
          last_sync_at: raw.last_sync || new Date().toISOString(),
          last_sync_status: "ok",
          seo_title: p.seo_title,          // SEO bleibt kanalbezogen DE
          seo_description: p.seo_description,
          slug: p.slug,
          remote_snapshot: raw,
        }, { onConflict: "product_id,channel_code" });

        // Medien (nur referenzieren, nicht kopieren)
        const imgs = raw.images || raw.gallery || [];
        for (const [i, g] of (Array.isArray(imgs) ? imgs : []).entries()) {
          const url = typeof g === "string" ? g : g.url;
          if (!url) continue;
          const { data: dup } = await supabase.from("ph_media").select("id").eq("product_id", productId).eq("url", url).maybeSingle();
          if (dup) continue;
          const o = typeof g === "object" ? g : {};
          await supabase.from("ph_media").insert({
            product_id: productId, url,
            kind: o.type || o.kind || (o.hero ? "hero" : "gallery"),
            media_type: "image",
            title: o.filename || o.title || null,
            alt_text: o.alt || o.alt_text || null,
            channels: [channel], sort_order: o.sort ?? i, is_primary: !!o.hero,
            source_ref: `de:${o.source || "export"}`,
          });
          mediaCount++;
          if (o.hero && !p.hero_image_url) await supabase.from("ph_products").update({ hero_image_url: url }).eq("id", productId);
        }
        for (const v of (raw.videos || [])) {
          const url = typeof v === "string" ? v : v.url;
          if (!url) continue;
          const { data: dup } = await supabase.from("ph_media").select("id").eq("product_id", productId).eq("url", url).maybeSingle();
          if (dup) continue;
          await supabase.from("ph_media").insert({
            product_id: productId, url, kind: "video", media_type: "video",
            title: (typeof v === "object" && (v.title || v.filename)) || null,
            channels: [channel], source_ref: "de:export",
          });
          videoCount++;
        }
        // Dokumente – öffentlicher Export nur website/customer
        for (const d of (raw.downloads || raw.documents || [])) {
          const url = typeof d === "string" ? d : d.url;
          if (!url) continue;
          const { data: dup } = await supabase.from("ph_documents").select("id").eq("product_id", productId).eq("url", url).maybeSingle();
          if (dup) continue;
          const o = typeof d === "object" ? d : {};
          const vis = o.visibility === "customer" ? "customer" : "website";
          await supabase.from("ph_documents").insert({
            product_id: productId, url,
            title: o.title || o.name || o.filename || url.split("/").pop(),
            doc_type: o.type || o.doc_type || "Download",
            visibility: vis, language: o.language || "de", version: o.version || null,
            channels: [channel],
          });
          docCount++;
        }

        // Ein strukturierter Audit-Eintrag pro Produkt
        await supabase.from("ph_field_history").insert({
          product_id: productId, alix_product_id: p.alix_product_id,
          field_name: "INITIAL_MIGRATION", old_value: null,
          new_value: JSON.stringify({ source: "alix-lasers.de", action: "INITIAL_MIGRATION", fields: importedFields, result: m.match ? "merged" : "created", at: new Date().toISOString() }),
          is_critical: false, source: "alix-lasers.de", channel_code: channel, changed_by: importedBy,
        });
      } catch (e) {
        errors++; errorList.push((e as Error).message);
      }
    }

    if (conflicts.length) await supabase.from("ph_conflicts").insert(conflicts.filter((c) => c.product_id));

    const { count: after } = await supabase.from("ph_products").select("id", { count: "exact", head: true });

    const result = {
      source_products: list.length, before, after: after ?? before + created,
      created, merged, conflicts: conflicts.length, duplicates,
      media: mediaCount, videos: videoCount, documents: docCount,
      with_specs: preview.with_specs, manual_override: preview.manual_override,
      review_required: preview.review_required, errors, error_list: errorList.slice(0, 20),
    };

    await supabase.from("ph_sync_log").insert({
      channel_code: channel, direction: "import", operation: "initial_migration",
      status: errors ? "warning" : "ok",
      message: `INITIAL_MIGRATION: ${created} neu, ${merged} zusammengeführt, ${conflicts.length} Konflikte, ${errors} Fehler`,
      payload: result, duration_ms: Date.now() - started,
    });

    return json(200, { mode: "import", ok: true, checks, meta, result });
  } catch (e) {
    await supabase.from("ph_sync_log").insert({
      channel_code: "de", direction: "import", operation: "initial_migration", status: "error", message: (e as Error).message,
    });
    return json(500, { error: (e as Error).message });
  }
});
