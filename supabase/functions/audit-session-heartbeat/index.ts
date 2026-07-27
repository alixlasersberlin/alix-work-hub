// ALIX Audit Center — heartbeat (idle/active + counters)
import { corsHeaders, createAuditServiceClient, jsonResponse, requireAuditUser } from "../_shared/audit-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuditUser(req);
    if ("response" in auth) return auth.response;
    const { user } = auth;
    const supabase = createAuditServiceClient();


    const { session_id, active_delta = 0, idle_delta = 0, clicks = 0, scrolls = 0, keystrokes = 0 } = await req.json();
    if (!session_id) throw new Error("session_id required");

    // Fetch current counters, update
    const { data: cur, error: gErr } = await supabase.from("audit_sessions")
      .select("active_seconds, idle_seconds, click_count, scroll_count, keystroke_count, user_id")
      .eq("id", session_id).single();
    if (gErr) throw gErr;
    if (cur.user_id !== user.id) throw new Error("session mismatch");

    await supabase.from("audit_sessions").update({
      last_heartbeat_at: new Date().toISOString(),
      active_seconds: (cur.active_seconds ?? 0) + Number(active_delta || 0),
      idle_seconds: (cur.idle_seconds ?? 0) + Number(idle_delta || 0),
      click_count: (cur.click_count ?? 0) + Number(clicks || 0),
      scroll_count: (cur.scroll_count ?? 0) + Number(scrolls || 0),
      keystroke_count: (cur.keystroke_count ?? 0) + Number(keystrokes || 0),
    }).eq("id", session_id);

    return jsonResponse({ ok: true });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? String(e) }, 500);
  }
});
