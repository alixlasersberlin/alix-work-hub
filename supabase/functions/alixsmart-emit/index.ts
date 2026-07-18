// Outbound: emit signed events to AlixSmart's inbound webhook.
// Same envelope + HMAC scheme as our own alixsmart-webhook-inbound.
// POST body: { event: string, data: object, event_id?: string }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("ALIXSMART_WEBHOOK_SECRET") ?? "";
const BASE = (Deno.env.get("ALIXSMART_API_BASE_URL") ?? "").replace(/\/$/, "");
const TARGET_PATH = "/alixsmart-webhook-inbound";

const H = { ...corsHeaders, "Content-Type": "application/json" };
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: H });

async function hmacHex(msg: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });
  if (!SECRET || !BASE) return json(500, { ok: false, error: "not_configured" });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let body: any;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "invalid_json" }); }
  const { event, data } = body ?? {};
  if (!event || typeof event !== "string" || !data || typeof data !== "object") {
    return json(400, { ok: false, error: "event_and_data_required" });
  }

  const envelope = {
    event,
    event_id: body.event_id ?? `evt_${crypto.randomUUID()}`,
    occurred_at: new Date().toISOString(),
    source: "alixwork",
    version: "1",
    data,
  };
  const raw = JSON.stringify(envelope);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = "sha256=" + await hmacHex(`${ts}.${raw}`);

  const started = Date.now();
  let status = 0, respText = "";
  try {
    const res = await fetch(BASE + TARGET_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-alixsmart-signature": sig,
        "x-alixsmart-timestamp": ts,
        "x-alixsmart-event": event,
      },
      body: raw,
    });
    status = res.status;
    respText = (await res.text()).slice(0, 500);
  } catch (e) {
    respText = (e as Error).message;
  }

  const ok = status >= 200 && status < 300;
  await supabase.from("ticket_outbound_sync_logs").insert({
    external_ticket_id: data?.external_ticket_id ?? null,
    direction: "outbound",
    action: event,
    status: ok ? "success" : "failed",
    response_code: status,
    payload: envelope,
    error_message: ok ? null : respText,
  }).then(() => {}, () => {}); // best-effort log
  void started;

  return json(status >= 200 && status < 300 ? 200 : 502, {
    ok: status >= 200 && status < 300,
    event_id: envelope.event_id,
    upstream_status: status,
    upstream_body: respText,
  });
});
