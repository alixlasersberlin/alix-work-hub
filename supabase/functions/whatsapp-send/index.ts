// Send WhatsApp message via Cloud API on behalf of an authenticated user.
// verify_jwt = true (caller must be authenticated).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
  text: z.string().min(1).max(4096).optional(),
  template_key: z.string().optional(),
  media_url: z.string().url().optional(),
  media_type: z.enum(["image", "video", "document", "audio"]).optional(),
}).refine(b => b.text || b.template_key || b.media_url, { message: "text, template_key or media_url required" });

async function log(action: string, status: string, payload: unknown, error?: string) {
  try {
    await admin.from("whatsapp_sync_logs").insert({
      action, status, payload: payload as any, error_message: error ?? null,
    });
  } catch (_) {}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate user
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims } = await userClient.auth.getClaims(token);
  if (!claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub as string;

  // Role check: Admin or Kundenservice
  const { data: roleRows } = await admin
    .from("user_roles").select("role_id, roles(name)").eq("user_id", userId);
  const roles = (roleRows ?? []).map((r: any) => r?.roles?.name).filter(Boolean);
  const allowed = roles.some((r: string) => ["Super Admin", "Admin", "Kundenservice"].includes(r));
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const body = parsed.data;

  // Load conversation
  const { data: conv, error: convErr } = await admin
    .from("whatsapp_sc_conversations").select("*").eq("id", body.conversation_id).single();
  if (convErr || !conv) {
    return new Response(JSON.stringify({ error: "conversation not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (conv.opt_out) {
    return new Response(JSON.stringify({ error: "Kunde hat WhatsApp-Kommunikation deaktiviert (Opt-out)" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve text from template if needed
  let text = body.text ?? "";
  if (!text && body.template_key) {
    const { data: tpl } = await admin
      .from("whatsapp_sc_templates").select("body").eq("key", body.template_key).maybeSingle();
    text = tpl?.body ?? "";
  }

  if (!PHONE_ID || !ACCESS_TOKEN) {
    await log("outbound", "config_missing", { conv: conv.id });
    return new Response(JSON.stringify({ error: "WhatsApp config missing" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build Cloud API payload
  let payload: any;
  if (body.media_url && body.media_type) {
    payload = {
      messaging_product: "whatsapp",
      to: conv.customer_phone,
      type: body.media_type,
      [body.media_type]: { link: body.media_url, ...(text ? { caption: text } : {}) },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      to: conv.customer_phone,
      type: "text",
      text: { body: text },
    };
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    await log("outbound", "error", { payload, json }, json?.error?.message ?? "send failed");
    return new Response(JSON.stringify({ error: json?.error?.message ?? "send failed", details: json }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const waId = json?.messages?.[0]?.id ?? null;

  // Persist outbound message
  await admin.from("whatsapp_sc_messages").insert({
    conversation_id: conv.id,
    ticket_id: conv.linked_ticket_id,
    direction: "out",
    sender_name: "AlixWork",
    sender_phone: PHONE_ID,
    message_text: text || null,
    media_url: body.media_url ?? null,
    media_type: body.media_type ?? null,
    whatsapp_message_id: waId,
    status: "sent",
  });

  // Mirror to ticket_messages (public)
  if (conv.linked_ticket_id) {
    await admin.from("ticket_messages").insert({
      ticket_id: conv.linked_ticket_id,
      sender_type: "agent",
      sender_name: "AlixWork",
      message: text || `[${body.media_type ?? "media"}]`,
      is_internal: false,
      source_system: "whatsapp",
    });
  }

  await admin.from("whatsapp_sc_conversations").update({
    last_message_at: new Date().toISOString(),
    unread_count: 0,
  }).eq("id", conv.id);

  await log("outbound", "ok", { conv: conv.id, waId });

  return new Response(JSON.stringify({ ok: true, message_id: waId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
