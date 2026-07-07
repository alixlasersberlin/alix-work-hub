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

    // Verify calling user is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await callerClient.rpc("is_admin");
    if (!isAdmin) return json({ error: "Forbidden: Admin only" }, 403);

    const { full_name, email, password, phone_number, department_id, otp_channel, role_ids } = await req.json();

    if (!email || !full_name) {
      return json({ error: "email and full_name are required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Create auth user (or reuse if already registered)
    let userId: string;
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: password || undefined,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      const msg = authError.message || "";
      const isDuplicate = /already been registered|already registered|User already registered|duplicate/i.test(msg);
      if (!isDuplicate) {
        return json({ error: `Auth error: ${msg}` }, 400);
      }
      // Look up existing auth user by email so we can attach profile/roles
      let foundId: string | null = null;
      for (let page = 1; page <= 20 && !foundId; page++) {
        const { data: list, error: listErr } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) break;
        const match = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (match) foundId = match.id;
        if (list.users.length < 200) break;
      }
      if (!foundId) {
        return json({ error: `Auth error: ${msg}` }, 400);
      }
      userId = foundId;
    } else {
      userId = authUser.user.id;
    }

    // 2. Upsert user_profile
    const { error: profileError } = await adminClient
      .from("user_profiles")
      .upsert({
        id: userId,
        full_name,
        email,
        phone_number: phone_number || null,
        department_id: department_id || null,
        otp_channel: otp_channel || "sms",
        account_status: "active",
        invitation_status: "pending",
        is_active: true,
        password_reset_required: !password,
      });

    if (profileError) {
      console.error("Profile error:", profileError);
      return json({ error: `Profile error: ${profileError.message}` }, 500);
    }

    // 3. Assign roles
    if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
      const roleInserts = role_ids.map((role_id: string) => ({
        user_id: userId,
        role_id,
      }));
      const { error: rolesError } = await adminClient
        .from("user_roles")
        .insert(roleInserts);

      if (rolesError) {
        console.error("Roles error:", rolesError);
      }
    }

    await sendUserInvitationEmail({
      adminClient,
      callerClient,
      userId,
      email,
    });

    // 4. Audit log
    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    await adminClient.from("audit_logs").insert({
      user_id: callerUser?.id || null,
      action: "user_created",
      module: "user_management",
      record_id: userId,
      details: { email, full_name, role_ids },
    });

    return json({ success: true, user_id: userId });
  } catch (error: any) {
    console.error("create-user error:", error);
    return json({ error: error?.message ?? "Internal server error" }, 500);
  }
});
