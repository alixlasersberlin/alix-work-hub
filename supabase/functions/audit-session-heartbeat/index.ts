// ALIX Audit Center — heartbeat (idle/active + counters)
// This high-frequency function intentionally uses the Auth and REST endpoints
// directly. Keeping its module graph dependency-free prevents intermittent
// edge-worker metadata load timeouts during cold starts.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type HeartbeatBody = {
  session_id?: string;
  active_delta?: number;
  idle_delta?: number;
  clicks?: number;
  scrolls?: number;
  keystrokes?: number;
};

type AuditSession = {
  user_id: string;
  active_seconds: number | null;
  idle_seconds: number | null;
  click_count: number | null;
  scroll_count: number | null;
  keystroke_count: number | null;
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function nonNegativeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    if (!userResponse.ok) return jsonResponse({ error: "Unauthorized" }, 401);
    const user = await userResponse.json() as { id?: string };
    if (!user.id) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({})) as HeartbeatBody;
    const sessionId = body.session_id?.trim();
    if (!sessionId) return jsonResponse({ error: "session_id required" }, 400);

    const serviceHeaders: Record<string, string> = {
      apikey: serviceKey,
      "Content-Type": "application/json",
    };
    if (!serviceKey.startsWith("sb_secret_")) {
      serviceHeaders.Authorization = `Bearer ${serviceKey}`;
    }

    const sessionUrl = `${supabaseUrl}/rest/v1/audit_sessions?id=eq.${encodeURIComponent(sessionId)}&select=active_seconds,idle_seconds,click_count,scroll_count,keystroke_count,user_id`;
    const sessionResponse = await fetch(sessionUrl, { headers: serviceHeaders });
    if (!sessionResponse.ok) throw new Error(`Audit session lookup failed (${sessionResponse.status})`);
    const sessions = await sessionResponse.json() as AuditSession[];
    const current = sessions[0];
    if (!current) return jsonResponse({ error: "Session not found" }, 404);
    if (current.user_id !== user.id) return jsonResponse({ error: "Session mismatch" }, 403);

    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/audit_sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: serviceHeaders,
      body: JSON.stringify({
        last_heartbeat_at: new Date().toISOString(),
        active_seconds: (current.active_seconds ?? 0) + nonNegativeNumber(body.active_delta),
        idle_seconds: (current.idle_seconds ?? 0) + nonNegativeNumber(body.idle_delta),
        click_count: (current.click_count ?? 0) + nonNegativeNumber(body.clicks),
        scroll_count: (current.scroll_count ?? 0) + nonNegativeNumber(body.scrolls),
        keystroke_count: (current.keystroke_count ?? 0) + nonNegativeNumber(body.keystrokes),
      }),
    });
    if (!updateResponse.ok) throw new Error(`Audit heartbeat update failed (${updateResponse.status})`);

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});
