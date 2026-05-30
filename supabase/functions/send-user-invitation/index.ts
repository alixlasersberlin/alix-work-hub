import { createClient } from "npm:@supabase/supabase-js@2";
import { sendUserInvitationEmail } from "../_shared/send-user-invitation.ts";

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

    const { user_id } = await req.json();
    if (!user_id) return json({ error: "user_id is required" }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get user profile
    const { data: profile, error: profileError } = await adminClient
      .from("user_profiles")
      .select("email, full_name")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError || !profile?.email) {
      return json({ error: "User profile not found or missing email" }, 404);
    }

    await sendUserInvitationEmail({
      adminClient,
      callerClient,
      userId: user_id,
      email: profile.email,
    });

    return json({
      success: true,
      message: `Invitation sent to ${profile.email}`,
    });
  } catch (error: any) {
    console.error("send-user-invitation error:", error);
    return json({ error: error?.message ?? "Internal server error" }, 500);
  }
});
