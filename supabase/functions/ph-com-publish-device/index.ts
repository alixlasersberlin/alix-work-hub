// Product Hub -> alix-lasers.com: deutsche Haupttexte eines Geraets direkt uebertragen.
// Nur fuer Admin/Super Admin. Nur bestaetigte Zuordnung. Keine Preise, keine Medien.
// Ablauf: Probelauf -> Schreiben -> Kontrolle (erneuter Probelauf vergleicht Werte).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ENDPOINT = "https://www.alix-lasers.com/api/public/product-hub/translations";
const MASTER_ENDPOINT = "https://www.alix-lasers.com/api/public/product-hub/master-data";
const TECH_MAP: Record<string, string> = {
  model: "model", wavelengths: "wavelength", power: "power", cooling: "cooling", fluence: "fluence",
  pulse_duration: "pulse_duration", frequency: "frequency", spot_sizes: "spot_size", laser_class: "laser_class",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER = /(lorem ipsum|placeholder|platzhalter|dummy|testdaten|\btbd\b|xxxx+)/i;

const FIELD_MAP: Record<string, string> = {
  name: "product_name",
  short_description: "short_description",
  long_description: "long_description",
  seo_title: "seo_title",
  seo_description: "meta_description",
  features: "features",
};

const toList = (v: unknown): string[] | null => {
  if (!Array.isArray(v)) return null;
  const out = v.map((x) => (typeof x === "string" ? x : (x as any)?.label ?? (x as any)?.title ?? (x as any)?.name ?? ""))
    .map((s) => String(s).trim()).filter(Boolean);
  return out.length ? out : null;
};
const norm = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).join("\n") : v == null ? "" : String(v).trim());

async function comCall(key: string, payload: unknown, endpoint = ENDPOINT) {
  const r = await fetch(endpoint, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify(payload),
  });
  const t = await r.text();
  let body: any = t;
  try { body = JSON.parse(t); } catch { body = t.slice(0, 200); }
  return { status: r.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("COM_PRODUCT_HUB_WRITE_KEY") ?? "";
    if (!key) return json(500, { error: "Schlüssel für alix-lasers.com fehlt" });

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json(401, { error: "Nicht angemeldet" });
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json(401, { error: "Nicht angemeldet" });
    const { data: isAdmin } = await userClient.rpc("is_admin");
    let allowed = !!isAdmin;
    if (!allowed) {
      const { data: sa } = await userClient.rpc("has_role", { check_role: "Super Admin" });
      allowed = !!sa;
    }
    if (!allowed) return json(403, { error: "Nur Admin oder Super Admin dürfen an alix-lasers.com senden" });

    const parsed = z.object({ product_id: z.string().uuid(), dry_run: z.boolean().optional() }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json(400, { error: "Ungültige Anfrage" });
    const { product_id, dry_run = false } = parsed.data;

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: p } = await admin.from("ph_products").select("*").eq("id", product_id).maybeSingle();
    if (!p) return json(404, { error: "Gerät nicht gefunden" });
    const hubId = String(p.alix_product_id ?? "").trim();
    if (!hubId) return json(409, { error: "Gerät hat keine Alix-Produkt-ID" });
    const { data: map } = await admin.from("ph_lang_sync_map")
      .select("remote_product_id,verified_at").eq("product_id", product_id).eq("site_code", "com").maybeSingle();
    const target = String(map?.remote_product_id ?? "").trim();
    if (!target) return json(409, { error: "Für dieses Gerät ist keine Seite auf alix-lasers.com zugeordnet" });
    if (!map?.verified_at) return json(409, { error: "Zuordnung zu alix-lasers.com ist nicht bestätigt" });

    const fields: { field: string; value: unknown; status: string }[] = [];
    for (const [hub, remote] of Object.entries(FIELD_MAP)) {
      const v = (p as any)[hub];
      const list = toList(v);
      if (list) fields.push({ field: remote, value: list, status: "approved" });
      else if (typeof v === "string" && v.trim()) fields.push({ field: remote, value: v.trim(), status: "approved" });
    }
    if (!fields.length) return json(409, { error: "Keine Texte zum Senden vorhanden" });
    const ph = fields.filter((f) => PLACEHOLDER.test(norm(f.value))).map((f) => f.field);
    if (ph.length) return json(409, { error: `Platzhaltertext gefunden in: ${ph.join(", ")}` });

    const base: Record<string, unknown> = { hub_id: hubId, locale: "de", render: true, publish: true };
    if (UUID.test(target)) base.publish_id = target; else base.product_slug = target;

    const dry = await comCall(key, { ...base, dry_run: true, fields });
    const skipped = (dry.body?.skipped ?? []) as any[];
    if (dry.status >= 400 || skipped.length) {
      return json(502, { error: "alix-lasers.com hat den Probelauf abgelehnt", status: dry.status, skipped, response: dry.body });
    }
    if (dry_run) return json(200, { ok: true, dry_run: true, fields: fields.map((f) => f.field) });

    const write = await comCall(key, { ...base, dry_run: false, fields });
    const writeOk = write.status >= 200 && write.status < 300 && !write.body?.error;
    let mismatches: string[] = [];
    if (writeOk) {
      const check = await comCall(key, { ...base, dry_run: true, fields });
      const rows: any[] = check.body?.results ?? [];
      mismatches = fields.filter((f) => {
        const r = rows.find((x) => x.field === f.field);
        return !r || norm(r.previous_value) !== norm(f.value);
      }).map((f) => f.field);
    }
    const ok = writeOk && !mismatches.length;

    await admin.from("ph_sync_log").insert({
      channel_code: "com", action: "device_publish_de", status: ok ? "ok" : "error",
      payload: { product_id, target, fields: fields.map((f) => f.field), user_id: u.user.id },
      response: { write_status: write.status, mismatches, body: write.body },
    } as any);

    if (!writeOk) return json(502, { error: "alix-lasers.com hat das Schreiben abgelehnt", status: write.status, response: write.body });

    // Stammdaten: technische Werte + Hauptbild/Galerie (keine Preise). Probelauf, dann Speichern.
    const technical: Record<string, string> = {};
    for (const [hub, remote] of Object.entries(TECH_MAP)) {
      const v = (p as any)[hub];
      const t = Array.isArray(v) ? v.join(" / ") : v == null ? "" : String(v).trim();
      if (t) technical[remote] = t;
    }
    const main = typeof p.hero_image_url === "string" && p.hero_image_url.startsWith("https://") ? p.hero_image_url : null;
    const { data: media } = await admin.from("ph_media").select("url,kind,media_type,sort_order")
      .eq("product_id", product_id).order("sort_order");
    const gallery = (media ?? []).filter((m: any) => (m.media_type ?? m.kind) === "image" && typeof m.url === "string"
      && m.url.startsWith("https://") && m.url !== main).map((m: any) => m.url);
    const md: Record<string, unknown> = { hub_id: hubId, publish_id: crypto.randomUUID() };
    if (Object.keys(technical).length) md.technical = technical;
    if (main) { md.main_image = main; md.gallery = gallery; }
    let master: { ok: boolean; error?: string; fields?: string[] } = { ok: true, fields: [] };
    if (md.technical || md.main_image) {
      const mdDry = await comCall(key, { ...md, dry_run: true }, MASTER_ENDPOINT);
      if (mdDry.status >= 400 || mdDry.body?.error) {
        master = { ok: false, error: `Probelauf abgelehnt: ${mdDry.body?.error ?? mdDry.status}` };
      } else {
        const mdWrite = await comCall(key, { ...md, dry_run: false }, MASTER_ENDPOINT);
        master = mdWrite.status < 300 && !mdWrite.body?.error
          ? { ok: true, fields: [...Object.keys(technical), ...(main ? ["Bilder"] : [])] }
          : { ok: false, error: `Speichern abgelehnt: ${mdWrite.body?.error ?? mdWrite.status}` };
      }
      await admin.from("ph_sync_log").insert({
        channel_code: "com", action: "device_publish_master", status: master.ok ? "ok" : "error",
        payload: { product_id, publish_id: md.publish_id, technical: Object.keys(technical), images: main ? 1 + gallery.length : 0, user_id: u.user.id },
        response: master,
      } as any);
    }
    return json(200, { ok: ok && master.ok, sent: fields.map((f) => f.field), mismatches, master });
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? (() => { try { return JSON.stringify(e); } catch { return String(e); } })();
    console.error("ph-com-publish-device failed:", msg);
    return json(500, { error: msg || "Unbekannter Fehler" });
  }
});
