// AlixSmart Webhook Inbound — HMAC-SHA256 signed events
// Header: x-alixsmart-signature: sha256=<hex>
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("ALIXSMART_WEBHOOK_SECRET") ?? "";

const H = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-alixsmart-signature",
  "Content-Type": "application/json",
};

async function verifySig(raw: string, sigHeader: string | null) {
  if (!SECRET || !sigHeader) return false;
  const provided = sigHeader.replace(/^sha256=/, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== provided.length) return false;
  let ok = 0;
  for (let i = 0; i < hex.length; i++) ok |= hex.charCodeAt(i) ^ provided.charCodeAt(i);
  return ok === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method" }), { status: 405, headers: H });

  const raw = await req.text();
  const sigHeader = req.headers.get("x-alixsmart-signature");
  const valid = await verifySig(raw, sigHeader);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let payload: any = {};
  try { payload = JSON.parse(raw); } catch {}

  const eventType = payload.type ?? payload.event_type ?? "unknown";
  const externalId = payload.id ?? payload.event_id ?? null;

  const { data: delivery } = await supabase
    .from("alixsmart_webhook_deliveries")
    .insert({
      event_type: eventType,
      external_id: externalId,
      signature_valid: valid,
      status: valid ? "received" : "rejected",
      payload,
      error: valid ? null : "invalid signature",
    })
    .select().single();

  if (!valid) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401, headers: H });
  }

  try {
    // persist event
    await supabase.from("alixsmart_events").upsert({
      external_id: externalId,
      alixsmart_user_id: payload.user_id ?? payload.alixsmart_user_id ?? null,
      device_serial: payload.serial_number ?? payload.serial ?? null,
      event_type: eventType,
      event_at: payload.event_at ?? payload.created_at ?? new Date().toISOString(),
      payload,
    }, { onConflict: "external_id", ignoreDuplicates: false });

    // Update link tables on registration events
    if (eventType.includes("register") || eventType.includes("registration")) {
      const serial = payload.serial_number ?? payload.serial;
      const userId = payload.user_id ?? payload.alixsmart_user_id;
      const email = (payload.email ?? "").toLowerCase();
      if (serial) {
        const { data: existing } = await supabase
          .from("alixsmart_device_links").select("id").eq("serial_number", serial).maybeSingle();
        const upd = {
          serial_number: serial,
          alixsmart_user_id: userId ?? null,
          registered_at: new Date().toISOString(),
          status: "registered",
          last_synced_at: new Date().toISOString(),
        };
        if (existing) await supabase.from("alixsmart_device_links").update(upd).eq("id", existing.id);
        else await supabase.from("alixsmart_device_links").insert(upd);
      }
      if (email) {
        const { data: existing } = await supabase
          .from("alixsmart_customer_links").select("id").eq("customer_email", email).maybeSingle();
        const upd = {
          customer_email: email,
          alixsmart_user_id: userId ?? null,
          match_method: "webhook",
          last_synced_at: new Date().toISOString(),
        };
        if (existing) await supabase.from("alixsmart_customer_links").update(upd).eq("id", existing.id);
        else await supabase.from("alixsmart_customer_links").insert(upd);
      }
    }

    await supabase.from("alixsmart_webhook_deliveries")
      .update({ status: "processed" }).eq("id", delivery.id);
  } catch (e) {
    await supabase.from("alixsmart_webhook_deliveries")
      .update({ status: "failed", error: (e as Error).message }).eq("id", delivery.id);
    return new Response(JSON.stringify({ error: "processing failed" }), { status: 500, headers: H });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: H });
});
