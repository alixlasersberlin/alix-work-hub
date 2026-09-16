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

type Heartbeat = {
  active_delta?: number;
  idle_delta?: number;
  clicks?: number;
  scrolls?: number;
  keystrokes?: number;
};

function nonNegativeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuditUser(req);
    if ("response" in auth) return auth.response;
    const { user } = auth;
    const supabase = createAuditServiceClient();


    const { session_id, actions, heartbeat, end_session } = await req.json() as {
      session_id?: string;
      actions?: Action[];
      heartbeat?: Heartbeat;
      end_session?: boolean;
    };

    if (!session_id && heartbeat) {
      return jsonResponse({ error: "session_id required for heartbeat" }, 400);
    }

    let session: {
      id: string;
      user_id: string;
      active_seconds: number | null;
      idle_seconds: number | null;
      click_count: number | null;
      scroll_count: number | null;
      keystroke_count: number | null;
    } | null = null;
    if (session_id) {
      const { data, error: sessionError } = await supabase
        .from("audit_sessions")
        .select("id, user_id, active_seconds, idle_seconds, click_count, scroll_count, keystroke_count")
        .eq("id", session_id)
        .single();
      if (sessionError) throw sessionError;
      session = data;
      if (session.user_id !== user.id) {
        return jsonResponse({ error: "session mismatch" }, 403);
      }
    }

    if (heartbeat && session) {
      const { error: heartbeatError } = await supabase
        .from("audit_sessions")
        .update({
          last_heartbeat_at: new Date().toISOString(),
          active_seconds: (session.active_seconds ?? 0) + nonNegativeNumber(heartbeat.active_delta),
          idle_seconds: (session.idle_seconds ?? 0) + nonNegativeNumber(heartbeat.idle_delta),
          click_count: (session.click_count ?? 0) + nonNegativeNumber(heartbeat.clicks),
          scroll_count: (session.scroll_count ?? 0) + nonNegativeNumber(heartbeat.scrolls),
          keystroke_count: (session.keystroke_count ?? 0) + nonNegativeNumber(heartbeat.keystrokes),
        })
        .eq("id", session_id)
        .eq("user_id", user.id);
      if (heartbeatError) throw heartbeatError;
    }

    if (end_session && session) {
      const { error: endError } = await supabase
        .from("audit_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", session_id)
        .eq("user_id", user.id)
        .is("ended_at", null);
      if (endError) throw endError;
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return jsonResponse({
        ok: true,
        inserted: 0,
        heartbeat: Boolean(heartbeat),
        session_ended: Boolean(end_session),
      });
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
