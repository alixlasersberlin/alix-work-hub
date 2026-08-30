// ALIX PRODUCT HUB – KI-Textgenerierung für einzelne Felder
// Erzeugt Inhalte für ein bestimmtes Feld (z. B. Funktionsname, Kurzbeschreibung, Notiz)
// auf Basis des Geräte-Kontexts. Keine Heilversprechen, keine unbelegten Compliance-Aussagen.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const LOV_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

async function generate(prompt: string, system: string): Promise<string> {
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
  return out.trim();
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
    const fieldLabel = String(body.fieldLabel ?? "Feld").slice(0, 120);
    const current = String(body.current ?? "").slice(0, 4000);
    const hint = String(body.hint ?? "").slice(0, 600);
    const maxChars = Math.min(Number(body.maxChars) || 300, 4000);
    const productId = body.productId ? String(body.productId) : "";
    const extra = body.context && typeof body.context === "object" ? body.context : {};

    let product: any = null;
    if (productId) {
      const { data } = await admin
        .from("ph_products")
        .select("name, model, short_description, long_description, intended_use, wavelengths, power, laser_class, manufacturer")
        .eq("id", productId)
        .maybeSingle();
      product = data;
    }

    const system =
      "Du bist Produkt-Redakteur für medizinische/ästhetische Lasergeräte der Marke ALIX. " +
      "Schreibe sachlich, präzise, auf Deutsch. Keine Heilversprechen, keine medizinischen Wirkversprechen, " +
      "keine unbelegten Compliance- oder Zulassungsaussagen. Erfinde keine technischen Kennzahlen. " +
      "Antworte AUSSCHLIESSLICH mit dem reinen Feldinhalt – ohne Anführungszeichen, ohne Überschrift, ohne Markdown.";

    const prompt =
      `Gerätekontext:\n${JSON.stringify({ ...product, ...extra }, null, 2)}\n\n` +
      `Zu erzeugendes Feld: "${fieldLabel}"\n` +
      (hint ? `Hinweis: ${hint}\n` : "") +
      (current ? `Bisheriger Inhalt (verbessern/umformulieren): ${current}\n` : "") +
      `Maximale Länge: ${maxChars} Zeichen.`;

    const text = await generate(prompt, system);
    if (!text) return json(502, { error: "KI lieferte keinen Text" });
    return json(200, { text: text.slice(0, maxChars) });
  } catch (e: any) {
    const status = Number(e?.status) || 500;
    return json(status, { error: e?.message ?? "Unbekannter Fehler" });
  }
});
