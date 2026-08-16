// ALIXWORK PRODUCT HUB – Phase-B-Validierung & Phase-C-Readiness.
// Reine Prüfung: es wird NICHTS am Produktbestand geändert, nichts gelöscht, nichts überschrieben.
// Ergebnis wird in ph_validation_runs protokolliert.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DE_ENDPOINT = "https://alix-legacy-reborn.lovable.app/api/public/product-hub/export";
const REFERENCE = ["blueice", "lumina", "shark", "secrettwin", "revita"];
const norm = (s?: string | null) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Gewichtete Vollständigkeitskriterien je Gerät (Summe = 100) */
const CRITERIA: { key: string; label: string; weight: number }[] = [
  { key: "alix_product_id", label: "ALIX Product ID", weight: 6 },
  { key: "name", label: "Produktname", weight: 8 },
  { key: "model", label: "Modell", weight: 6 },
  { key: "slug", label: "Slug", weight: 5 },
  { key: "categories", label: "Kategorien", weight: 5 },
  { key: "applications", label: "Anwendungen", weight: 5 },
  { key: "description", label: "Beschreibung", weight: 8 },
  { key: "tech_specs", label: "Technische Daten", weight: 12 },
  { key: "hero", label: "Hauptbild", weight: 8 },
  { key: "gallery", label: "Galerie", weight: 6 },
  { key: "documents", label: "Dokumente", weight: 6 },
  { key: "seo_de", label: "SEO DE", weight: 8 },
  { key: "publish_de", label: "Veröffentlichungsstatus DE", weight: 8 },
  { key: "smart_ki", label: "Smart KI", weight: 5 },
  { key: "source", label: "Datenquelle", weight: 4 },
];

const nonEmpty = (v: unknown) =>
  v !== null && v !== undefined && !(typeof v === "string" && !v.trim()) &&
  !(Array.isArray(v) && v.length === 0) &&
  !(typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

async function head(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number | string }> {
  try {
    new URL(url);
  } catch {
    return { ok: false, status: "invalid_url" };
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    let r = await fetch(url, { method: "HEAD", signal: ctl.signal, redirect: "follow" });
    if (r.status === 405 || r.status === 403) {
      r = await fetch(url, { method: "GET", signal: ctl.signal, redirect: "follow", headers: { Range: "bytes=0-64" } });
    }
    return { ok: r.status < 400, status: r.status };
  } catch (e) {
    return { ok: false, status: (e as Error).name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(t);
  }
}

async function pool<T, R>(items: T[], size: number, fn: (i: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const checkUrls = body.check_urls !== false;
    const compareLive = body.compare_live !== false;

    const [{ data: products }, { data: media }, { data: documents }, { data: conflicts }] = await Promise.all([
      supabase.from("ph_products").select("*").neq("status", "archived").order("name"),
      supabase.from("ph_media").select("*"),
      supabase.from("ph_documents").select("*"),
      supabase.from("ph_conflicts").select("id,product_id,status"),
    ]);

    const prods = products || [];
    const mediaRows = media || [];
    const docRows = documents || [];
    const openConflicts = (conflicts || []).filter((c: any) => c.status !== "resolved");

    // ---------- 4. Medienprüfung ----------
    const seenUrl = new Map<string, number>();
    for (const m of mediaRows) seenUrl.set(m.url || "", (seenUrl.get(m.url || "") || 0) + 1);
    const mediaChecks = checkUrls
      ? await pool(mediaRows, 12, async (m: any) => {
          const r = await head(m.url || "");
          return { id: m.id, product_id: m.product_id, url: m.url, kind: m.kind, ...r };
        })
      : mediaRows.map((m: any) => ({ id: m.id, product_id: m.product_id, url: m.url, kind: m.kind, ok: true, status: "skipped" }));
    const mediaReport = mediaChecks.map((c: any) => ({
      ...c,
      duplicate: (seenUrl.get(c.url || "") || 0) > 1,
      orphan: !c.product_id,
      state: !c.product_id ? "ohne Produktzuordnung"
        : c.status === "invalid_url" ? "ungültige URL"
        : c.status === 404 ? "404"
        : c.ok ? ((seenUrl.get(c.url || "") || 0) > 1 ? "Duplikat" : "erreichbar")
        : "nicht erreichbar",
    }));

    // ---------- 5. Dokumentenprüfung ----------
    const docChecks = checkUrls
      ? await pool(docRows, 12, async (d: any) => {
          const r = await head(d.url || "");
          return { id: d.id, product_id: d.product_id, title: d.title, doc_type: d.doc_type, visibility: d.visibility, url: d.url, ...r };
        })
      : docRows.map((d: any) => ({ id: d.id, product_id: d.product_id, title: d.title, doc_type: d.doc_type, visibility: d.visibility, url: d.url, ok: true, status: "skipped" }));
    const docReport = docChecks.map((d: any) => ({
      ...d,
      filename: (() => { try { return decodeURIComponent(new URL(d.url).pathname.split("/").pop() || ""); } catch { return ""; } })(),
      orphan: !d.product_id,
      // Regulatorische Dokumente aus dem Webseitenimport bleiben "website" – kein Master-Status.
      regulatory_claim: d.visibility === "regulatory",
      state: !d.product_id ? "ohne Produktzuordnung"
        : d.status === "invalid_url" ? "ungültige URL"
        : d.status === 404 ? "404"
        : d.ok ? "erreichbar" : "nicht erreichbar",
    }));

    const mediaByProduct = new Map<string, any[]>();
    for (const m of mediaRows) {
      const k = m.product_id;
      if (!k) continue;
      mediaByProduct.set(k, [...(mediaByProduct.get(k) || []), m]);
    }
    const docsByProduct = new Map<string, any[]>();
    for (const d of docRows) {
      const k = d.product_id;
      if (!k) continue;
      docsByProduct.set(k, [...(docsByProduct.get(k) || []), d]);
    }
    const mediaErrByProduct = new Map<string, number>();
    for (const m of mediaReport) {
      if (!m.ok && m.product_id) mediaErrByProduct.set(m.product_id, (mediaErrByProduct.get(m.product_id) || 0) + 1);
    }

    // ---------- 1. Vollständigkeit & Quality Score ----------
    const productReport = prods.map((p: any) => {
      const ms = mediaByProduct.get(p.id) || [];
      const ds = docsByProduct.get(p.id) || [];
      const gallery = ms.filter((m) => m.media_type !== "video");
      const values: Record<string, unknown> = {
        alix_product_id: p.alix_product_id,
        name: p.name,
        model: p.model,
        slug: p.slug,
        categories: p.categories,
        applications: p.applications,
        description: p.short_description || p.long_description,
        tech_specs: p.tech_specs,
        hero: p.hero_image_url || ms.find((m) => m.is_primary || m.kind === "hero")?.url,
        gallery: gallery.length > 1 ? gallery : null,
        documents: ds,
        seo_de: p.seo_title && p.seo_description ? "ok" : null,
        publish_de: p.status === "published" || p.active_de ? "ok" : null,
        smart_ki: p.smart_ki,
        source: p.source_product_id || p.alix_product_id,
      };
      const missing: string[] = [];
      let score = 0;
      for (const c of CRITERIA) {
        if (nonEmpty(values[c.key])) score += c.weight;
        else missing.push(c.label);
      }
      const status = score >= 90 ? "green" : score >= 70 ? "amber" : "red";
      const techFields = ["wavelengths", "power", "cooling", "fluence", "pulse_duration", "frequency", "spot_sizes", "laser_class"];
      const techMissing = techFields.filter((f) => !nonEmpty(p[f]));
      return {
        id: p.id, name: p.name, model: p.model, alix_product_id: p.alix_product_id, slug: p.slug,
        score, status, missing,
        manual_override: !!p.manual_override, protected: !!p.protected,
        media_count: ms.length, media_errors: mediaErrByProduct.get(p.id) || 0, document_count: ds.length,
        tech: {
          specs: nonEmpty(p.tech_specs), wavelengths: p.wavelengths, power: p.power, cooling: p.cooling,
          fluence: p.fluence, pulse_duration: p.pulse_duration, frequency: p.frequency,
          spot_sizes: p.spot_sizes, laser_class: p.laser_class,
          missing: techMissing, review: techMissing.length > 0,
        },
        readiness: {
          de: score >= 90 && !!p.seo_title && !!p.seo_description && (mediaErrByProduct.get(p.id) || 0) === 0 && ms.length > 0,
          com: score >= 90 && ms.length > 0 && nonEmpty(p.short_description || p.long_description),
          master: score >= 90 && techMissing.length === 0 && !!p.intended_use && !!p.laser_class &&
            !openConflicts.some((c: any) => c.product_id === p.id),
        },
      };
    });

    // ---------- 2. Referenzgeräte gegen DE LIVE ----------
    let referenceDiff: any[] = [];
    let liveError: string | null = null;
    if (compareLive) {
      try {
        const key = Deno.env.get("DE_EXPORT_API_KEY") || "";
        const r = await fetch(DE_ENDPOINT, { headers: { "x-api-key": key } });
        if (!r.ok) throw new Error(`DE Export HTTP ${r.status}`);
        const payload = await r.json();
        const liveList: any[] = payload.products || payload.data || [];
        const cmpFields: [string, (p: any) => unknown, (l: any) => unknown][] = [
          ["Name", (p) => p.name, (l) => l.product_name || l.name],
          ["Modell", (p) => p.model, (l) => l.model || l.modell],
          ["Technische Daten", (p) => p.tech_specs, (l) => l.specs || l.tech_specs],
          ["Wellenlängen", (p) => p.wavelengths, (l) => l.wavelengths || l.specs?.wavelengths],
          ["Leistung", (p) => p.power, (l) => l.power || l.specs?.power],
          ["Kühlung", (p) => p.cooling, (l) => l.cooling || l.specs?.cooling],
          ["Features", (p) => p.features, (l) => l.features],
          ["Smart KI", (p) => p.smart_ki, (l) => l.smart_ai || l.smart_ki],
          ["Anwendungen", (p) => p.applications, (l) => l.application_categories || l.applications],
          ["Bilder", (p) => (mediaByProduct.get(p.id) || []).filter((m) => m.media_type !== "video").length, (l) => (l.images || l.media || []).length],
          ["Videos", (p) => (mediaByProduct.get(p.id) || []).filter((m) => m.media_type === "video").length, (l) => (l.videos || []).length],
          ["Dokumente", (p) => (docsByProduct.get(p.id) || []).length, (l) => (l.documents || l.downloads || []).length],
          ["SEO Titel", (p) => p.seo_title, (l) => l.seo_title || l.seo?.title],
          ["SEO Beschreibung", (p) => p.seo_description, (l) => l.seo_description || l.seo?.description],
        ];
        for (const refKey of REFERENCE) {
          const master = prods.find((p: any) => norm(p.name).includes(refKey) || norm(p.model || "").includes(refKey));
          const live = liveList.find((l: any) => norm(l.product_name || l.name).includes(refKey));
          const fields = master && live
            ? cmpFields.map(([label, mf, lf]) => {
                const mv = mf(master), lv = lf(live);
                const same = JSON.stringify(mv ?? null) === JSON.stringify(lv ?? null);
                return { field: label, master: mv ?? null, live: lv ?? null, equal: same };
              })
            : [];
          referenceDiff.push({
            key: refKey,
            name: master?.name || live?.product_name || refKey,
            found_master: !!master, found_live: !!live,
            product_id: master?.id || null,
            diffs: fields.filter((f) => !f.equal).length,
            fields,
          });
        }
      } catch (e) {
        liveError = (e as Error).message;
      }
    }

    // ---------- 3. Manual Override ----------
    const overrideProducts = prods.filter((p: any) => p.manual_override || p.protected);
    const overrides = overrideProducts.flatMap((p: any) => {
      const ref = referenceDiff.find((r) => r.product_id === p.id);
      const crit = ["wavelengths", "power", "cooling", "laser_class", "intended_use", "mdr_status", "ce_status"];
      return crit.filter((f) => nonEmpty(p[f])).map((f) => ({
        product: p.name, product_id: p.id, field: f,
        master_value: p[f],
        live_value: ref?.fields.find((x: any) => norm(x.field) === norm(f))?.live ?? null,
        reason: p.manual_override ? "Manual Override (Import geschützt)" : "Produkt als geschützt markiert",
      }));
    });

    // ---------- 7. Channel Readiness ----------
    const summary = {
      total: prods.length,
      green: productReport.filter((p) => p.status === "green").length,
      amber: productReport.filter((p) => p.status === "amber").length,
      red: productReport.filter((p) => p.status === "red").length,
      avg_score: prods.length ? Math.round(productReport.reduce((s, p) => s + p.score, 0) / prods.length) : 0,
      de_ready: productReport.filter((p) => p.readiness.de).length,
      com_ready: productReport.filter((p) => p.readiness.com).length,
      master_ready: productReport.filter((p) => p.readiness.master).length,
      review_required: productReport.filter((p) => p.status !== "green" || p.tech.review).length,
      media_total: mediaRows.length,
      media_errors: mediaReport.filter((m: any) => !m.ok).length,
      media_duplicates: mediaReport.filter((m: any) => m.duplicate).length,
      media_orphans: mediaReport.filter((m: any) => m.orphan).length,
      documents_total: docRows.length,
      document_errors: docReport.filter((d: any) => !d.ok).length,
      document_orphans: docReport.filter((d: any) => d.orphan).length,
      tech_reviews: productReport.filter((p) => p.tech.review).length,
      manual_overrides: overrideProducts.length,
      conflicts: openConflicts.length,
      reference_diffs: referenceDiff.reduce((s, r) => s + (r.diffs || 0), 0),
      live_error: liveError,
    };

    // ---------- 12. Go / No-Go ----------
    const blockers: string[] = [];
    if (summary.master_ready < summary.total) blockers.push(`${summary.total - summary.master_ready} Geräte sind noch nicht Master-ready`);
    if (summary.media_errors > 0) blockers.push(`${summary.media_errors} Medien nicht erreichbar`);
    if (summary.document_errors > 0) blockers.push(`${summary.document_errors} Dokumente nicht erreichbar`);
    if (summary.tech_reviews > 0) blockers.push(`${summary.tech_reviews} Geräte mit unvollständigen technischen Daten (kein Auffüllen erlaubt)`);
    if (summary.conflicts > 0) blockers.push(`${summary.conflicts} offene Konflikte`);
    if (liveError) blockers.push(`DE-Live-Vergleich nicht möglich: ${liveError}`);
    const recommendation = blockers.length === 0 ? "GO" : "NO-GO";
    const reason = blockers.length === 0
      ? "Alle Geräte sind Master-, DE- und COM-ready; Medien, Dokumente und technische Daten vollständig geprüft."
      : blockers.join(" · ");

    const { data: run } = await supabase.from("ph_validation_runs").insert({
      phase: "B",
      summary, products: productReport, media: mediaReport, documents: docReport,
      reference_diff: referenceDiff, overrides, recommendation, reason,
    }).select("id,created_at").maybeSingle();

    await supabase.from("ph_sync_log").insert({
      direction: "internal", operation: "validate", status: recommendation === "GO" ? "success" : "warning",
      message: `Phase-B-Validierung: ${recommendation} – ${reason}`.slice(0, 500),
    });

    return json(200, { run_id: run?.id, created_at: run?.created_at, summary, products: productReport, media: mediaReport, documents: docReport, reference_diff: referenceDiff, overrides, recommendation, reason, blockers });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
