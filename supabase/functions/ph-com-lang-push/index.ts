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

const TEXT_FIELDS = [
  "name", "short_description", "long_description", "marketing_text",
  "seo_title", "seo_description", "intended_use", "product_group_label",
];
const LIST_FIELDS = ["highlights", "benefits", "applications", "treatments", "features"];
const ALLOWED = [...TEXT_FIELDS, ...LIST_FIELDS];
const PUBLISHABLE = ["approved", "published"];
const PLACEHOLDER = /(lorem ipsum|placeholder|platzhalter|dummy|test\s*data|testdaten|tbd|xxx+)/i;

async function comFetch(path: string, init: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-api-key": KEY, ...(init.headers ?? {}) },
  });
  const text = await r.text();
  let body: unknown = text;
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

    // Freie Schnittstellen-Sondierung (nur Diagnose)
    if (action === "probe") {
      const out: Record<string, unknown> = {};
      for (const p of body.paths ?? ["/translations"]) {
        out[p] = await comFetch(p, { method: body.method ?? "PATCH", body: JSON.stringify(body.payload ?? {}) });
      }
      return json(200, out);
    }

    const productId = String(body.productId ?? "");
    const locale = String(body.locale ?? "");
    if (!productId || !locale) return json(400, { error: "productId und locale erforderlich" });

    const { data: product } = await admin.from("ph_products")
      .select("id,name,alix_product_id,sku,model").eq("id", productId).maybeSingle();
    if (!product) return json(404, { error: "Gerät nicht gefunden" });
    const hubId = product.alix_product_id;
    if (!hubId) return json(400, { error: "Keine stabile Hub-ID am Gerät" });

    const { data: map } = await admin.from("ph_lang_sync_map")
      .select("remote_product_id,remote_url").eq("product_id", productId).eq("site_code", "com").maybeSingle();

    const { data: tr } = await admin.from("ph_product_translations")
      .select("*").eq("product_id", productId).eq("locale", locale).maybeSingle();
    if (!tr) return json(400, { error: `Keine ${locale}-Fassung im Product Hub` });
    if (!PUBLISHABLE.includes(tr.status)) {
      return json(409, { error: `Sprachfassung nicht freigegeben (Status ${tr.status}) – nicht geschrieben.` });
    }

    // Nutzdaten aufbauen (nur echte, gefüllte Werte)
    const fields: Record<string, unknown> = {};
    for (const f of TEXT_FIELDS) {
      const v = (tr as any)[f];
      if (typeof v === "string" && v.trim()) fields[f] = v.trim();
    }
    for (const f of LIST_FIELDS) {
      const v = (tr as any)[f];
      if (Array.isArray(v) && v.length) fields[f] = v.map((x: unknown) => String(x));
    }
    const placeholders = Object.entries(fields).filter(([, v]) => PLACEHOLDER.test(norm(v))).map(([k]) => k);
    if (placeholders.length) return json(409, { error: "Platzhalter erkannt – nicht geschrieben.", placeholders });
    if (!Object.keys(fields).length) return json(409, { error: "Keine übertragbaren Felder." });

    const payload = {
      hub_id: hubId,
      product_id: map?.remote_product_id ?? hubId,
      slug: map?.remote_product_id ?? undefined,
      sku: product.sku ?? undefined,
      locale,
      status: "draft",
      render: false,
      publish: false,
      translations: { [locale]: fields },
      fields,
      ...(body.extra ?? {}),
    };

    if (body.dryRun === true) return json(200, { dryRun: true, payload });

    const write = await comFetch("/translations", { method: "PATCH", body: JSON.stringify(payload) });
    const ok = write.status >= 200 && write.status < 300;

    // Read-back
    let readback: any = null;
    if (ok) {
      readback = await comFetch("/translations", {
        method: "PATCH",
        body: JSON.stringify({ hub_id: hubId, locale, action: "read", read_only: true }),
      });
    }

    // Feldvergleich, sofern die Gegenseite Werte zurückgibt
    const remote = (readback?.body?.translation ?? readback?.body?.translations?.[locale] ?? readback?.body?.data ?? null) as Record<string, unknown> | null;
    const compare = Object.keys(fields).map((f) => {
      const a = norm(fields[f]);
      const b = remote ? norm(remote[f]) : null;
      return { field: f, match: b == null ? null : a === b, hub_chars: a.length, site_chars: b?.length ?? null };
    });
    const mismatches = compare.filter((c) => c.match === false).map((c) => c.field);

    // Protokoll
    const { data: run } = await admin.from("ph_lang_sync_runs").insert({
      product_id: productId, locale, site_code: "com", site_label: "alix-lasers.com",
      target_url: `${BASE}/translations`, remote_product_id: map?.remote_product_id ?? hubId,
      mode: "publish", result: ok && !mismatches.length ? "ok" : "failed",
      translation_status: tr.status, fallback_detected: false, publish_allowed: false,
      fields_checked: compare.length,
      fields_changed: ok ? compare.length : 0,
      fields_unchanged: 0,
      warnings: remote ? [] : ["Read-back lieferte keine Feldwerte zurück"],
      errors: ok ? (mismatches.length ? [`Abweichungen: ${mismatches.join(", ")}`] : []) : [String(JSON.stringify(write.body)).slice(0, 400)],
      summary: { write_status: write.status, readback_status: readback?.status ?? null, hub_id: hubId, render: false, publish: false },
    }).select("id").maybeSingle();

    if (run?.id) {
      await admin.from("ph_lang_sync_fields").insert(Object.keys(fields).map((f) => ({
        run_id: run.id, field: f, remote_field: f,
        value_before: null, value_after: norm(fields[f]).slice(0, 4000),
        action: ok ? "change" : "failed",
        write_status: String(write.status),
        message: compare.find((c) => c.field === f)?.match === false ? "Read-back weicht ab" : null,
      })));
    }

    return json(ok ? 200 : 502, {
      runId: run?.id ?? null, hub_id: hubId, locale, status: tr.status,
      write_status: write.status, write_body: write.body,
      readback_status: readback?.status ?? null, readback_body: readback?.body ?? null,
      fields: Object.keys(fields), field_count: Object.keys(fields).length,
      compare, mismatches, placeholders: 0, rendered: false, published: false,
    });
  } catch (e) {
    return json(500, { error: (e as Error)?.message ?? "Fehler" });
  }
});
