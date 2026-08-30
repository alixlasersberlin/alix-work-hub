// ALIX PRODUCT HUB / PRODUCT MASTER – KI-SEO-Generator
// Erzeugt SEO-Titel, Meta-Description, H1, Haupt-/Nebenkeywords und OpenGraph-Texte
// auf Basis der Gerätestammdaten. Keine Heilversprechen, keine unbelegten Compliance-Aussagen.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const LOV_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    seo_title: { type: "string" },
    meta_description: { type: "string" },
    h1: { type: "string" },
    main_keyword: { type: "string" },
    secondary_keywords: { type: "array", items: { type: "string" } },
    og_title: { type: "string" },
    og_description: { type: "string" },
    url_slug: { type: "string" },
  },
  required: [
    "seo_title", "meta_description", "h1", "main_keyword",
    "secondary_keywords", "og_title", "og_description", "url_slug",
  ],
};

async function generateJson(system: string, prompt: string): Promise<any> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOV_KEY,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      instructions: system,
      input: prompt,
      stream: true,
      text: { format: { type: "json_schema", name: "seo_package", strict: true, schema: SCHEMA } },
    }),
  });

  if (!r.ok || !r.body) {
    const body = await r.text().catch(() => "");
    const err: any = new Error(body.slice(0, 300) || `AI ${r.status}`);
    err.status = r.status;
    throw err;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") out += evt.delta;
        else if (evt.type === "response.completed" && !out) out = evt.response?.output_text ?? "";
      } catch { /* partial */ }
    }
  }
  try { return JSON.parse(out.trim()); } catch { return null; }
}

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
    const productId = body.productId ? String(body.productId) : "";
    const channel = String(body.channel ?? "alix-lasers.de").slice(0, 60);
    const current = body.current && typeof body.current === "object" ? body.current : {};
    const hint = String(body.hint ?? "").slice(0, 600);

    let product: any = null;
    if (productId) {
      const { data } = await admin
        .from("ph_products")
        .select("name, model, slug, short_description, long_description, intended_use, wavelengths, power, laser_class, manufacturer, applications")
        .eq("id", productId)
        .maybeSingle();
      product = data;
    }
    if (!product && !Object.keys(current).length) return json(400, { error: "Kein Produktkontext" });

    const system =
      "Du bist SEO-Redakteur für medizinische/ästhetische Lasergeräte der Marke ALIX. " +
      "Schreibe auf Deutsch, sachlich, suchmaschinenoptimiert und ohne Werbe-Floskeln. " +
      "Keine Heilversprechen, keine medizinischen Wirkversprechen, keine unbelegten Zulassungs- oder Compliance-Aussagen. " +
      "Erfinde keine technischen Kennzahlen – nutze nur den gegebenen Kontext. " +
      "Regeln: seo_title max. 60 Zeichen inkl. Hauptkeyword; meta_description 140–158 Zeichen; " +
      "h1 kurz und eindeutig; main_keyword als realistische Suchphrase; " +
      "secondary_keywords: 5–8 relevante Nebenkeywords (kleingeschrieben, keine Dubletten); " +
      "og_title max. 70 Zeichen; og_description max. 200 Zeichen; url_slug kleingeschrieben, nur a-z0-9 und Bindestriche.";

    const prompt =
      `Kanal/Website: ${channel}\n` +
      `Gerätekontext:\n${JSON.stringify(product ?? {}, null, 2)}\n\n` +
      `Bisherige SEO-Daten (verbessern, nicht blind übernehmen):\n${JSON.stringify(current, null, 2)}\n` +
      (hint ? `\nHinweis: ${hint}\n` : "") +
      `\nErzeuge das vollständige SEO-Paket als JSON.`;

    const data = await generateJson(system, prompt);
    if (!data) return json(502, { error: "KI lieferte kein gültiges Ergebnis" });

    return json(200, {
      seo_title: String(data.seo_title ?? "").slice(0, 80),
      meta_description: String(data.meta_description ?? "").slice(0, 200),
      h1: String(data.h1 ?? "").slice(0, 120),
      main_keyword: String(data.main_keyword ?? "").slice(0, 120),
      secondary_keywords: Array.isArray(data.secondary_keywords)
        ? data.secondary_keywords.map((k: unknown) => String(k).trim()).filter(Boolean).slice(0, 12)
        : [],
      og_title: String(data.og_title ?? "").slice(0, 120),
      og_description: String(data.og_description ?? "").slice(0, 300),
      url_slug: String(data.url_slug ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120),
    });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return json(status, { error: e?.message ?? "Unbekannter Fehler" });
  }
});
