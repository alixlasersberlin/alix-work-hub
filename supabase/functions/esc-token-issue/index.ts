import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/=+$/,"").replace(/\+/g,"-").replace(/\//g,"_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ",""));
    if (!claims?.claims?.sub) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { event_id, action = "view", ttl_hours = 24 * 30 } = await req.json();
    if (!event_id) return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: corsHeaders });

    const secret = Deno.env.get("ESC_TOKEN_SECRET")!;
    const exp = Math.floor(Date.now() / 1000) + ttl_hours * 3600;
    const payload = b64url({ e: event_id, a: action, x: exp, i: crypto.randomUUID() });
    const sig = await sign(payload, secret);
    const token = `${payload}.${sig}`;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("esc_ics_tokens").insert({
      token, signature: sig, event_id, action,
      expires_at: new Date(exp * 1000).toISOString(),
    });
    await admin.from("esc_audit_log").insert({
      entity_type: "esc_token", entity_id: event_id, action: "TOKEN_ISSUE",
      user_id: claims.claims.sub, new_data: { action, exp },
    });

    return new Response(JSON.stringify({ token, expires_at: new Date(exp * 1000).toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: corsHeaders });
  }
});
