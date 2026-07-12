// Public Termin-Aktionen (Bestätigen / Verschieben / Absagen) über alixwork.de.
// Aufruf: POST { token, action: 'confirm'|'reschedule'|'cancel', new_start?: iso }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, action, new_start } = await req.json();
    if (!token || !action) return j({ error: "token & action required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ev, error } = await supabase
      .from("esc_events")
      .select("id, ticket_id, start_at, end_at, appointment_status, confirmation_token_expires_at")
      .eq("confirmation_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!ev) return j({ error: "Ungültiger oder abgelaufener Link." }, 404);
    if (ev.confirmation_token_expires_at && new Date(ev.confirmation_token_expires_at) < new Date()) {
      return j({ error: "Link ist abgelaufen." }, 410);
    }

    const patch: Record<string, unknown> = {};
    let ticketStatus: string | null = null;

    if (action === "confirm") {
      patch.appointment_status = "bestaetigt";
      patch.confirmation_status = "confirmed";
      ticketStatus = "Termin vereinbart";
    } else if (action === "cancel") {
      patch.appointment_status = "abgesagt";
      patch.confirmation_status = "declined";
      ticketStatus = "Warten auf Kunde";
    } else if (action === "reschedule") {
      if (!new_start) return j({ error: "new_start required" }, 400);
      const duration = new Date(ev.end_at).getTime() - new Date(ev.start_at).getTime();
      const start = new Date(new_start);
      patch.start_at = start.toISOString();
      patch.end_at = new Date(start.getTime() + duration).toISOString();
      patch.appointment_status = "verschoben";
      patch.confirmation_status = "pending";
      ticketStatus = "Termin vereinbart";
    } else {
      return j({ error: "unknown action" }, 400);
    }

    const { error: uErr } = await supabase.from("esc_events").update(patch).eq("id", ev.id);
    if (uErr) throw uErr;

    if (ev.ticket_id && ticketStatus) {
      await supabase.from("tickets").update({ status: ticketStatus }).eq("id", ev.ticket_id);
      await supabase.from("ticket_history").insert({
        ticket_id: ev.ticket_id,
        action: `customer_${action}`,
        field: "appointment",
        new_value: (patch.appointment_status as string) ?? null,
        meta: { event_id: ev.id, new_start: (patch.start_at as string) ?? null },
      });
    }

    return j({ success: true, appointment_status: patch.appointment_status });
  } catch (err) {
    console.error("public-appointment-action error", err);
    return j({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
