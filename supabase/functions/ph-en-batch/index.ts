// Interner Batchlauf zur Erstübersetzung des Product-Hub-Katalogs (en, es, ru, ar).
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

const LOCALES: Record<string, { label: string; style: string }> = {
  en: {
    label: "Englisch (en)",
    style: "Professionelles internationales B2B-Fachenglisch der Beauty-/Medizintechnik.",
  },
  es: {
    label: "Spanisch (es)",
    style: "Professionelles, neutrales internationales Spanisch (kein regionaler Slang), B2B-Ton der professionellen Kosmetik-/Beauty-Technologie.",
  },
  ru: {
    label: "Russisch (ru)",
    style: "Natürliches, professionelles Russisch für B2B-Kunden im Bereich Beauty-Technologie und professionelle Kosmetik. Keine wörtliche Übertragung, idiomatisch und verkaufsstark, aber sachlich.",
  },
  ar: {
    label: "Arabisch (ar)",
    style: "Professionelles modernes Hocharabisch (MSA) für den MENA-/GCC-Markt. Zahlen, Einheiten, Modellnamen und Marken bleiben in lateinischer Schrift und westlichen Ziffern (z. B. 3000 W, 755 nm, −34 °C, 129 J/cm²) und dürfen nicht in arabische Ziffern umgeschrieben werden.",
  },
};

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

const PRODUCT_COLS =
  "id,name,model,sku,short_description,long_description,features,applications,intended_use,seo_title,seo_description,product_group,laser_class,wavelengths,power,fluence,pulse_duration,frequency,spot_sizes,cooling";

function germanSource(p: any, de: any) {
  return {
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
  } as Record<string, unknown>;
}

const ctxOf = (p: any) =>
  [p.model, p.sku, p.wavelengths, p.power, p.fluence, p.pulse_duration, p.frequency, p.spot_sizes, p.cooling]
    .filter(Boolean).join(" ");

/** Nur Qualitätscheck neu berechnen – ohne die Übersetzungen zu verändern. */
async function requalify(admin: any, locales: string[]) {
  const { data: glossary } = await admin.from("ph_glossary").select("term,mode").eq("active", true);
  const protectedTerms = (glossary ?? []).filter((g: any) => g.mode === "protected").map((g: any) => g.term);
  const { data: prods } = await admin.from("ph_products").select(PRODUCT_COLS);
  const out: any[] = [];
  for (const p of prods ?? []) {
    const { data: trs } = await admin.from("ph_product_translations").select("*").eq("product_id", p.id);
    const byLocale = Object.fromEntries((trs ?? []).map((r: any) => [r.locale, r]));
    const source = germanSource(p, byLocale["de"] ?? {});
    for (const locale of locales) {
      const target = byLocale[locale];
      if (!target) continue;
      const qa = qaCheck({ source, target, locale, model: p.model, brands: protectedTerms, context: ctxOf(p) });
      await admin.from("ph_translation_qa").upsert({
        product_id: p.id, locale, status: qa.status, score: qa.score,
        issues: qa.issues, checked_at: new Date().toISOString(),
      }, { onConflict: "product_id,locale" });
      out.push({ name: p.name, locale, qa: qa.status, score: qa.score });
    }
  }
  return { requalified: out.length, results: out };
}

async function runBatch(admin: any, locale: string, offset: number, limit: number, overwrite: boolean, productIds?: string[]) {
  const spec = LOCALES[locale];
  if (!spec) throw new Error(`Sprache nicht unterstützt: ${locale}`);

  const { data: glossary } = await admin.from("ph_glossary").select("term,mode,translations").eq("active", true);
  const protectedTerms = (glossary ?? []).filter((g: any) => g.mode === "protected").map((g: any) => g.term);
  const fixed = (glossary ?? []).filter((g: any) => g.mode === "fixed");

  let q = admin.from("ph_products").select(PRODUCT_COLS);
  q = productIds?.length ? q.in("id", productIds) : q.order("name").range(offset, offset + limit - 1);
  const { data: prods } = await q;

  const results: any[] = [];
  for (const p of prods ?? []) {
    const { data: existing } = await admin.from("ph_product_translations").select("*").eq("product_id", p.id);
    const byLocale = Object.fromEntries((existing ?? []).map((r: any) => [r.locale, r]));
    const cur = byLocale[locale];
    if (cur && !overwrite && ["review", "approved", "published"].includes(cur.status)) {
      results.push({ id: p.id, name: p.name, skipped: "manuell_gepflegt" });
      continue;
    }
    const source = germanSource(p, byLocale["de"] ?? {});

    const system =
      `Du bist professioneller Fachübersetzer für medizinische und ästhetische Lasergeräte der Marke ALIX. ` +
      `Übersetze aus dem Deutschen nach ${spec.label}. ${spec.style} ` +
      `REGELN: Zahlen, Maßeinheiten (W, nm, Hz, ms, J/cm², °C, dB), Spotgrößen, Modellbezeichnungen, SKU, Artikelnummern, Produktcodes, Preise, Garantiezeiträume und Markennamen bleiben unverändert. ` +
      `Diese Begriffe NIEMALS übersetzen: ${protectedTerms.join(", ") || "ALIX"}. ` +
      (fixed.length ? `Verbindliche Übersetzungen: ${fixed.map((f: any) => `"${f.term}" → "${f.translations?.[locale] ?? f.term}"`).join("; ")}. ` : "") +
      `Leere Felder bleiben leer (null bzw. leere Liste) – niemals Inhalte erfinden. ` +
      `Keine Heilversprechen, keine neuen medizinischen Aussagen, keine Zulassungsaussagen (CE, FDA, MDR, ISO) erfinden. Struktur und Listenlänge exakt beibehalten. ` +
      `seo_title und seo_description eigenständig auf dieses Gerät und die Suchintention der Zielsprache zuschneiden (keine Wort-für-Wort-Übertragung), seo_title 45–65 Zeichen, seo_description 120–165 Zeichen. ` +
      `Antworte AUSSCHLIESSLICH mit reinem JSON in exakt derselben Feldstruktur wie die Eingabe.`;

    try {
      const raw = await generate(
        `Gerätekontext (nicht übersetzen): ${JSON.stringify({ model: p.model, sku: p.sku, laser_class: p.laser_class, wavelengths: p.wavelengths, power: p.power })}\n\n` +
        `Zu übersetzendes JSON:\n${JSON.stringify(source, null, 2)}`,
        system,
      );
      const out = parseJson(raw);
      const row: Record<string, unknown> = { product_id: p.id, locale };
      for (const f of TEXT_FIELDS) if (typeof out[f] === "string") row[f] = out[f];
      for (const f of LIST_FIELDS) row[f] = asList(out[f]);
      row.status = "ai_draft";
      row.translation_source = "ki";
      row.translated_at = new Date().toISOString();

      const { error } = await admin.from("ph_product_translations").upsert(row, { onConflict: "product_id,locale" });
      if (error) throw new Error(error.message);

      const qa = qaCheck({ source, target: row, locale, model: p.model, brands: protectedTerms, context: ctxOf(p) });
      await admin.from("ph_translation_qa").upsert({
        product_id: p.id, locale, status: qa.status, score: qa.score,
        issues: qa.issues, checked_at: new Date().toISOString(),
      }, { onConflict: "product_id,locale" });

      results.push({ id: p.id, name: p.name, ok: true, qa: qa.status, score: qa.score, issues: qa.issues.map((i) => i.code) });
    } catch (e: any) {
      results.push({ id: p.id, name: p.name, error: String(e?.message ?? e).slice(0, 200) });
    }
  }
  return { locale, offset, count: (prods ?? []).length, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 3, 60);
    const offset = Number(body.offset) || 0;
    const overwrite = body.overwrite === true;
    const locale = String(body.locale ?? "en");
    const productIds: string[] | undefined = Array.isArray(body.productIds) ? body.productIds.map(String) : undefined;

    if (body.action === "requalify") {
      const locales: string[] = Array.isArray(body.locales) && body.locales.length ? body.locales.map(String) : [locale];
      return json(200, await requalify(admin, locales));
    }

    if (body.background === true) {
      // @ts-ignore Deno Edge Runtime
      EdgeRuntime.waitUntil(runBatch(admin, locale, offset, limit, overwrite, productIds));
      return json(202, { started: true, locale, offset, limit });
    }
    return json(200, await runBatch(admin, locale, offset, limit, overwrite, productIds));
  } catch (e: any) {
    return json(500, { error: e?.message ?? "Fehler" });
  }
});
