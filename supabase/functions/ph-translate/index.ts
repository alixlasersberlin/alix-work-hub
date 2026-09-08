// ALIX PRODUCT HUB – KI-Übersetzung redaktioneller Produktinhalte (Master = Deutsch)
// Technische Werte, Zahlen, Einheiten, SKU, Modell, Hub-ID und Preise werden NICHT übersetzt
// und auch nicht angefasst – übersetzt werden ausschließlich redaktionelle Textfelder.
import { createClient } from "npm:@supabase/supabase-js@2";
import { qaCheck } from "../_shared/ph-qa.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const LOV_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const LOCALE_NAME: Record<string, string> = {
  en: "Englisch (en)", es: "Spanisch (es)", ru: "Russisch (ru)", ar: "Arabisch (ar)", de: "Deutsch (de)",
};

const TEXT_FIELDS = [
  "name", "short_description", "long_description", "marketing_text", "notices", "seo_title", "seo_description",
];
const LIST_FIELDS = ["highlights", "benefits", "applications", "treatments", "features"];

async function generate(prompt: string, system: string): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOV_KEY, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: "openai/gpt-5.6-sol", instructions: system, input: prompt, stream: true }),
  });
  if (!r.ok || !r.body) {
    const body = await r.text().catch(() => "");
    const err: any = new Error(body.slice(0, 300) || `AI ${r.status}`);
    err.status = r.status;
    throw err;
  }
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

function parseJson(raw: string): Record<string, unknown> {
  const s = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("KI-Antwort war kein JSON");
  return JSON.parse(s.slice(a, b + 1));
}

const asList = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : x)).slice(0, 30) : [];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!LOV_KEY) return json(500, { error: "LOVABLE_API_KEY fehlt" });
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(401, { error: "Nicht angemeldet" });
    const { data: userRes } = await admin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) return json(401, { error: "Ungültige Sitzung" });

    let allowed = false;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    try {
      const { data: isAdmin } = await userClient.rpc("is_admin");
      allowed = !!isAdmin;
    } catch { /* ignore */ }
    if (!allowed) {
      const { data: phRows } = await admin.from("ph_roles").select("role").eq("user_id", uid);
      allowed = (phRows ?? []).length > 0;
    }
    if (!allowed) return json(403, { error: "Keine Berechtigung" });

    const body = await req.json().catch(() => ({}));
    const productIds: string[] = Array.isArray(body.productIds)
      ? body.productIds.map(String).slice(0, 25)
      : body.productId ? [String(body.productId)] : [];
    const locales: string[] = (Array.isArray(body.locales) ? body.locales : ["en"])
      .map(String).filter((l: string) => ["en", "es", "ru", "ar"].includes(l));
    const overwrite = body.overwrite === true;
    if (!productIds.length || !locales.length) return json(400, { error: "productIds/locales fehlen" });

    const { data: glossary } = await admin.from("ph_glossary")
      .select("term,mode,translations").eq("active", true);
    const protectedTerms = (glossary ?? []).filter((g: any) => g.mode === "protected").map((g: any) => g.term);
    const fixed = (glossary ?? []).filter((g: any) => g.mode === "fixed");

    const results: any[] = [];

    for (const pid of productIds) {
      const { data: p } = await admin.from("ph_products")
        .select("id,name,model,sku,short_description,long_description,features,applications,intended_use,seo_title,seo_description,product_group,laser_class")
        .eq("id", pid).maybeSingle();
      if (!p) { results.push({ product_id: pid, error: "not_found" }); continue; }

      const { data: existing } = await admin.from("ph_product_translations")
        .select("*").eq("product_id", pid);
      const byLocale = Object.fromEntries((existing ?? []).map((r: any) => [r.locale, r]));

      // Deutsche Quelle: gepflegte DE-Übersetzung, sonst Masterfelder
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
        faq: de.faq ?? [],
        notices: de.notices ?? null,
        seo_title: de.seo_title || p.seo_title,
        seo_description: de.seo_description || p.seo_description,
        alt_texts: de.alt_texts ?? {},
      };

      for (const locale of locales) {
        const cur = byLocale[locale];
        if (cur && !overwrite && ["review", "approved", "published"].includes(cur.status)) {
          results.push({ product_id: pid, locale, skipped: "manuell_gepflegt" });
          continue;
        }

        const system =
          `Du bist professioneller Fachübersetzer für medizinische und ästhetische Lasergeräte der Marke ALIX. ` +
          `Übersetze aus dem Deutschen nach ${LOCALE_NAME[locale]}. ` +
          `REGELN: Zahlen, Maßeinheiten (W, nm, Hz, ms, J/cm², °C), Modellbezeichnungen, SKU, Produktcodes und Markennamen bleiben unverändert. ` +
          `Diese Begriffe NIEMALS übersetzen: ${protectedTerms.join(", ") || "ALIX"}. ` +
          (fixed.length
            ? `Verbindliche Übersetzungen: ${fixed.map((f: any) => `"${f.term}" → "${f.translations?.[locale] ?? f.term}"`).join("; ")}. `
            : "") +
          `Keine Heilversprechen, keine Zulassungsaussagen erfinden. Struktur und Listenlänge exakt beibehalten. ` +
          (locale === "ar" ? `Arabischer Text wird RTL dargestellt; technische Angaben in lateinischer Schrift belassen. ` : "") +
          `Antworte AUSSCHLIESSLICH mit reinem JSON in exakt derselben Feldstruktur wie die Eingabe.`;

        const raw = await generate(
          `Gerätekontext (nicht übersetzen, nur Verständnis): ${JSON.stringify({ model: p.model, sku: p.sku, product_group: p.product_group, laser_class: p.laser_class })}\n\n` +
          `Zu übersetzendes JSON:\n${JSON.stringify(source, null, 2)}`,
          system,
        );

        let out: Record<string, any>;
        try { out = parseJson(raw); } catch (e: any) {
          results.push({ product_id: pid, locale, error: e.message });
          continue;
        }

        const row: Record<string, unknown> = { product_id: pid, locale };
        for (const f of TEXT_FIELDS) if (typeof out[f] === "string") row[f] = out[f];
        for (const f of LIST_FIELDS) row[f] = asList(out[f]);
        row.faq = Array.isArray(out.faq) ? out.faq.slice(0, 30) : [];
        row.alt_texts = out.alt_texts && typeof out.alt_texts === "object" ? out.alt_texts : {};
        row.status = "ai_draft";
        row.translation_source = "ki";
        row.translated_at = new Date().toISOString();
        row.translated_by = uid;
        row.updated_by = uid;

        const { error } = await admin.from("ph_product_translations")
          .upsert(row, { onConflict: "product_id,locale" });
        if (error) results.push({ product_id: pid, locale, error: error.message });
        else results.push({ product_id: pid, locale, ok: true });
      }
    }

    return json(200, { results });
  } catch (e: any) {
    return json(Number(e?.status) || 500, { error: e?.message ?? "Unbekannter Fehler" });
  }
});
