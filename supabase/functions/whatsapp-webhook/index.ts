// WhatsApp Cloud API Webhook — receives inbound messages and creates/links tickets.
// verify_jwt = false (public webhook, validated via HMAC signature).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function verifySignature(req: Request, raw: string): Promise<boolean> {
  if (!APP_SECRET) return true; // dev fallback
  const sig = req.headers.get("x-hub-signature-256") || "";
  if (!sig.startsWith("sha256=")) return false;
  const expected = sig.slice(7);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === expected;
}

async function log(action: string, status: string, payload: unknown, error?: string) {
  try {
    await admin.from("whatsapp_sync_logs").insert({
      action, status, payload: payload as any, error_message: error ?? null,
    });
  } catch (_) { /* ignore */ }
}

async function fetchMediaUrl(mediaId: string): Promise<string | null> {
  if (!ACCESS_TOKEN) return null;
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    const j = await r.json();
    return j?.url ?? null;
  } catch { return null; }
}

function detectReferences(text: string) {
  const t = text || "";
  const serial = t.match(/\b(SN[-_ ]?[A-Z0-9]{4,})\b/i)?.[1] ?? null;
  const order = t.match(/\b(SO-\d{4,}|INV-\d{4,}|\d{6,})\b/)?.[1] ?? null;
  return { serial, order };
}

async function ensureConversation(phone: string, name?: string) {
  const { data: existing } = await admin
    .from("whatsapp_sc_conversations")
    .select("*").eq("customer_phone", phone).maybeSingle();
  if (existing) {
    await admin.from("whatsapp_sc_conversations").update({
      last_message_at: new Date().toISOString(),
      unread_count: (existing.unread_count ?? 0) + 1,
      customer_name: existing.customer_name ?? name ?? null,
    }).eq("id", existing.id);
    return existing;
  }
  const { data: created, error } = await admin
    .from("whatsapp_sc_conversations")
    .insert({ customer_phone: phone, customer_name: name ?? null, unread_count: 1 })
    .select("*").single();
  if (error) throw error;
  return created;
}

async function linkCustomer(conv: any) {
  if (conv.linked_customer_id) return conv.linked_customer_id;
  const phone = conv.customer_phone.replace(/[^\d+]/g, "");
  const { data } = await admin.from("customers")
    .select("id").or(`phone.eq.${phone},phone.eq.+${phone},phone.eq.${phone.replace(/^\+/, "")}`)
    .limit(1).maybeSingle();
  if (data?.id) {
    await admin.from("whatsapp_sc_conversations")
      .update({ linked_customer_id: data.id }).eq("id", conv.id);
    return data.id;
  }
  return null;
}

async function ensureTicket(conv: any, refs: { serial: string | null; order: string | null }, firstText: string) {
  if (conv.linked_ticket_id) return conv.linked_ticket_id;

  // Try matching by serial or order number first
  if (refs.serial) {
    const { data } = await admin.from("tickets")
      .select("id").eq("serial_number", refs.serial)
      .not("status", "eq", "closed").limit(1).maybeSingle();
    if (data?.id) {
      await admin.from("whatsapp_sc_conversations").update({ linked_ticket_id: data.id }).eq("id", conv.id);
      return data.id;
    }
  }
  if (refs.order) {
    const { data } = await admin.from("tickets")
      .select("id").eq("order_number", refs.order)
      .not("status", "eq", "closed").limit(1).maybeSingle();
    if (data?.id) {
      await admin.from("whatsapp_sc_conversations").update({ linked_ticket_id: data.id }).eq("id", conv.id);
      return data.id;
    }
  }

  // Try matching by phone in tickets (open)
  const { data: openByPhone } = await admin.from("tickets")
    .select("id").eq("customer_phone", conv.customer_phone)
    .not("status", "in", "(closed,Geschlossen)").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (openByPhone?.id) {
    await admin.from("whatsapp_sc_conversations").update({ linked_ticket_id: openByPhone.id }).eq("id", conv.id);
    return openByPhone.id;
  }

  // Create new ticket
  const { data: created, error } = await admin.from("tickets").insert({
    title: `WhatsApp: ${conv.customer_name ?? conv.customer_phone}`,
    description: firstText?.slice(0, 1000) ?? null,
    status: "Neu",
    priority: "Normal",
    department: "service",
    source_system: "whatsapp",
    customer_phone: conv.customer_phone,
    customer_name: conv.customer_name,
    serial_number: refs.serial,
    order_number: refs.order,
  }).select("id").single();
  if (error) { await log("create_ticket", "error", { conv }, error.message); return null; }
  await admin.from("whatsapp_sc_conversations").update({ linked_ticket_id: created.id }).eq("id", conv.id);
  return created.id;
}

async function handleMessage(value: any) {
  const contacts = value?.contacts ?? [];
  const messages = value?.messages ?? [];
  for (const m of messages) {
    const phone = m.from as string;
    const name = contacts?.[0]?.profile?.name ?? null;
    const conv = await ensureConversation(phone, name);
    await linkCustomer(conv);

    let text = "";
    let mediaUrl: string | null = null;
    let mediaType: string | null = null;
    if (m.type === "text") {
      text = m.text?.body ?? "";
    } else if (["image", "video", "document", "audio"].includes(m.type)) {
      mediaType = m.type;
      const id = m[m.type]?.id;
      mediaUrl = id ? await fetchMediaUrl(id) : null;
      text = m[m.type]?.caption ?? "";
    } else {
      text = `[unsupported: ${m.type}]`;
    }

    const refs = detectReferences(text);
    const ticketId = await ensureTicket(conv, refs, text);

    await admin.from("whatsapp_sc_messages").insert({
      conversation_id: conv.id,
      ticket_id: ticketId,
      direction: "in",
      sender_name: name,
      sender_phone: phone,
      message_text: text || null,
      media_url: mediaUrl,
      media_type: mediaType,
      whatsapp_message_id: m.id,
      status: "received",
    });

    if (ticketId) {
      await admin.from("ticket_messages").insert({
        ticket_id: ticketId,
        sender_type: "customer",
        sender_name: name ?? phone,
        message: text || (mediaType ? `[${mediaType}] ${mediaUrl ?? ""}` : ""),
        is_internal: false,
        source_system: "whatsapp",
      });
    }
    await log("inbound", "ok", { phone, ticketId, conv: conv.id });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const ok = await verifySignature(req, raw);
  if (!ok) {
    await log("inbound", "invalid_signature", { len: raw.length });
    return new Response("invalid signature", { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  try {
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change.field === "messages" && change.value) {
          await handleMessage(change.value);
        }
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await log("inbound", "error", body, e?.message ?? String(e));
    return new Response(JSON.stringify({ ok: false, error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
