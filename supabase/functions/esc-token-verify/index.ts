import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verify(payload: string, sig: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || (await req.json().catch(() => ({}))).token;
    if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: corsHeaders });

    const [payload, sig] = token.split(".");
    if (!payload || !sig) return new Response(JSON.stringify({ error: "invalid token" }), { status: 400, headers: corsHeaders });

    const secret = Deno.env.get("ESC_TOKEN_SECRET")!;
    const ok = await verify(payload, sig, secret);
    if (!ok) return new Response(JSON.stringify({ error: "bad signature" }), { status: 401, headers: corsHeaders });

    const decoded = JSON.parse(atob(payload.replace(/-/g,"+").replace(/_/g,"/")));
    if (decoded.x && decoded.x < Math.floor(Date.now() / 1000))
      return new Response(JSON.stringify({ error: "expired" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokenRow } = await admin.from("esc_ics_tokens").select("*").eq("token", token).maybeSingle();
    if (tokenRow?.revoked_at)
      return new Response(JSON.stringify({ error: "revoked" }), { status: 401, headers: corsHeaders });

    const { data: event } = await admin.from("esc_events").select("id,title,start_at,end_at,location,status,customer_name")
      .eq("id", decoded.e).maybeSingle();

    await admin.from("esc_audit_log").insert({
      entity_type: "esc_token", entity_id: decoded.e, action: "TOKEN_VERIFY",
      new_data: { action: decoded.a, ok: true },
    });

    return new Response(JSON.stringify({ ok: true, action: decoded.a, event }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: corsHeaders });
  }
});
