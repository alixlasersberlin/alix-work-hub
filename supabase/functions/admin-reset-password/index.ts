import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await callerClient.rpc("is_admin");
    if (!isAdmin) return json({ error: "Forbidden: Admin only" }, 403);

    const { user_id, new_password, require_reset } = await req.json();
    if (!user_id || !new_password) {
      return json({ error: "user_id and new_password are required" }, 400);
    }
    if (typeof new_password !== "string" || new_password.length < 8) {
      return json({ error: "Passwort muss mindestens 8 Zeichen lang sein" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });
    if (updateError) {
      return json({ error: `Auth error: ${updateError.message}` }, 400);
    }

    await adminClient
      .from("user_profiles")
      .update({ password_reset_required: !!require_reset })
      .eq("id", user_id);

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    await adminClient.from("audit_logs").insert({
      user_id: callerUser?.id || null,
      action: "user_password_reset",
      module: "user_management",
      record_id: user_id,
      details: { require_reset: !!require_reset },
    });

    return json({ success: true });
  } catch (error: any) {
    console.error("admin-reset-password error:", error);
    return json({ error: error?.message ?? "Internal server error" }, 500);
  }
});
