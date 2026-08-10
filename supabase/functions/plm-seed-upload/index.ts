import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-key, x-path",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const key = req.headers.get("x-seed-key");
  if (!key || key !== Deno.env.get("ALIXWORK_SHARED_KEY")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  const path = req.headers.get("x-path");
  if (!path) return new Response(JSON.stringify({ error: "missing x-path" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = new Uint8Array(await req.arrayBuffer());
  const contentType = req.headers.get("content-type") || "application/octet-stream";
  const { error } = await supabase.storage.from("plm-media").upload(path, body, { contentType, upsert: true });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  return new Response(JSON.stringify({ ok: true, path }), { headers: { ...cors, "Content-Type": "application/json" } });
});
