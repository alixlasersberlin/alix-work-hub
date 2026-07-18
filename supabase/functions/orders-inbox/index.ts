// Public webhook: accepts orders from external AlixWork senders.
// Auth via x-alix-key header matching ALIXWORK_SHARED_KEY.
// verify_jwt is disabled (via config.toml) so external systems can POST directly.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const EXTRA_HEADERS = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-alix-key, x-idempotency-key",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...EXTRA_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: EXTRA_HEADERS });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const expected = Deno.env.get("ALIXWORK_SHARED_KEY");
  if (!expected) return json(500, { error: "shared_key_not_configured" });

  const provided = req.headers.get("x-alix-key");
  if (!provided || provided !== expected) {
    return json(401, { error: "unauthorized" });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!payload || typeof payload !== "object") {
    return json(400, { error: "payload_required" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const idem =
    req.headers.get("x-idempotency-key") ||
    payload.idempotency_key ||
    payload.message_id ||
    null;

  const source_system =
    payload.source_system || payload.source || req.headers.get("x-source-system") || null;
  const external_id =
    payload.external_id || payload.order_id || payload.order_number || null;

  // Dedup on idempotency_key
  if (idem) {
    const { data: existing } = await supabase
      .from("orders_inbox")
      .select("id,status")
      .eq("idempotency_key", idem)
      .maybeSingle();
    if (existing) {
      return json(200, {
        ok: true,
        deduped: true,
        id: existing.id,
        status: existing.status,
      });
    }
  }

  const { data, error } = await supabase
    .from("orders_inbox")
    .insert({
      source_system,
      external_id,
      idempotency_key: idem,
      payload,
      status: "received",
    })
    .select("id")
    .single();

  if (error) {
    console.error("orders-inbox insert error", error);
    return json(500, { error: "insert_failed", detail: error.message });
  }

  return json(202, { ok: true, id: data.id, status: "received" });
});
