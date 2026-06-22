import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { user_id, role_ids, department_id, supplier_id } = await req.json();
    if (!user_id || !Array.isArray(role_ids)) {
      return json({ error: "user_id and role_ids required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Replace roles
    const { error: delErr } = await admin.from("user_roles").delete().eq("user_id", user_id);
    if (delErr) return json({ error: `Delete roles: ${delErr.message}` }, 500);

    if (role_ids.length > 0) {
      const rows = role_ids.map((role_id: string) => ({ user_id, role_id }));
      const { error: insErr } = await admin.from("user_roles").insert(rows);
      if (insErr) return json({ error: `Insert roles: ${insErr.message}` }, 500);
    }

    // Update profile
    const { error: profErr } = await admin.from("user_profiles").update({
      department_id: department_id || null,
      supplier_id: supplier_id || null,
    }).eq("id", user_id);
    if (profErr) return json({ error: `Profile: ${profErr.message}` }, 500);

    // Audit
    const { data: { user: caller } } = await callerClient.auth.getUser();
    await admin.from("audit_logs").insert({
      user_id: caller?.id || null,
      action: "user_roles_updated",
      module: "user_management",
      record_id: user_id,
      details: { role_ids, department_id, supplier_id },
    });

    return json({ success: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
