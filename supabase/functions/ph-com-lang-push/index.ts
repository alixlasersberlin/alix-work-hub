// Product Hub -> alix-lasers.com: echte, freigegebene Sprachfassungen übertragen (ohne Rendering/Publish).
// Schreibt ausschließlich redaktionelle Felder. Technische Daten, Preise, Medien bleiben unberührt.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const BASE = "https://www.alix-lasers.com/api/public/product-hub";
const KEY = Deno.env.get("COM_PRODUCT_HUB_WRITE_KEY") ?? "";

// Hub-Feld -> Feldname der .com-Schnittstelle
const FIELD_MAP: Record<string, string> = {
  name: "product_name",
  intended_use: "intended_use",
  short_description: "short_description",
  long_description: "long_description",
  marketing_text: "marketing_text",
  seo_title: "seo_title",
  seo_description: "meta_description",
  highlights: "highlights",
  benefits: "benefits",
  applications: "applications",
  treatments: "treatment_types",
  features: "features",
};
const LIST_HUB_FIELDS = ["highlights", "benefits", "applications", "treatments", "features"];
const PUBLISHABLE = ["approved", "published"];
const PLACEHOLDER = /(lorem ipsum|placeholder|platzhalter|dummy|test\s*data|testdaten|\btbd\b|xxxx+)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCALES = ["en", "es", "ru", "ar"];

async function comFetch(payload: unknown) {
  const r = await fetch(`${BASE}/translations`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* html/text */ }
  return { status: r.status, body };
}

function norm(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).join("\n");
  return String(v).trim();
}

async function pushOne(admin: any, productId: string, locale: string, dryRun: boolean) {
  const { data: product } = await admin.from("ph_products")
    .select("id,name,alix_product_id").eq("id", productId).maybeSingle();
  if (!product) return { productId, locale, result: "SKIPPED", reason: "PRODUCT_NOT_FOUND" };
  const hubId = String(product.alix_product_id ?? "");
  if (!hubId) return { productId, locale, name: product.name, result: "SKIPPED", reason: "NO_HUB_ID" };

  const { data: map } = await admin.from("ph_lang_sync_map")
    .select("remote_product_id,remote_url,verified_at").eq("product_id", productId).eq("site_code", "com").maybeSingle();
  const target = String(map?.remote_product_id ?? "");
  if (!target) return { productId, locale, name: product.name, result: "SKIPPED", reason: "NO_COM_TARGET" };
  if (!map?.verified_at) return { productId, locale, name: product.name, result: "SKIPPED", reason: "MAPPING_NOT_CONFIRMED" };

  const { data: tr } = await admin.from("ph_product_translations")
    .select("*").eq("product_id", productId).eq("locale", locale).maybeSingle();
  if (!tr) return { productId, locale, name: product.name, result: "SKIPPED", reason: "NO_TRANSLATION" };
  if (tr.status === "outdated") return { productId, locale, name: product.name, result: "SKIPPED", reason: "TRANSLATION_OUTDATED" };
  if (!PUBLISHABLE.includes(tr.status)) return { productId, locale, name: product.name, result: "SKIPPED", reason: `NOT_APPROVED_${tr.status}` };

  const { data: qa } = await admin.from("ph_translation_qa")
    .select("status").eq("product_id", productId).eq("locale", locale).maybeSingle();
  if (qa && String(qa.status).toLowerCase() !== "pass") {
    return { productId, locale, name: product.name, result: "SKIPPED", reason: `QA_${String(qa.status).toUpperCase()}` };
  }

  const fields: Record<string, unknown> = {};
  const hubByRemote: Record<string, string> = {};
  for (const [hubField, remoteField] of Object.entries(FIELD_MAP)) {
    const v = (tr as any)[hubField];
    if (LIST_HUB_FIELDS.includes(hubField)) {
      if (Array.isArray(v) && v.length) { fields[remoteField] = v.map((x: unknown) => String(x)); hubByRemote[remoteField] = hubField; }
    } else if (typeof v === "string" && v.trim()) {
      fields[remoteField] = v.trim(); hubByRemote[remoteField] = hubField;
    }
  }
  const placeholders = Object.entries(fields).filter(([, v]) => PLACEHOLDER.test(norm(v))).map(([k]) => k);
  if (placeholders.length) return { productId, locale, name: product.name, result: "SYNC_FAILED", reason: "PLACEHOLDER", placeholders };
  if (!Object.keys(fields).length) return { productId, locale, name: product.name, result: "SKIPPED", reason: "NO_FIELDS" };

  const base: Record<string, unknown> = { hub_id: hubId, locale, render: false, publish: false };
  if (UUID.test(target)) base.publish_id = target; else base.product_slug = target;
  const fieldList = Object.entries(fields).map(([field, value]) => ({ field, value, status: "approved" }));

  if (dryRun) {
    const dry = await comFetch({ ...base, dry_run: true, fields: fieldList });
    return { productId, locale, name: product.name, result: dry.status < 400 ? "DRY_OK" : "DRY_FAILED", target, status: dry.status, response: dry.body };
  }

  const write = await comFetch({ ...base, dry_run: false, fields: fieldList });
  const ok = write.status >= 200 && write.status < 300 && write.body?.error == null;
  const readback = ok ? await comFetch({ ...base, dry_run: true, fields: fieldList }) : null;

  const rows: any[] = readback?.body?.results ?? [];
  const compare = Object.keys(fields).map((rf) => {
    const row = rows.find((r) => r.field === rf);
    const a = norm(fields[rf]);
    const b = row ? norm(row.previous_value) : null;
    return { field: rf, hub_field: hubByRemote[rf], match: b == null ? null : a === b };
  });
  const mismatches = compare.filter((c) => c.match === false).map((c) => c.field);
  const unverified = compare.filter((c) => c.match === null).map((c) => c.field);
  const synced = ok && !mismatches.length;

  await admin.from("ph_lang_sync_runs").insert({
    product_id: productId, locale, site_code: "com", site_label: "alix-lasers.com",
    target_url: `${BASE}/translations`, remote_product_id: target,
    mode: "publish", result: synced ? "ok" : "failed",
    translation_status: tr.status, fallback_detected: false, publish_allowed: false,
    fields_checked: compare.length, fields_changed: ok ? compare.length : 0, fields_unchanged: 0,
    warnings: unverified.length ? [`Read-back ohne Wert: ${unverified.join(", ")}`] : [],
    errors: synced ? [] : [ok ? `Abweichungen: ${mismatches.join(", ")}` : JSON.stringify(write.body).slice(0, 400)],
    summary: { write_status: write.status, readback_status: readback?.status ?? null, hub_id: hubId, target, render: false, publish: false },
  });

  return {
    productId, locale, name: product.name, target,
    result: synced ? "DATA_SYNCED" : "SYNC_FAILED",
    write_status: write.status, fields: Object.keys(fields).length,
    mismatches, unverified,
    error: synced ? undefined : (write.body?.error ?? write.body?.message ?? undefined),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!KEY) return json(500, { error: "COM_PRODUCT_HUB_WRITE_KEY fehlt" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action ?? "push");
    const dryRun = body.dryRun === true;

    if (action === "probe") return json(200, await comFetch(body.payload ?? {}));

    if (action === "batch") {
      const locales: string[] = Array.isArray(body.locales) && body.locales.length ? body.locales : LOCALES;
      let ids: string[] = Array.isArray(body.productIds) ? body.productIds : [];
      if (!ids.length) {
        const { data: maps } = await admin.from("ph_lang_sync_map")
          .select("product_id").eq("site_code", "com").not("verified_at", "is", null);
        ids = (maps ?? []).map((m: any) => m.product_id);
      }
      const offset = Number(body.offset ?? 0);
      const limit = Number(body.limit ?? ids.length);
      const slice = ids.slice(offset, offset + limit);
      const results: any[] = [];
      for (const pid of slice) {
        for (const loc of locales) {
          try { results.push(await pushOne(admin, pid, loc, dryRun)); }
          catch (e) { results.push({ productId: pid, locale: loc, result: "SYNC_FAILED", error: String((e as Error).message) }); }
        }
      }
      const tally: Record<string, number> = {};
      for (const r of results) tally[r.result] = (tally[r.result] ?? 0) + 1;
      return json(200, { stage: "batch", dryRun, processed: slice.length, total: ids.length, offset, tally, results });
    }

    const productId = String(body.productId ?? "");
    const locale = String(body.locale ?? "");
    if (!productId || !locale) return json(400, { error: "productId und locale erforderlich" });
    return json(200, await pushOne(admin, productId, locale, dryRun));
  } catch (e) {
    return json(500, { error: (e as Error)?.message ?? "Fehler" });
  }
});
