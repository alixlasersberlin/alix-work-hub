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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!KEY) return json(500, { error: "COM_PRODUCT_HUB_WRITE_KEY fehlt" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action ?? "push");

    if (action === "probe") return json(200, await comFetch(body.payload ?? {}));

    const productId = String(body.productId ?? "");
    const locale = String(body.locale ?? "");
    if (!productId || !locale) return json(400, { error: "productId und locale erforderlich" });

    const { data: product } = await admin.from("ph_products")
      .select("id,name,alix_product_id,sku,model").eq("id", productId).maybeSingle();
    if (!product) return json(404, { error: "Gerät nicht gefunden" });
    const hubId = String(body.hubId ?? product.alix_product_id ?? "");
    if (!hubId) return json(400, { error: "Keine stabile Hub-ID am Gerät" });

    const { data: map } = await admin.from("ph_lang_sync_map")
      .select("remote_product_id,remote_url").eq("product_id", productId).eq("site_code", "com").maybeSingle();
    const publishId = String(body.publishId ?? map?.remote_product_id ?? "");
    if (!publishId) return json(400, { error: "Keine .com-Zuordnung (publish_id) vorhanden" });

    const { data: tr } = await admin.from("ph_product_translations")
      .select("*").eq("product_id", productId).eq("locale", locale).maybeSingle();
    if (!tr) return json(400, { error: `Keine ${locale}-Fassung im Product Hub` });
    if (!PUBLISHABLE.includes(tr.status)) {
      return json(409, { error: `Sprachfassung nicht freigegeben (Status ${tr.status}) – nicht geschrieben.` });
    }

    // Nutzdaten aufbauen (nur echte, gefüllte Werte)
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
    if (placeholders.length) return json(409, { error: "Platzhalter erkannt – nicht geschrieben.", placeholders });
    if (!Object.keys(fields).length) return json(409, { error: "Keine übertragbaren Felder." });

    const base = { publish_id: publishId, hub_id: hubId, locale, render: false, publish: false };
    const fieldList = Object.entries(fields).map(([field, value]) => ({ field, value, status: "approved" }));

    if (body.dryRun === true) {
      const dry = await comFetch({ ...base, dry_run: true, fields: fieldList });
      return json(200, { dryRun: true, payload: { ...base, fields: Object.keys(fields) }, response: dry });
    }

    const write = await comFetch({ ...base, dry_run: false, fields: fieldList });
    const ok = write.status >= 200 && write.status < 300 && write.body?.error == null;

    // Read-back: identische Felder als dry_run senden, previous_value = gespeicherter Wert
    let readback: any = null;
    if (ok) readback = await comFetch({ ...base, dry_run: true, fields: fieldList });

    const rows: any[] = readback?.body?.results ?? [];
    const compare = Object.keys(fields).map((rf) => {
      const row = rows.find((r) => r.field === rf);
      const a = norm(fields[rf]);
      const b = row ? norm(row.previous_value) : null;
      return { field: rf, hub_field: hubByRemote[rf], match: b == null ? null : a === b, hub_chars: a.length, site_chars: b?.length ?? null };
    });
    const mismatches = compare.filter((c) => c.match === false).map((c) => c.field);
    const unverified = compare.filter((c) => c.match === null).map((c) => c.field);

    const { data: run } = await admin.from("ph_lang_sync_runs").insert({
      product_id: productId, locale, site_code: "com", site_label: "alix-lasers.com",
      target_url: `${BASE}/translations`, remote_product_id: publishId,
      mode: "publish", result: ok && !mismatches.length ? "ok" : "failed",
      translation_status: tr.status, fallback_detected: false, publish_allowed: false,
      fields_checked: compare.length,
      fields_changed: ok ? compare.length : 0,
      fields_unchanged: 0,
      warnings: unverified.length ? [`Read-back ohne Wert: ${unverified.join(", ")}`] : [],
      errors: ok ? (mismatches.length ? [`Abweichungen: ${mismatches.join(", ")}`] : []) : [JSON.stringify(write.body).slice(0, 400)],
      summary: { write_status: write.status, readback_status: readback?.status ?? null, hub_id: hubId, publish_id: publishId, render: false, publish: false },
    }).select("id").maybeSingle();

    if (run?.id) {
      await admin.from("ph_lang_sync_fields").insert(Object.keys(fields).map((rf) => {
        const row = (write.body?.results ?? []).find((r: any) => r.field === rf);
        return {
          run_id: run.id, field: hubByRemote[rf], remote_field: rf,
          value_before: row ? norm(row.previous_value).slice(0, 4000) : null,
          value_after: norm(fields[rf]).slice(0, 4000),
          action: ok ? "change" : "failed",
          write_status: String(write.status),
          message: compare.find((c) => c.field === rf)?.match === false ? "Read-back weicht ab" : null,
        };
      }));
    }

    return json(ok ? 200 : 502, {
      runId: run?.id ?? null, hub_id: hubId, publish_id: publishId, locale, status: tr.status,
      write_status: write.status, write_summary: { status: write.body?.status, written: (write.body?.results ?? []).length, skipped: (write.body?.skipped ?? []).length },
      readback_status: readback?.status ?? null,
      fields: Object.keys(fields), field_count: Object.keys(fields).length,
      compare, mismatches, unverified, placeholders: 0, rendered: false, published: false,
    });
  } catch (e) {
    return json(500, { error: (e as Error)?.message ?? "Fehler" });
  }
});
