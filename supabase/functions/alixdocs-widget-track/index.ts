// AlixDocs Phase 12 — Public tracking beacon for share links
// POST { token, event_type, document_id?, page_no?, dwell_ms?, meta? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ALLOWED = new Set(["view", "unlock", "open", "download", "zip", "page_view", "dwell"]);

async function sha256(s: string) {
  const buf = new TextEncoder().encode(s);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    const token = String(body?.token ?? "").trim();
    const event_type = String(body?.event_type ?? "");
    if (!token || !ALLOWED.has(event_type)) {
      return new Response(JSON.stringify({ error: "bad_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: link } = await svc.from("alixdocs_share_links").select("id").eq("token", token).maybeSingle();
    if (!link) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const ip_hash = ip ? (await sha256(ip + "|alixdocs")).slice(0, 32) : null;
    const country = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || null;

    await svc.from("alixdocs_share_events").insert({
      share_link_id: link.id,
      document_id: body?.document_id ?? null,
      event_type,
      page_no: body?.page_no ?? null,
      dwell_ms: body?.dwell_ms ?? null,
      ip_hash,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      referer: req.headers.get("referer")?.slice(0, 500) ?? null,
      country,
      meta: body?.meta ?? {},
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
