import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Read env on every invocation (not just at cold start) so secret rotations take effect immediately
const getAlixSmartConfig = () => ({
  url: Deno.env.get("ALIXSMART_API_URL") || "",
  key: Deno.env.get("ALIXSMART_API_KEY") || "",
});

// Map AlixWork -> AlixSmart status (reverse of inbound STATUS_MAP)
const STATUS_MAP: Record<string, string> = {
  offen: "open",
  in_bearbeitung: "in_progress",
  wartet_kunde: "waiting_customer",
  gelöst: "resolved",
  geschlossen: "closed",
};
const PRIORITY_MAP: Record<string, string> = {
  niedrig: "low",
  normal: "normal",
  hoch: "high",
  kritisch: "critical",
};

type Action =
  | "manual"
  | "status_change"
  | "priority_change"
  | "assignment_change"
  | "customer_status_change"
  | "new_public_message"
  | "ticket_closed";

interface Body {
  ticket_id: string;
  action?: Action;
  message_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    // verify caller
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.ticket_id) return json({ error: "ticket_id required" }, 400);
    const action: Action = body.action || "manual";

    // load ticket
    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", body.ticket_id)
      .maybeSingle();
    if (tErr || !ticket) return json({ error: "ticket not found" }, 404);

    if (!ticket.external_ticket_id) {
      await logSync(supabase, body.ticket_id, null, action, "skipped", "no external_ticket_id", null);
      return json({ ok: false, skipped: "no external_ticket_id" });
    }

    // optional message (only public)
    let msg: any = null;
    if (body.message_id) {
      const { data: m } = await supabase
        .from("ticket_messages")
        .select("id, message, sender_type, sender_name, is_internal, created_at")
        .eq("id", body.message_id)
        .maybeSingle();
      if (m && !m.is_internal) msg = m;
    }

    // Build customer-safe payload (no internal notes, no internal staff info, no department info)
    const payload = {
      external_ticket_id: ticket.external_ticket_id,
      action,
      status: STATUS_MAP[ticket.status] || ticket.status,
      priority: PRIORITY_MAP[ticket.priority] || ticket.priority,
      customer_visible_status: ticket.customer_visible_status || null,
      assigned: ticket.assigned_to ? true : false, // only boolean, no staff identity
      closed: ticket.status === "geschlossen" || ticket.status === "gelöst",
      updated_at: ticket.updated_at,
      ...(msg && {
        public_message: {
          text: msg.message,
          sender_type: msg.sender_type === "customer" ? "customer" : "support",
          created_at: msg.created_at,
        },
      }),
    };

    const { url: ALIXSMART_API_URL, key: ALIXSMART_API_KEY } = getAlixSmartConfig();
    if (!ALIXSMART_API_URL || !ALIXSMART_API_KEY) {
      await logSync(supabase, body.ticket_id, ticket.external_ticket_id, action, "error", "ALIXSMART_API_URL / KEY not configured", payload);
      return json({ error: "AlixSmart endpoint not configured" }, 500);
    }

    // Retry up to 2 attempts (initial + 1 retry) with backoff. Final attempt is logged.
    let status = "success";
    let errorMessage: string | null = null;
    let responseCode: number | null = null;
    const MAX_ATTEMPTS = 2;
    let attempt = 0;
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      status = "success";
      errorMessage = null;
      responseCode = null;
      try {
        const res = await fetch(ALIXSMART_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${ALIXSMART_API_KEY}`,
            "x-api-key": ALIXSMART_API_KEY,
          },
          body: JSON.stringify(payload),
        });
        responseCode = res.status;
        if (!res.ok) {
          status = "error";
          errorMessage = `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`;
        } else {
          await res.text();
        }
      } catch (e) {
        status = "error";
        errorMessage = (e as Error).message;
      }
      if (status === "success") break;
      // Log retry attempt (not final)
      if (attempt < MAX_ATTEMPTS) {
        await logSync(supabase, body.ticket_id, ticket.external_ticket_id, action, "retry", errorMessage, payload, responseCode, attempt);
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    await logSync(supabase, body.ticket_id, ticket.external_ticket_id, action, status, errorMessage, payload, responseCode, attempt);

    if (status === "success") {
      await supabase
        .from("tickets")
        .update({ last_outbound_sync_at: new Date().toISOString() })
        .eq("id", body.ticket_id);
    }

    return json({ ok: status === "success", status, response_code: responseCode, attempt, error: errorMessage, fallback: "polling_via_readapi" });
  } catch (e) {
    console.error("sync-to-alixsmart fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function logSync(
  supabase: any,
  ticket_id: string,
  external_ticket_id: string | null,
  action: string,
  status: string,
  error_message: string | null,
  payload: unknown,
  response_code: number | null = null,
  attempt: number = 1,
) {
  await supabase.from("ticket_outbound_sync_logs").insert({
    ticket_id,
    external_ticket_id,
    action,
    status,
    error_message,
    payload,
    response_code,
    attempt,
    direction: "outbound",
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
