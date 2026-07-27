// ALIX Audit Center — action tracker (batch)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });


    const { session_id, actions } = await req.json() as { session_id?: string; actions: Action[] };
    if (!Array.isArray(actions) || actions.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
