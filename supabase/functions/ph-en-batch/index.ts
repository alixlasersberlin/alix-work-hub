// TEMPORÄR: Interner Batchlauf zur englischen Erstübersetzung des Product-Hub-Katalogs.
// Läuft mit Service Role, speichert ausschließlich KI-Entwürfe (ai_draft) + Quality Check.
import { createClient } from "npm:@supabase/supabase-js@2";
import { qaCheck } from "../_shared/ph-qa.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const LOV_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const TEXT_FIELDS = [
  "name", "short_description", "long_description", "marketing_text", "notices",
  "seo_title", "seo_description", "intended_use", "product_group_label",
];
const LIST_FIELDS = ["highlights", "benefits", "applications", "treatments", "features"];

async function generate(prompt: string, system: string): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOV_KEY, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: "openai/gpt-5.6-sol", instructions: system, input: prompt, stream: true }),
  });
  if (!r.ok || !r.body) throw new Error((await r.text().catch(() => "")).slice(0, 200) || `AI ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const p = t.slice(5).trim();
      if (!p || p === "[DONE]") continue;
      try {
        const evt = JSON.parse(p);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") out += evt.delta;
        else if (evt.type === "response.completed" && !out) out = evt.response?.output_text ?? "";
      } catch { /* partial */ }
    }
  }
  return out.trim();
}

function parseJson(raw: string) {
  const s = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("KI-Antwort war kein JSON");
  return JSON.parse(s.slice(a, b + 1));
}

const asList = (v: unknown) => (Array.isArray(v) ? v.slice(0, 30) : []);

/** Nur Qualitätscheck neu berechnen – ohne die Übersetzungen zu verändern. */
async function requalify(admin: any) {
  const { data: glossary } = await admin.from("ph_glossary").select("term,mode").eq("active", true);
  const protectedTerms = (glossary ?? []).filter((g: any) => g.mode === "protected").map((g: any) => g.term);
  const { data: prods } = await admin.from("ph_products")
    .select("id,name,model,sku,short_description,long_description,features,applications,intended_use,seo_title,seo_description,product_group,laser_class,wavelengths,power,fluence,pulse_duration,frequency,spot_sizes,cooling");
  const out: any[] = [];
  for (const p of prods ?? []) {
    const { data: trs } = await admin.from("ph_product_translations").select("*").eq("product_id", p.id);
    const byLocale = Object.fromEntries((trs ?? []).map((r: any) => [r.locale, r]));
    const en = byLocale["en"];
    if (!en) continue;
    const de = byLocale["de"] ?? {};
    const source = {
      name: de.name || p.name,
      short_description: de.short_description || p.short_description,
      long_description: de.long_description || p.long_description,
      highlights: de.highlights?.length ? de.highlights : (Array.isArray(p.features) ? p.features : []),
      benefits: de.benefits ?? [],
      applications: de.applications?.length ? de.applications : (Array.isArray(p.applications) ? p.applications : []),
      treatments: de.treatments ?? [],
      features: de.features?.length ? de.features : (Array.isArray(p.features) ? p.features : []),
      marketing_text: de.marketing_text ?? null,
      notices: de.notices ?? null,
      seo_title: de.seo_title || p.seo_title,
      seo_description: de.seo_description || p.seo_description,
      intended_use: de.intended_use || p.intended_use,
      product_group_label: de.product_group_label || p.product_group,
    };
    const context = [p.model, p.sku, p.wavelengths, p.power, p.fluence, p.pulse_duration, p.frequency, p.spot_sizes, p.cooling].filter(Boolean).join(" ");
    const qa = qaCheck({ source, target: en, locale: "en", model: p.model, brands: protectedTerms, context });
    await admin.from("ph_translation_qa").upsert({
      product_id: p.id, locale: "en", status: qa.status, score: qa.score,
      issues: qa.issues, checked_at: new Date().toISOString(),
    }, { onConflict: "product_id,locale" });
    out.push({ name: p.name, qa: qa.status, score: qa.score });
  }
  return { requalified: out.length, results: out };
}

async function runBatch(admin: any, offset: number, limit: number, overwrite: boolean, productIds?: string[]) {
  {
    const { data: glossary } = await admin.from("ph_glossary").select("term,mode,translations").eq("active", true);
    const protectedTerms = (glossary ?? []).filter((g: any) => g.mode === "protected").map((g: any) => g.term);
    const fixed = (glossary ?? []).filter((g: any) => g.mode === "fixed");

    let q = admin.from("ph_products")
      .select("id,name,model,sku,short_description,long_description,features,applications,intended_use,seo_title,seo_description,product_group,laser_class,wavelengths,power,fluence,pulse_duration,frequency,spot_sizes,cooling");
    q = productIds?.length ? q.in("id", productIds) : q.order("name").range(offset, offset + limit - 1);
    const { data: prods } = await q;

    const results: any[] = [];
    for (const p of prods ?? []) {
      const { data: existing } = await admin.from("ph_product_translations").select("*").eq("product_id", p.id);
      const byLocale = Object.fromEntries((existing ?? []).map((r: any) => [r.locale, r]));
      const cur = byLocale["en"];
      if (cur && !overwrite && ["review", "approved", "published"].includes(cur.status)) {
        results.push({ id: p.id, name: p.name, skipped: "manuell_gepflegt" });
        continue;
      }
      const de = byLocale["de"] ?? {};
      const source = {
        name: de.name || p.name,
        short_description: de.short_description || p.short_description,
        long_description: de.long_description || p.long_description,
        highlights: de.highlights?.length ? de.highlights : (Array.isArray(p.features) ? p.features : []),
        benefits: de.benefits ?? [],
        applications: de.applications?.length ? de.applications : (Array.isArray(p.applications) ? p.applications : []),
        treatments: de.treatments ?? [],
        features: de.features?.length ? de.features : (Array.isArray(p.features) ? p.features : []),
        marketing_text: de.marketing_text ?? null,
        notices: de.notices ?? null,
        seo_title: de.seo_title || p.seo_title,
        seo_description: de.seo_description || p.seo_description,
        intended_use: de.intended_use || p.intended_use,
        product_group_label: de.product_group_label || p.product_group,
      };

      const system =
        `Du bist professioneller Fachübersetzer für medizinische und ästhetische Lasergeräte der Marke ALIX. ` +
        `Übersetze aus dem Deutschen nach Englisch (en). ` +
        `REGELN: Zahlen, Maßeinheiten (W, nm, Hz, ms, J/cm², °C), Modellbezeichnungen, SKU, Produktcodes und Markennamen bleiben unverändert. ` +
        `Diese Begriffe NIEMALS übersetzen: ${protectedTerms.join(", ") || "ALIX"}. ` +
        (fixed.length ? `Verbindliche Übersetzungen: ${fixed.map((f: any) => `"${f.term}" → "${f.translations?.en ?? f.term}"`).join("; ")}. ` : "") +
        `Keine Heilversprechen, keine Zulassungsaussagen (CE, FDA, MDR, ISO) erfinden. Struktur und Listenlänge exakt beibehalten. ` +
        `Schreibe professionelles internationales B2B-Fachenglisch der Beauty-/Medizintechnik, keine wörtliche Übertragung. ` +
        `seo_title und seo_description eigenständig auf dieses Gerät zuschneiden (Produktart, Suchintention, tatsächliche Eigenschaften), seo_title 45–65 Zeichen, seo_description 120–165 Zeichen. ` +
        `Antworte AUSSCHLIESSLICH mit reinem JSON in exakt derselben Feldstruktur wie die Eingabe.`;

      try {
        const raw = await generate(
          `Gerätekontext (nicht übersetzen): ${JSON.stringify({ model: p.model, sku: p.sku, laser_class: p.laser_class, wavelengths: p.wavelengths, power: p.power })}\n\n` +
          `Zu übersetzendes JSON:\n${JSON.stringify(source, null, 2)}`,
          system,
        );
        const out = parseJson(raw);
        const row: Record<string, unknown> = { product_id: p.id, locale: "en" };
        for (const f of TEXT_FIELDS) if (typeof out[f] === "string") row[f] = out[f];
        for (const f of LIST_FIELDS) row[f] = asList(out[f]);
        row.status = "ai_draft";
        row.translation_source = "ki";
        row.translated_at = new Date().toISOString();

        const { error } = await admin.from("ph_product_translations").upsert(row, { onConflict: "product_id,locale" });
        if (error) throw new Error(error.message);

        const qa = qaCheck({ source, target: row, locale: "en", model: p.model, brands: protectedTerms });
        await admin.from("ph_translation_qa").upsert({
          product_id: p.id, locale: "en", status: qa.status, score: qa.score,
          issues: qa.issues, checked_at: new Date().toISOString(),
        }, { onConflict: "product_id,locale" });

        results.push({ id: p.id, name: p.name, ok: true, qa: qa.status, score: qa.score, issues: qa.issues.map((i) => i.code) });
      } catch (e: any) {
        results.push({ id: p.id, name: p.name, error: String(e?.message ?? e).slice(0, 200) });
      }
    }
    return { offset, count: (prods ?? []).length, results };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 3, 60);
    const offset = Number(body.offset) || 0;
    const overwrite = body.overwrite === true;

    if (body.background === true) {
      // @ts-ignore Deno Edge Runtime
      EdgeRuntime.waitUntil(runBatch(admin, offset, limit, overwrite));
      return json(202, { started: true, offset, limit });
    }
    return json(200, await runBatch(admin, offset, limit, overwrite));
  } catch (e: any) {
    return json(500, { error: e?.message ?? "Fehler" });
  }
});
