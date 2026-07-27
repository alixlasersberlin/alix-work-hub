// ALIX Audit Center — action tracker (batch)
import { corsHeaders, createAuditServiceClient, jsonResponse, requireAuditUser } from "../_shared/audit-auth.ts";

type Action = {
  ts?: string;
  module: string;
  action: string;
  object_type?: string | null;
  object_id?: string | null;
  duration_ms?: number | null;
  path?: string | null;
  meta?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuditUser(req);
    if ("response" in auth) return auth.response;
    const { user } = auth;
    const supabase = createAuditServiceClient();


    const { session_id, actions } = await req.json() as { session_id?: string; actions: Action[] };
    if (!Array.isArray(actions) || actions.length === 0) {
      return jsonResponse({ ok: true, inserted: 0 });
    }

    if (session_id) {
      const { data: session, error: sessionError } = await supabase
        .from("audit_sessions")
        .select("id, user_id")
        .eq("id", session_id)
        .single();
      if (sessionError) throw sessionError;
      if (session.user_id !== user.id) {
        return jsonResponse({ error: "session mismatch" }, 403);
      }
    }

    // Rate limit: max 200 per call
    const rows = actions.slice(0, 200).map((a) => ({
      ts: a.ts ?? new Date().toISOString(),
      user_id: user.id,
      session_id: session_id ?? null,
      module: String(a.module ?? "unknown").slice(0, 100),
      action: String(a.action ?? "unknown").slice(0, 100),
      object_type: a.object_type ?? null,
      object_id: a.object_id ? String(a.object_id).slice(0, 200) : null,
      duration_ms: a.duration_ms ?? null,
      path: a.path ? String(a.path).slice(0, 500) : null,
      meta: a.meta ?? {},
    }));

    const { error } = await supabase.from("audit_actions").insert(rows);
    if (error) throw error;

    return jsonResponse({ ok: true, inserted: rows.length });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? String(e) }, 500);
  }
});
