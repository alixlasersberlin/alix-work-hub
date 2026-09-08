// Product Hub -> alix-lasers.com Mapping-Registry.
// Überträgt ausschließlich bestätigte Mapping-Metadaten (Hub-ID -> .com-Zielprodukt).
// Keine Übersetzungen, keine Produktdaten, keine Preise, keine Medien.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const HOST = "https://www.alix-lasers.com";
const KEY = Deno.env.get("COM_PRODUCT_HUB_WRITE_KEY") ?? "";
const PROTECTED_HUB_IDS = ["alix-blueice-smart-ki", "Alix BlueIce Smart KI"];
const PROTECTED_TARGETS = ["c9f9b7c9-d6b7-4ed6-ac60-913cbdec2dd6"];

const CANDIDATE_PATHS = [
  "/api/public/product-hub/mappings",
  "/api/public/product-hub/registry",
  "/api/public/product-hub/mapping-registry",
  "/api/public/product-hub/register",
  "/api/public/product-hub-registry",
];

async function call(path: string, method: string, payload: unknown) {
  const r = await fetch(`${HOST}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  const isSpa = typeof body === "string" && body.startsWith("<!DOCTYPE");
  return { status: r.status, body: isSpa ? "HTML_404_SPA" : body, isSpa };
}

/** Findet den tatsächlichen Registrierungs-Endpunkt (JSON-Antwort statt SPA-HTML). */
async function discover(explicitPath?: string, method = "POST") {
  const paths = explicitPath ? [explicitPath] : CANDIDATE_PATHS;
  const probes: any[] = [];
  for (const p of paths) {
    const res = await call(p, method, { dry_run: true, mappings: [] });
    probes.push({ path: p, method, status: res.status, body: res.body });
    if (!res.isSpa && res.status !== 404) return { path: p, method, probes };
  }
  return { path: null as string | null, method, probes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!KEY) return json(500, { error: "COM_PRODUCT_HUB_WRITE_KEY fehlt" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action ?? "dryrun"); // discover | dryrun | register
    const endpoint: string | undefined = body.endpoint;
    const method = String(body.method ?? "POST");

    // 1. Quelle: ausschließlich bestätigte Zuordnungen aus AlixWork
    const { data: maps, error } = await admin
      .from("ph_lang_sync_map")
      .select("product_id,remote_product_id,remote_url,verified_at,note")
      .eq("site_code", "com");
    if (error) throw error;
    const ids = (maps || []).map((m: any) => m.product_id);
    const { data: prods } = await admin.from("ph_products")
      .select("id,name,alix_product_id,slug,status").in("id", ids);
    const byId = new Map((prods || []).map((p: any) => [p.id, p]));

    const seenHub = new Set<string>();
    const seenTarget = new Set<string>();
    const items: any[] = [];
    const skipped: any[] = [];

    for (const m of maps || []) {
      const p: any = byId.get(m.product_id);
      const name = p?.name?.trim() ?? "(unbekannt)";
      const hubId = String(p?.alix_product_id ?? "").trim();
      const target = String(m.remote_product_id ?? "").trim();
      if (!target) { skipped.push({ name, reason: "NO_TARGET" }); continue; }
      if (!hubId) { skipped.push({ name, reason: "NO_HUB_ID" }); continue; }
      if (!m.verified_at) { skipped.push({ name, reason: "MAPPING_NOT_CONFIRMED" }); continue; }
      if (seenHub.has(hubId)) { skipped.push({ name, reason: "DUPLICATE_HUB_ID" }); continue; }
      if (seenTarget.has(target)) { skipped.push({ name, reason: "DUPLICATE_TARGET" }); continue; }
      seenHub.add(hubId); seenTarget.add(target);
      if (PROTECTED_TARGETS.includes(target) || PROTECTED_HUB_IDS.includes(target) || PROTECTED_HUB_IDS.includes(hubId)) {
        skipped.push({ name, reason: "PROTECTED_EXISTING", target });
        continue;
      }
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
      items.push({
        hub_id: hubId,
        ...(isUuid ? { product_id: target } : { product_slug: target }),
        confidence: "high",
        confirmed_by: "alixwork",
        product_name: name,
        note: "AlixWork confirmed mapping",
      });
    }

    // Sonderaktion: Ziel-IDs auf .com auslesen (GET), um Slug -> UUID aufzulösen
    if (action === "raw") {
      const res = await call(String(body.path ?? "/api/public/product-hub/mappings"), method, body.payload ?? {});
      return json(200, { stage: "raw", ...res });
    }
    if (action === "probe") {
      const paths: string[] = body.paths ?? [
        "/api/public/product-hub/mappings",
        "/api/public/product-hub/products",
        "/api/public/product-hub/export",
      ];
      const out: any[] = [];
      for (const p of paths) {
        const r = await fetch(`${HOST}${p}`, { headers: { "x-api-key": KEY } });
        const t = await r.text();
        let b: any; try { b = JSON.parse(t); } catch { b = t.slice(0, 200); }
        if (typeof b === "string" && b.startsWith("<!DOCTYPE")) b = "HTML_404_SPA";
        out.push({ path: p, status: r.status, body: b });
      }
      return json(200, { stage: "probe", probes: out, confirmed_mappings: items.length });
    }

    // Aufgelöste .com-UUIDs zurück in die Zuordnungstabelle schreiben (Slug bleibt in remote_url erhalten)
    if (action === "resolve") {
      const path = String(body.endpoint ?? "/api/public/product-hub/mappings");
      const dry = await call(path, "POST", { dry_run: true, mappings: items });
      const rows: any[] = Array.isArray((dry.body as any)?.results) ? (dry.body as any).results : [];
      const byHub = new Map(rows.map((r: any) => [String(r.hub_id ?? ""), r]));
      const updated: any[] = [];
      for (const m of maps || []) {
        const p: any = byId.get(m.product_id);
        const hubId = String(p?.alix_product_id ?? "").trim();
        const r: any = byHub.get(hubId);
        const uuid = String(r?.resolved_product_id ?? "");
        if (!uuid || uuid === m.remote_product_id) continue;
        await admin.from("ph_lang_sync_map")
          .update({ remote_product_id: uuid, note: `slug=${m.remote_product_id}` })
          .eq("product_id", m.product_id).eq("site_code", "com");
        updated.push({ name: p?.name, slug: m.remote_product_id, resolved_product_id: uuid });
      }
      return json(200, { stage: "resolve", status: dry.status, updated_count: updated.length, updated });
    }

    const found = await discover(endpoint, method);
    if (!found.path) {
      return json(200, {
        stage: "discover",
        endpoint_found: false,
        candidates: found.probes,
        confirmed_mappings: items.length,
        skipped,
        note: "Registrierungs-Endpunkt auf alix-lasers.com nicht auffindbar – exakten Pfad/Methode angeben (Parameter endpoint/method).",
      });
    }
    if (action === "discover") return json(200, { stage: "discover", endpoint_found: true, ...found, confirmed_mappings: items.length });

    // 2. Dry Run
    const dry = await call(found.path, found.method, { dry_run: true, mappings: items });
    if (action === "dryrun" || dry.status >= 400) {
      return json(200, { stage: "dryrun", endpoint: found.path, status: dry.status, result: dry.body, sent: items, skipped });
    }

    // 3. Nur Mappings registrieren, die im Dry Run vollständig PASS sind
    const results: any[] = Array.isArray((dry.body as any)?.results) ? (dry.body as any).results : [];
    const okHub = new Set(
      results.filter((r: any) =>
        r.ok === true ||
        /REGISTER_READY|ALREADY_REGISTERED|READY|OK|PASS/i.test(String(r.result ?? r.status ?? r.decision ?? "")))
        .map((r: any) => String(r.hub_id ?? "")),
    );
    const toRegister = results.length ? items.filter((i) => okHub.has(i.hub_id)) : items;
    const live = await call(found.path, found.method, { dry_run: false, mappings: toRegister });

    await admin.from("ph_sync_log").insert({
      channel_code: "com",
      action: "registry_push",
      status: live.status < 400 ? "ok" : "error",
      payload: { endpoint: found.path, count: toRegister.length },
      response: live.body,
    } as any).select().maybeSingle();

    return json(200, {
      stage: "register",
      endpoint: found.path,
      dry_run: dry.body,
      registered_attempted: toRegister.length,
      status: live.status,
      result: live.body,
      skipped,
    });
  } catch (e) {
    return json(500, { error: String((e as Error).message ?? e) });
  }
});
