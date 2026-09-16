// ALIX Audit Center — legacy session-end compatibility endpoint.
// The current client closes sessions through audit-track. This dependency-free
// fallback remains available for cached clients without a fragile module graph.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json().catch(() => ({})) as { session_id?: string };
    const sessionId = body.session_id?.trim();
    if (!sessionId) return jsonResponse({ error: "session_id required" }, 400);

    const serviceHeaders: Record<string, string> = {
      apikey: serviceKey,
      "Content-Type": "application/json",
    };
    if (!serviceKey.startsWith("sb_secret_")) {
      serviceHeaders.Authorization = `Bearer ${serviceKey}`;
    }

    const updateUrl = `${supabaseUrl}/rest/v1/audit_sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(user.id)}&ended_at=is.null`;
    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: serviceHeaders,
      body: JSON.stringify({ ended_at: new Date().toISOString() }),
    });
    if (!updateResponse.ok) throw new Error(`Audit session close failed (${updateResponse.status})`);

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  }
});
