import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["Freigeber Bereitstellung", "Freigeber Buchhaltung", "Freigeber Tourenplanung"];

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

    const url = Deno.env.get("SUPABASE_URL")!;
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin } = await caller.rpc("is_admin");
    if (!isAdmin) return json({ error: "Forbidden: Admin only" }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "list";

    const { data: roleRows } = await admin.from("roles").select("id, name").in("name", ROLES);
    const roleByName = new Map((roleRows ?? []).map((r: any) => [r.name, r.id]));
    const nameById = new Map((roleRows ?? []).map((r: any) => [r.id, r.name]));

    if (action === "set") {
      const { user_id, role_name, enabled } = body ?? {};
      if (!user_id || !ROLES.includes(role_name)) return json({ error: "Invalid parameters" }, 400);
      const roleId = roleByName.get(role_name);
      if (!roleId) return json({ error: `Rolle ${role_name} existiert nicht` }, 400);

      if (enabled) {
        const { error } = await admin.from("user_roles").upsert(
          { user_id, role_id: roleId },
          { onConflict: "user_id,role_id", ignoreDuplicates: true },
        );
        if (error) return json({ error: error.message }, 500);
      } else {
        const { error } = await admin.from("user_roles").delete().eq("user_id", user_id).eq("role_id", roleId);
        if (error) return json({ error: error.message }, 500);
      }

      const { data: { user: me } } = await caller.auth.getUser();
      await admin.from("audit_logs").insert({
        user_id: me?.id ?? null,
        action: enabled ? "approver_role_granted" : "approver_role_revoked",
        module: "delivery_approval",
        record_id: user_id,
        details: { role_name },
      });
      return json({ success: true });
    }

    // list
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name, email, status")
      .order("full_name", { ascending: true })
      .limit(1000);

    const ids = (profiles ?? []).map((p: any) => p.id);
    const { data: urs } = await admin
      .from("user_roles")
      .select("user_id, role_id")
      .in("role_id", Array.from(roleByName.values()));

    const map = new Map<string, string[]>();
    for (const r of (urs ?? []) as any[]) {
      if (!ids.includes(r.user_id)) continue;
      const list = map.get(r.user_id) ?? [];
      const n = nameById.get(r.role_id);
      if (n) list.push(n as string);
      map.set(r.user_id, list);
    }

    const users = (profiles ?? [])
      .filter((p: any) => (p.status ?? "active") !== "deleted")
      .map((p: any) => ({ id: p.id, full_name: p.full_name, email: p.email, roles: map.get(p.id) ?? [] }));

    return json({ users });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
