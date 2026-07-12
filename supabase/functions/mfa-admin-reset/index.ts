import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const targetUserId = String(body.user_id ?? "").trim();
  if (!targetUserId) return json({ error: "user_id required" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);

  // Verify caller is admin
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("roles!inner(name)")
    .eq("user_id", userData.user.id);
  const roleNames = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
  if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
    return json({ error: "Forbidden – Admin role required" }, 403);
  }

  // Delete factors
  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: targetUserId });
  for (const f of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ userId: targetUserId, id: f.id });
  }

  await admin
    .from("user_profiles")
    .update({
      mfa_recovery_codes_hash: [],
      mfa_enrolled_at: null,
    })
    .eq("id", targetUserId);

  return json({ success: true, factors_removed: factors?.factors?.length ?? 0 });
});

function json(b: any, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
