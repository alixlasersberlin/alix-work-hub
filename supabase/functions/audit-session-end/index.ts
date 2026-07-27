// ALIX Audit Center — session end
import { corsHeaders, createAuditServiceClient, jsonResponse, requireAuditUser } from "../_shared/audit-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuditUser(req);
    if ("response" in auth) return auth.response;
    const { user } = auth;
    const supabase = createAuditServiceClient();


    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) throw new Error("session_id required");

    await supabase.from("audit_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", session_id)
      .eq("user_id", user.id);

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? String(e) }, 500);
  }
});
