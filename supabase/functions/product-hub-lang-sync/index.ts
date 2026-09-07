// ALIXWORK PRODUCT HUB – Website-Sprachen synchronisieren
// Der Product Hub ist alleinige Quelle. Es wird NIEMALS von einer Website
// zurueck in den Hub geschrieben. Aktionen:
//   targets   – Zielzuordnung + Struktur-Pruefung je Sprache (kein Schreiben)
//   preview   – feldweise Vorschau Website ↔ Product Hub (kein Schreiben)
//   dryrun    – vollstaendige Simulation, protokolliert als mode=dry_run
//   publish   – produktiver Sprach-Sync (nur bei freigegebenem Ziel + Status)
//   rollback  – exakte Ruecknahme genau einer Sync-ID, konfliktgeschuetzt
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const UA = "Mozilla/5.0 (compatible; AlixWorkProductHub/1.0)";
const COM_SUPABASE_URL = "https://dxbrovbbwrtdsimdnrpy.supabase.co";
const COM_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4YnJvdmJid3J0ZHNpbWRucnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MTQwMjEsImV4cCI6MjA5MjQ5MDAyMX0.z85uwvZravQhPi7qx9pRdjDY6C0JSKMdaKCNp5Poeo4";

// Nur redaktionelle Felder. Technische Werte werden hier NIE angefasst.
const TEXT_FIELDS = [
  "name",
  "short_description",
  "long_description",
  "marketing_text",
  "seo_title",
  "seo_description",
] as const;
const LIST_FIELDS = ["highlights", "benefits", "applications", "treatments", "features"] as const;
const ALL_FIELDS = [...TEXT_FIELDS, ...LIST_FIELDS];

// Freigegebene Status fuer produktiven Sync. ai_draft/review NIEMALS.
const PUBLISHABLE = new Set(["approved", "published"]);

const asText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join(" | ") || null;
  const s = String(v).trim();
  return s ? s : null;
};
const norm = (s: string | null) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[.,;]+$/g, "").trim();

function deepGet(obj: any, path: string): any {
  return path.split(".").reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), obj);
}

/** Container fuer sprachabhaengige Inhalte auf dem Ziel suchen (nie raten, nur bekannte Pfade). */
const LOCALE_CONTAINERS = ["translations", "i18n", "locales", "product_hub.translations", "product_hub.i18n"];
function findLocaleContainer(remote: any, locale: string): { path: string; data: any } | null {
  for (const p of LOCALE_CONTAINERS) {
    const c = deepGet(remote, p);
    if (c && typeof c === "object" && c[locale] && typeof c[locale] === "object") {
      return { path: `${p}.${locale}`, data: c[locale] };
    }
  }
  return null;
}

async function fetchComProduct(remoteId: string) {
  const url = `${COM_SUPABASE_URL}/rest/v1/devices?select=*&id=eq.${encodeURIComponent(remoteId)}`;
  const res = await fetch(url, {
    headers: {
      apikey: COM_PUBLISHABLE_KEY,
      Authorization: `Bearer ${COM_PUBLISHABLE_KEY}`,
      Accept: "application/json",
      "User-Agent": UA,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zielsystem antwortete ${res.status}: ${text.slice(0, 160)}`);
  const list = JSON.parse(text);
  const hit = Array.isArray(list) ? list.find((p: any) => String(p?.id) === remoteId) : null;
  if (!hit) throw new Error(`Zielprodukt ${remoteId} nicht gefunden – keine Zuordnung über Name oder Slug erlaubt`);
  return hit;
}

async function writeCall(endpoint: string, secretName: string, body: Record<string, unknown>, dryRun: boolean) {
  const key = Deno.env.get(secretName) || "";
  if (!key) return { status: 0, ok: false, body: { error: `${secretName} fehlt` } };
  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: { "x-api-key": key, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ publish_id: `alixwork-lang-${Date.now()}`, target: "product_hub", ...body, dry_run: dryRun }),
  });
  const raw = await res.text();
  let parsed: any = raw;
  try { parsed = JSON.parse(raw); } catch { /* text */ }
  return { status: res.status, ok: res.ok, body: parsed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Nicht angemeldet" });
    // Interner Server-zu-Server-Aufruf (Selbsttest) mit Service-Role-Key
    const internal = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let userId: string | null = null;
    if (!internal) {
      const { data: userRes } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }).auth.getUser();
      const user = userRes?.user;
      if (!user) return json(401, { error: "Nicht angemeldet" });
      userId = user.id;
      const { data: roleRows } = await admin.from("user_roles").select("roles(name)").eq("user_id", user.id);
      const roles = (roleRows || []).map((r: any) => r.roles?.name).filter(Boolean);
      const isAdmin = roles.some((r: string) => ["Super Admin", "Admin", "Product Hub"].includes(r));
      if (!isAdmin) return json(403, { error: "Keine Berechtigung" });
    }


    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "targets");
    const productId: string = body.productId || "";
    const locale: string = body.locale || "";

    // ---------- Zielzuordnung / Strukturpruefung ----------
    const { data: targets } = await admin.from("ph_lang_sync_targets").select("*").order("locale");

    if (action === "targets") {
      const out: any[] = [];
      for (const t of targets || []) {
        const probe: any = { ...t, reachable: null, http: null, locale_container: null };
        try {
          const res = await fetch(t.base_url + (t.path_prefix || "") || t.base_url, {
            method: "GET", redirect: "follow", headers: { "User-Agent": UA },
          });
          probe.http = res.status;
          probe.reachable = res.ok;
        } catch (e) {
          probe.reachable = false;
          probe.http_error = String(e).slice(0, 120);
        }
        if (productId && t.target_system === "com_devices") {
          const { data: map } = await admin.from("ph_lang_sync_map")
            .select("*").eq("product_id", productId).eq("site_code", "com").maybeSingle();
          if (map) {
            try {
              const remote = await fetchComProduct(map.remote_product_id);
              const c = findLocaleContainer(remote, t.locale);
              probe.locale_container = c?.path || null;
              probe.remote_found = true;
            } catch (e) { probe.remote_error = String(e).slice(0, 160); probe.remote_found = false; }
          } else probe.remote_found = false;
        }
        out.push(probe);
      }
      return json(200, { targets: out });
    }

    if (!productId || !locale) return json(400, { error: "Gerät und Sprache erforderlich" });

    const { data: product } = await admin.from("ph_products").select("*").eq("id", productId).maybeSingle();
    if (!product) return json(404, { error: "Gerät nicht gefunden" });
    const target = (targets || []).find((t: any) => t.locale === locale);
    if (!target) return json(400, { error: `Keine Zielzuordnung für Sprache ${locale}` });

    // ---------- Rollback ----------
    if (action === "rollback") {
      const runId = String(body.runId || "");
      const { data: run } = await admin.from("ph_lang_sync_runs").select("*").eq("id", runId).maybeSingle();
      if (!run) return json(404, { error: "Sync-ID nicht gefunden" });
      if (run.mode !== "publish" || run.result !== "ok")
        return json(400, { error: "Nur erfolgreiche produktive Syncs können zurückgenommen werden" });
      if (run.rolled_back_at) return json(400, { error: "Dieser Sync wurde bereits zurückgenommen" });
      const { data: later } = await admin.from("ph_lang_sync_runs")
        .select("id, created_at").eq("product_id", run.product_id).eq("locale", run.locale)
        .eq("mode", "publish").eq("result", "ok").gt("created_at", run.created_at);
      if ((later || []).length && !body.force)
        return json(409, {
          error: "Nach diesem Sync gab es weitere Übertragungen – kein blinder Rollback",
          conflicts: later,
        });
      const { data: fields } = await admin.from("ph_lang_sync_fields").select("*").eq("run_id", runId).eq("action", "change");
      const { data: map } = await admin.from("ph_lang_sync_map")
        .select("*").eq("product_id", run.product_id).eq("site_code", run.site_code).maybeSingle();
      const restored: any[] = [];
      const errors: string[] = [];
      const { data: rbRun } = await admin.from("ph_lang_sync_runs").insert({
        product_id: run.product_id, locale: run.locale, site_code: run.site_code, site_label: run.site_label,
        target_url: run.target_url, remote_product_id: run.remote_product_id, mode: "rollback",
        result: "pending", rolled_back_run_id: run.id, created_by: user.id,
      }).select().single();
      for (const f of fields || []) {
        const r = await writeCall(target.write_endpoint!, target.write_secret_name!, {
          product_id: map?.remote_product_id, field: f.remote_field, value: f.value_before, locale: run.locale,
        }, false);
        const ok = r.ok;
        if (!ok) errors.push(`${f.field}: HTTP ${r.status}`);
        restored.push({ field: f.field, ok });
        await admin.from("ph_lang_sync_fields").insert({
          run_id: rbRun!.id, field: f.field, remote_field: f.remote_field,
          value_before: f.value_after, value_after: f.value_before,
          action: ok ? "restored" : "failed", write_status: String(r.status),
        });
      }
      await admin.from("ph_lang_sync_runs").update({
        result: errors.length ? "failed" : "rolled_back",
        errors, fields_changed: restored.filter((r) => r.ok).length,
      }).eq("id", rbRun!.id);
      await admin.from("ph_lang_sync_runs").update({
        result: errors.length ? run.result : "rolled_back", rolled_back_at: new Date().toISOString(),
      }).eq("id", run.id);
      return json(200, { runId: rbRun!.id, restored, errors });
    }

    // ---------- Vorbereitung Vorschau / Dry-Run / Publish ----------
    const warnings: string[] = [];
    const errors: string[] = [];

    const { data: map } = await admin.from("ph_lang_sync_map")
      .select("*").eq("product_id", productId).eq("site_code", target.site_code === "com" ? "com" : "com").maybeSingle();

    const { data: tr } = await admin.from("ph_product_translations")
      .select("*").eq("product_id", productId).eq("locale", locale).maybeSingle();

    const isMaster = locale === "de";
    const trStatus = isMaster ? "master" : (tr?.status || "missing");
    const approved = isMaster || (tr && (PUBLISHABLE.has(tr.status) || (tr.status === "outdated" && tr.approved_at)));
    let fallbackDetected = false;

    // Quelle je Feld – NIEMALS deutscher Fallback fuer Fremdsprachen
    const source: Record<string, string | null> = {};
    for (const f of ALL_FIELDS) {
      if (isMaster) { source[f] = asText((product as any)[f]); continue; }
      const v = asText(tr ? (tr as any)[f] : null);
      if (v) source[f] = v;
      else {
        source[f] = null;
        if (asText((product as any)[f])) fallbackDetected = true;
      }
    }

    if (!tr && !isMaster) errors.push(`Keine ${locale.toUpperCase()}-Übersetzung vorhanden – nichts zu synchronisieren`);
    if (tr && !approved)
      errors.push(`Übersetzung ist „${trStatus}“ – nicht freigegeben. KI-Entwurf oder Prüfung wird nie veröffentlicht.`);
    if (fallbackDetected)
      warnings.push(`Einzelne Felder haben keine ${locale.toUpperCase()}-Fassung – deutscher Fallback wird NICHT synchronisiert.`);
    if (tr?.status === "outdated")
      warnings.push("Übersetzung ist als „möglicherweise veraltet“ markiert – die bestehende Website-Fassung bleibt online, ein Überschreiben ist gesperrt.");

    if (!map) errors.push("Keine eindeutige Zuordnung Hub-ID → Zielprodukt – Sync nicht möglich");
    if (target.structure_status !== "ready" || !target.publish_enabled)
      warnings.push(`Zielstruktur „${target.site_label}“ ist für produktives Veröffentlichen noch nicht freigegeben (Status: ${target.structure_status}).`);

    // Ziel lesen
    let remote: any = null;
    let containerPath: string | null = null;
    let current: Record<string, string | null> = {};
    if (map && target.target_system === "com_devices") {
      try {
        remote = await fetchComProduct(map.remote_product_id);
        const c = findLocaleContainer(remote, locale);
        containerPath = c?.path || null;
        if (c) for (const f of ALL_FIELDS) current[f] = asText(c.data[f]);
        else if (isMaster) {
          current = { name: asText(remote.model_name), short_description: asText(remote.features) } as any;
        } else {
          errors.push(`Auf ${target.site_label} existiert bisher kein Sprachcontainer für ${locale.toUpperCase()} – Zielstruktur fehlt.`);
        }
      } catch (e) { errors.push(String(e).slice(0, 200)); }
    } else if (map) {
      errors.push(`Für ${target.site_label} ist kein technischer Schreibweg hinterlegt.`);
    }

    // Feldweiser Plan
    const plan = ALL_FIELDS.map((f) => {
      const hub = source[f];
      const site = current[f] ?? null;
      let act: "change" | "unchanged" | "blocked" = "unchanged";
      let msg = "";
      if (!hub) { act = "blocked"; msg = `Keine freigegebene ${locale.toUpperCase()}-Fassung – deutscher Fallback wird nicht übertragen`; }
      else if (norm(hub) !== norm(site)) act = "change";
      return {
        field: f,
        remote_field: containerPath ? `${containerPath}.${f}` : `translations.${locale}.${f}`,
        site, hub, action: act, message: msg,
      };
    });
    const changed = plan.filter((p) => p.action === "change");
    const unchanged = plan.filter((p) => p.action === "unchanged");
    const blocked = plan.filter((p) => p.action === "blocked");

    const publishAllowed =
      !!approved && !!map && errors.length === 0 && changed.length > 0 &&
      target.publish_enabled === true && target.structure_status === "ready" &&
      tr?.status !== "outdated";

    const summary = {
      source: "Product Hub",
      product: product.name,
      hub_id: product.id,
      locale,
      site: target.site_label,
      target_url: (target.base_url + (target.path_prefix || "")) as string,
      remote_product_id: map?.remote_product_id || null,
      target_found: !!remote,
      locale_container: containerPath,
      translation_status: trStatus,
      fields_checked: plan.length,
      fields_changed: changed.length,
      fields_unchanged: unchanged.length,
      fields_blocked: blocked.length,
      fallback_detected: fallbackDetected,
      publish_allowed: publishAllowed,
    };

    if (action === "preview") return json(200, { plan, summary, warnings, errors });

    // ---------- Dry-Run ----------
    if (action === "dryrun") {
      const { data: run } = await admin.from("ph_lang_sync_runs").insert({
        product_id: productId, locale, site_code: target.site_code, site_label: target.site_label,
        target_url: summary.target_url, remote_product_id: map?.remote_product_id || null,
        mode: "dry_run", result: errors.length ? "blocked" : "ok",
        translation_status: trStatus, fallback_detected: fallbackDetected, publish_allowed: publishAllowed,
        fields_checked: plan.length, fields_changed: changed.length, fields_unchanged: unchanged.length,
        warnings, errors, summary, created_by: user.id,
      }).select().single();
      if (run && plan.length) {
        await admin.from("ph_lang_sync_fields").insert(plan.map((p) => ({
          run_id: run.id, field: p.field, remote_field: p.remote_field,
          value_before: p.site, value_after: p.hub,
          action: p.action, message: p.message || null, write_status: "dry_run",
        })));
      }
      // Zusaetzlich beim Ziel als dry_run anklopfen, ohne Daten zu aendern
      let endpointProbe: any = null;
      if (map && target.write_endpoint && target.write_secret_name && changed.length) {
        const r = await writeCall(target.write_endpoint, target.write_secret_name, {
          product_id: map.remote_product_id, field: changed[0].remote_field, value: changed[0].hub, locale,
        }, true);
        endpointProbe = { status: r.status, ok: r.ok, detail: typeof r.body === "string" ? r.body.slice(0, 160) : r.body };
      }
      return json(200, { runId: run?.id, plan, summary, warnings, errors, endpointProbe });
    }

    // ---------- Produktiver Sync ----------
    if (action === "publish") {
      if (!publishAllowed) {
        const reason = tr?.status === "outdated"
          ? "Übersetzung ist als veraltet markiert – bitte erneut prüfen und freigeben."
          : !approved
            ? `${locale === "ar" ? "Arabische" : locale.toUpperCase()} Übersetzung nicht freigegeben – deutscher Fallback wurde nicht synchronisiert.`
            : errors[0] || "Zielstruktur nicht freigegeben";
        await admin.from("ph_lang_sync_runs").insert({
          product_id: productId, locale, site_code: target.site_code, site_label: target.site_label,
          target_url: summary.target_url, remote_product_id: map?.remote_product_id || null,
          mode: "publish", result: "blocked", translation_status: trStatus,
          fallback_detected: fallbackDetected, publish_allowed: false,
          fields_checked: plan.length, fields_changed: 0, fields_unchanged: unchanged.length,
          warnings, errors: [...errors, reason], summary, created_by: user.id,
        });
        return json(409, { error: reason, warnings, errors });
      }
      const { data: run } = await admin.from("ph_lang_sync_runs").insert({
        product_id: productId, locale, site_code: target.site_code, site_label: target.site_label,
        target_url: summary.target_url, remote_product_id: map!.remote_product_id,
        mode: "publish", result: "pending", translation_status: trStatus,
        fallback_detected: fallbackDetected, publish_allowed: true,
        fields_checked: plan.length, fields_unchanged: unchanged.length,
        warnings, summary, created_by: user.id,
      }).select().single();
      const wErrors: string[] = [];
      let done = 0;
      for (const p of changed) {
        const r = await writeCall(target.write_endpoint!, target.write_secret_name!, {
          product_id: map!.remote_product_id, field: p.remote_field, value: p.hub, locale,
        }, false);
        if (r.ok) done++; else wErrors.push(`${p.field}: HTTP ${r.status}`);
        await admin.from("ph_lang_sync_fields").insert({
          run_id: run!.id, field: p.field, remote_field: p.remote_field,
          value_before: p.site, value_after: p.hub,
          action: r.ok ? "change" : "failed", write_status: String(r.status),
        });
      }
      await admin.from("ph_lang_sync_runs").update({
        result: wErrors.length ? "failed" : "ok", fields_changed: done, errors: wErrors,
      }).eq("id", run!.id);
      if (!wErrors.length && tr) {
        await admin.from("ph_product_translations").update({ status: "published" }).eq("id", tr.id);
      }
      return json(200, { runId: run!.id, published: done, errors: wErrors, warnings });
    }

    return json(400, { error: `Unbekannte Aktion ${action}` });
  } catch (e) {
    return json(500, { error: String(e).slice(0, 300) });
  }
});
