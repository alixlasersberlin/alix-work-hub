// ALIX Audit Center — session end
// Public endpoint (verify_jwt = false) so sendBeacon on unload / after signout still works.
// Only updates ended_at by session_id (UUID); no sensitive data returned.
import { corsHeaders, createAuditServiceClient, jsonResponse } from "../_shared/audit-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { session_id } = await req.json().catch(() => ({}));
    if (!session_id) return jsonResponse({ error: "session_id required" }, 400);

    const supabase = createAuditServiceClient();
    await supabase.from("audit_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", session_id)
      .is("ended_at", null);

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? String(e) }, 500);
  }
});
