// ALIX PRODUCT HUB – Datenanreicherung aus alix-lasers.de / .com / alix-laser.ae
// Füllt AUSSCHLIESSLICH leere Felder (nie überschreiben). Jede Änderung wird in ph_sync_log protokolliert.
// Modi: preview (nur Vorschau) | apply (schreibend)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SOURCES = ["alix-lasers.de", "alix-lasers.com", "alix-laser.ae"];

// Felder, die angereichert werden dürfen
const FIELDS = [
  "short_description", "long_description", "wavelengths", "power", "fluence",
  "pulse_duration", "frequency", "spot_sizes", "cooling", "laser_class",
  "intended_use", "manufacturer", "seo_title", "seo_description",
] as const;

const FC_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
const LOV_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const isGateway = FC_KEY.startsWith("lovc_");
const FC_BASE = isGateway
  ? "https://connector-gateway.lovable.dev/firecrawl/v2"
  : "https://api.firecrawl.dev/v2";
const fcHeaders = () =>
  isGateway
    ? { "Content-Type": "application/json", Authorization: `Bearer ${LOV_KEY}`, "X-Connection-Api-Key": FC_KEY }
    : { "Content-Type": "application/json", Authorization: `Bearer ${FC_KEY}` };

async function fcSearch(query: string) {
  const r = await fetch(`${FC_BASE}/search`, {
    method: "POST",
    headers: fcHeaders(),
    body: JSON.stringify({ query, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`Firecrawl ${r.status}: ${body.slice(0, 300)}`);
  const data = JSON.parse(body);
  const items = data.data ?? data.results ?? [];
  return (Array.isArray(items) ? items : []).map((x: any) => ({
    url: x.url as string,
    markdown: (x.markdown ?? x.content ?? "") as string,
  })).filter((x: any) => x.markdown);
}

async function extract(name: string, model: string | null, docs: { url: string; markdown: string }[]) {
  const context = docs.map((d) => `QUELLE: ${d.url}\n${d.markdown.slice(0, 6000)}`).join("\n\n---\n\n");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOV_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Du extrahierst Produktdaten für medizinische/ästhetische Lasergeräte der Marke ALIX aus Webseiteninhalten. " +
            "Antworte NUR mit JSON. Erfinde nichts: Felder ohne belegte Angabe bleiben null. Sprache: Deutsch. " +
            "Keine Heilversprechen, keine unbelegten Compliance-Aussagen.",
        },
        {
          role: "user",
          content:
            `Gerät: ${name}${model ? ` (Modell ${model})` : ""}\n\n` +
            `Extrahiere aus den Quellen dieses JSON-Objekt (alle Werte string oder null):\n` +
            `{"short_description","long_description","wavelengths","power","fluence","pulse_duration","frequency","spot_sizes","cooling","laser_class","intended_use","manufacturer","seo_title","seo_description"}\n\n` +
            context,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`AI ${r.status}: ${body.slice(0, 300)}`);
  const parsed = JSON.parse(body);
  const content = parsed.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!FC_KEY) return json(400, { error: "FIRECRAWL_API_KEY fehlt (Connector verbinden)" });
    if (!LOV_KEY) return json(400, { error: "LOVABLE_API_KEY fehlt" });

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: nur Super Admin / Admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json(401, { error: "Nicht angemeldet" });
    const { data: userRes } = await admin.auth.getUser(token);
    const uid = userRes?.user?.id;
    if (!uid) return json(401, { error: "Ungültige Sitzung" });
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", uid);
    const roles = (roleRows ?? []).map((r: any) => String(r.role));
    if (!roles.some((r) => ["Super Admin", "Admin"].includes(r))) {
      return json(403, { error: "Keine Berechtigung" });
    }

    const { mode = "preview", productIds = [], limit = 10 } = await req.json().catch(() => ({}));

    let q = admin.from("ph_products").select("*").order("name");
    if (Array.isArray(productIds) && productIds.length) q = q.in("id", productIds);
    const { data: products, error } = await q;
    if (error) throw new Error(error.message);

    const targets = (products ?? [])
      .filter((p: any) => FIELDS.some((f) => !String(p[f] ?? "").trim()))
      .slice(0, Math.min(Number(limit) || 10, 40));

    const results: any[] = [];
    for (const p of targets) {
      const started = Date.now();
      try {
        const missing = FIELDS.filter((f) => !String((p as any)[f] ?? "").trim());
        const query = `${p.name}${p.model ? ` ${p.model}` : ""} ${SOURCES.map((s) => `site:${s}`).join(" OR ")}`;
        let docs = await fcSearch(query);
        if (!docs.length) docs = await fcSearch(`${p.name} ALIX Laser technische Daten`);
        if (!docs.length) {
          results.push({ id: p.id, name: p.name, status: "keine_quelle", filled: [] });
          continue;
        }
        const ex = await extract(p.name, p.model, docs);
        const patch: Record<string, string> = {};
        for (const f of missing) {
          const v = ex?.[f];
          if (typeof v === "string" && v.trim()) patch[f] = v.trim();
        }
        if (mode === "apply" && Object.keys(patch).length) {
          const { error: upErr } = await admin
            .from("ph_products")
            .update({ ...patch, updated_by: uid, updated_at: new Date().toISOString() })
            .eq("id", p.id);
          if (upErr) throw new Error(upErr.message);
          await admin.from("ph_sync_log").insert({
            channel_code: "enrich",
            direction: "import",
            operation: "update",
            product_id: p.id,
            status: "success",
            message: `Angereichert aus ${docs.map((d) => d.url).join(", ")}`,
            payload: { patch, sources: docs.map((d) => d.url) },
            duration_ms: Date.now() - started,
          });
        }
        results.push({
          id: p.id,
          name: p.name,
          status: Object.keys(patch).length ? (mode === "apply" ? "gefuellt" : "vorschau") : "nichts_gefunden",
          filled: Object.keys(patch),
          patch,
          sources: docs.map((d) => d.url),
        });
      } catch (e: any) {
        results.push({ id: p.id, name: p.name, status: "fehler", error: e.message, filled: [] });
        await admin.from("ph_sync_log").insert({
          channel_code: "enrich", direction: "import", operation: "update", product_id: p.id,
          status: "error", message: e.message, duration_ms: Date.now() - started,
        });
      }
    }

    return json(200, {
      mode,
      candidates: (products ?? []).filter((p: any) => FIELDS.some((f) => !String(p[f] ?? "").trim())).length,
      processed: results.length,
      filled: results.filter((r) => r.filled.length).length,
      results,
    });
  } catch (e: any) {
    return json(500, { error: e.message });
  }
});
