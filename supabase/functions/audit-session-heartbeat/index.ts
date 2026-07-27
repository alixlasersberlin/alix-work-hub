// ALIX Audit Center — heartbeat (idle/active + counters)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
