// Issues (or reuses) a long-lived ICS feed token for the calling user.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } });
    const { data: claims } = await sb.auth.getClaims(auth.replace("Bearer ",""));
    const userId = claims?.claims?.sub;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Reuse existing non-revoked feed token for this user
    const { data: existing } = await admin.from("esc_ics_tokens")
      .select("token").eq("user_id", userId).eq("action", "feed").is("revoked_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.token) return new Response(JSON.stringify({ token: existing.token }),
      { headers: { ...cors, "Content-Type": "application/json" } });

    const token = crypto.randomUUID().replace(/-/g,"") + crypto.randomUUID().replace(/-/g,"");
    await admin.from("esc_ics_tokens").insert({
      token, user_id: userId, action: "feed",
      expires_at: new Date(Date.now() + 5 * 365 * 86400000).toISOString(),
    });
    await admin.from("esc_audit_log").insert({
      entity_type: "esc_ics", entity_id: userId, action: "FEED_TOKEN_ISSUE",
      user_id: userId, new_data: { ttl_days: 5 * 365 },
    });

    return new Response(JSON.stringify({ token }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), { status: 500, headers: cors });
  }
});
