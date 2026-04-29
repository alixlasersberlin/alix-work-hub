import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SETUP_TOKEN = "scheidler-bootstrap-2026";
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== SETUP_TOKEN) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const email = "l.scheidler@Alix-operation.de";
  const password = "AlixAdmin!2026#Change";
  const fullName = "L. Scheidler";

  // Create auth user
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError || !authUser?.user) {
    return new Response(JSON.stringify({ error: `Auth: ${authError?.message}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = authUser.user.id;

  // Profile
  const { error: profileError } = await admin.from("user_profiles").upsert({
    id: userId,
    full_name: fullName,
    email,
    account_status: "active",
    invitation_status: "accepted",
    is_active: true,
    password_reset_required: true,
    otp_channel: "email",
  });
  if (profileError) {
    return new Response(JSON.stringify({ error: `Profile: ${profileError.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Admin role
  const adminRoleId = "a30b2378-4ef0-4c5f-9ab5-3ec4280e4755";
  const { error: roleError } = await admin.from("user_roles").insert({ user_id: userId, role_id: adminRoleId });
  if (roleError) {
    return new Response(JSON.stringify({ error: `Role: ${roleError.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ success: true, user_id: userId, email, password_temporary: password }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
