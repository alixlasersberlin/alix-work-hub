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

    // Actually SEND the invitation email via Supabase Auth
    const { error: linkError } = await adminClient.auth.admin.inviteUserByEmail(
      profile.email,
    );

    if (linkError) {
      // If user already exists in auth, fall back to a magic link email
      const { error: magicErr } = await adminClient.auth.signInWithOtp({
        email: profile.email,
        options: { shouldCreateUser: false },
      });
      if (magicErr) {
        return json({ error: `Invitation send error: ${linkError.message} / ${magicErr.message}` }, 500);
      }
    }

    // Record invitation
    const { error: invError } = await adminClient.from("user_invitations").insert({
      user_id,
      email: profile.email,
      invitation_status: "sent",
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: (await callerClient.auth.getUser()).data.user?.id || null,
    });

    if (invError) {
      console.error("Invitation record error:", invError);
    }

    // Update invitation_status on profile
    await adminClient
      .from("user_profiles")
      .update({ invitation_status: "sent" })
      .eq("id", user_id);

    // Audit
    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    await adminClient.from("audit_logs").insert({
      user_id: callerUser?.id || null,
      action: "invitation_sent",
      module: "user_management",
      record_id: user_id,
      details: { email: profile.email },
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
