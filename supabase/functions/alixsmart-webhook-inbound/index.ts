// AlixSmart Webhook Inbound
// Envelope: { event, event_id, occurred_at, source, version, data }
// Header:   x-alixsmart-signature: sha256=<hex> over `${x-alixsmart-timestamp}.${raw body}`
//           (Fallback: HMAC over raw body only, if no timestamp provided)
//           x-alixsmart-event: <event name>  (must match body.event when both present)
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("ALIXSMART_WEBHOOK_SECRET") ?? "";
const MAX_SKEW_SEC = 300;

const H = {
  ...corsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-alixsmart-signature, x-alixsmart-timestamp, x-alixsmart-event",
  "Content-Type": "application/json",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: H });
}

async function hmacHex(msg: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let ok = 0;
  for (let i = 0; i < a.length; i++) ok |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return ok === 0;
}

async function verifySig(raw: string, sigHeader: string | null, ts: string | null) {
  if (!SECRET || !sigHeader) return false;
  const provided = sigHeader.replace(/^sha256=/, "").trim().toLowerCase();
  if (ts) {
    const n = parseInt(ts, 10);
    if (!Number.isFinite(n)) return false;
    const skew = Math.abs(Math.floor(Date.now() / 1000) - n);
    if (skew > MAX_SKEW_SEC) return false;
    const withTs = await hmacHex(`${ts}.${raw}`);
    if (timingSafeEq(withTs, provided)) return true;
  }
  // Fallback: body-only
  const bodyOnly = await hmacHex(raw);
  return timingSafeEq(bodyOnly, provided);
}

// ---------------- Handlers ----------------

async function handleTicketUpdated(supabase: any, d: any) {
  const patch: Record<string, unknown> = {
    status: d.status ?? undefined,
    priority: d.priority ?? undefined,
    subject: d.subject ?? undefined,
    description: d.description ?? undefined,
    customer_name: d.customer?.name ?? undefined,
    customer_email: d.customer?.email ?? undefined,
    serial_number: d.device?.serial_number ?? undefined,
    appointment_at: d.scheduled_at ?? undefined,
    resolved_at: d.resolved_at ?? undefined,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);

  let matched: any = null;
  if (d.external_ticket_id) {
    const { data } = await supabase.from("tickets").select("id")
      .eq("external_ticket_id", d.external_ticket_id).maybeSingle();
    matched = data;
  }
  if (!matched && d.local_ticket_id) {
    const { data } = await supabase.from("tickets").select("id")
      .eq("id", d.local_ticket_id).maybeSingle();
    matched = data;
  }
  if (matched) {
    await supabase.from("tickets").update(patch).eq("id", matched.id);
  } else {
    await supabase.from("tickets").insert({
      ...patch,
      external_ticket_id: d.external_ticket_id,
      source_system: "alixsmart",
      source: "alixsmart",
    });
  }
}

async function handleTicketReply(supabase: any, d: any) {
  if (!d.external_ticket_id) return;
  const { data: t } = await supabase.from("tickets").select("id")
    .eq("external_ticket_id", d.external_ticket_id).maybeSingle();
  if (!t) return;

  const { data: msg } = await supabase.from("ticket_messages").insert({
    ticket_id: t.id,
    external_message_id: d.external_reply_id ?? null,
    sender_type: d.author?.role === "customer" ? "customer" : "staff",
    sender_name: d.author?.name ?? null,
    message: d.body ?? "",
    is_internal: d.visibility === "internal",
    source_system: "alixsmart",
    created_at: d.created_at ?? new Date().toISOString(),
  }).select().single();

  const atts = Array.isArray(d.attachments) ? d.attachments : [];
  for (const a of atts) {
    await supabase.from("ticket_attachments").insert({
      ticket_id: t.id,
      file_url: a.url,
      file_name: a.name ?? null,
      file_type: a.mime ?? null,
      file_size: a.size ?? null,
      source_system: "alixsmart",
    });
  }
}

async function handleDeviceEvent(supabase: any, d: any, registeredNow: boolean) {
  const serial = d.serial_number;
  if (!serial) return;
  const { data: existing } = await supabase
    .from("alixsmart_device_links").select("id").eq("serial_number", serial).maybeSingle();
  const payload: Record<string, unknown> = {
    serial_number: serial,
    alixsmart_user_id: d.owner?.external_customer_id ?? d.customer?.external_id ?? undefined,
    status: registeredNow ? "registered" : (d.maintenance_status ?? undefined),
    registered_at: registeredNow ? (d.registered_at ?? new Date().toISOString()) : undefined,
    last_synced_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (existing) await supabase.from("alixsmart_device_links").update(payload).eq("id", existing.id);
  else await supabase.from("alixsmart_device_links").insert({ serial_number: serial, ...payload });
}

async function handleRegistration(supabase: any, d: any) {
  const email = (d.email ?? "").toLowerCase();
  if (!email) return;
  const { data: existing } = await supabase
    .from("alixsmart_customer_links").select("id").eq("customer_email", email).maybeSingle();
  const payload = {
    customer_email: email,
    alixsmart_user_id: d.external_customer_id ?? null,
    match_method: "webhook",
    last_synced_at: new Date().toISOString(),
  };
  if (existing) await supabase.from("alixsmart_customer_links").update(payload).eq("id", existing.id);
  else await supabase.from("alixsmart_customer_links").insert(payload);
}

async function handleAcademySession(supabase: any, d: any) {
  if (!d.external_id) return;
  const session = {
    source_id: d.external_id,
    title: d.title ?? null,
    start_date: d.starts_at ?? null,
    end_date: d.ends_at ?? null,
    location: d.location ?? null,
    instructor: d.trainer ?? null,
    max_participants: d.capacity ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase
    .from("academy_sessions").select("id").eq("source_id", d.external_id).maybeSingle();
  let sessionId: string;
  if (existing) {
    await supabase.from("academy_sessions").update(session).eq("id", existing.id);
    sessionId = existing.id;
  } else {
    const { data: created } = await supabase.from("academy_sessions").insert(session).select().single();
    sessionId = created.id;
  }
  for (const b of (d.bookings ?? [])) {
    await supabase.from("academy_bookings").upsert({
      academy_session_id: sessionId,
      source_session_id: d.external_id,
      source_customer_id: b.external_customer_id ?? null,
      booking_status: b.status ?? "confirmed",
    }, { onConflict: "source_session_id,source_customer_id" });
  }
}

async function handleOrderUpdated(supabase: any, d: any) {
  const patch: Record<string, unknown> = {
    status: d.status ?? undefined,
    tracking_carrier: d.tracking?.carrier ?? undefined,
    tracking_number: d.tracking?.number ?? undefined,
    tracking_url: d.tracking?.url ?? undefined,
    updated_at: new Date().toISOString(),
  };
  Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
  if (d.local_order_id) {
    await supabase.from("orders").update(patch).eq("id", d.local_order_id);
  } else if (d.external_order_id) {
    await supabase.from("orders").update(patch).eq("order_number", d.external_order_id);
  }
}

// ---------------- Main ----------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });

  const raw = await req.text();
  const sig = req.headers.get("x-alixsmart-signature");
  const ts = req.headers.get("x-alixsmart-timestamp");
  const evtHeader = req.headers.get("x-alixsmart-event");
  const valid = await verifySig(raw, sig, ts);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  let env: any = {};
  try { env = JSON.parse(raw); } catch {}
  const event: string = env.event ?? evtHeader ?? "unknown";
  const eventId: string | null = env.event_id ?? null;
  const data = env.data ?? {};

  // Idempotency: same event_id already processed?
  if (valid && eventId) {
    const { data: dup } = await supabase
      .from("alixsmart_webhook_deliveries")
      .select("id,status").eq("external_id", eventId).eq("status", "processed").maybeSingle();
    if (dup) return json(200, { ok: true, event, event_id: eventId, deduped: true });
  }

  const { data: delivery } = await supabase
    .from("alixsmart_webhook_deliveries")
    .insert({
      event_type: event,
      external_id: eventId,
      signature_valid: valid,
      status: valid ? "received" : "rejected",
      payload: env,
      error: valid ? null : "invalid_signature",
    }).select().single();

  if (!valid) return json(400, { ok: false, error: "invalid_signature" });

  try {
    switch (event) {
      case "ticket.updated":       await handleTicketUpdated(supabase, data); break;
      case "ticket.reply":         await handleTicketReply(supabase, data); break;
      case "device.updated":       await handleDeviceEvent(supabase, data, false); break;
      case "device.registered":    await handleDeviceEvent(supabase, data, true); break;
      case "registration.created":
      case "registration.updated": await handleRegistration(supabase, data); break;
      case "academy.session.updated": await handleAcademySession(supabase, data); break;
      case "order.updated":        await handleOrderUpdated(supabase, data); break;
      default:
        // still persist as generic event
        await supabase.from("alixsmart_events").insert({
          external_id: eventId,
          event_type: event,
          event_at: env.occurred_at ?? new Date().toISOString(),
          payload: env,
        });
    }

    // Persist generic event trail (best effort)
    if (event !== "unknown") {
      await supabase.from("alixsmart_events").upsert({
        external_id: eventId,
        event_type: event,
        event_at: env.occurred_at ?? new Date().toISOString(),
        device_serial: data?.serial_number ?? data?.device?.serial_number ?? null,
        alixsmart_user_id: data?.external_customer_id ?? data?.customer?.external_id ?? null,
        payload: env,
      }, { onConflict: "external_id", ignoreDuplicates: false });
    }

    // Ticket sync log for ticket.* events
    if (event.startsWith("ticket.")) {
      await supabase.from("ticket_sync_logs").insert({
        external_ticket_id: data?.external_ticket_id ?? null,
        direction: "inbound",
        action: event,
        status: "success",
        payload: env,
        response_code: 200,
      });
    }

    await supabase.from("alixsmart_webhook_deliveries")
      .update({ status: "processed" }).eq("id", delivery.id);

    return json(200, { ok: true, event, event_id: eventId });
  } catch (e) {
    await supabase.from("alixsmart_webhook_deliveries")
      .update({ status: "failed", error: (e as Error).message }).eq("id", delivery.id);
    return json(500, { ok: false, error: "processing_failed", detail: (e as Error).message });
  }
});
