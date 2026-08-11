// Public Termin-Aktionen (Bestätigen / Verschieben / Absagen) über alixwork.de.
// Aufruf: POST { token, action: 'confirm'|'reschedule'|'cancel', new_start?: iso }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const action = typeof body?.action === "string" ? body.action : "lookup";
    const new_start = typeof body?.new_start === "string" ? body.new_start : undefined;
    if (!token) return j({ error: "token required" }, 400);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) return j({ error: "Server configuration missing" }, 500);
    const supabase = createClient(url, serviceRole);

    const { data: ev, error } = await supabase
      .from("esc_events")
      .select("id, ticket_id, start_at, end_at, appointment_status, confirmation_token_expires_at")
      .eq("confirmation_token", token)
      .maybeSingle();
    if (error) throw error;

    if (!ev) {
      const { data: storedRows, error: storedError } = await supabase
        .from("esc_store_appointments")
        .select("id,data")
        .contains("data", { confirmationToken: token })
        .limit(1);
      if (storedError) throw storedError;
      const stored = storedRows?.[0];
      if (!stored?.data) return j({ error: "Ungültiger oder abgelaufener Link." }, 404);
      const appointment = stored.data as Record<string, unknown>;

      if (action === "lookup") return j({ appointment: publicAppointment(appointment) });
      if (action !== "confirm" && action !== "cancel") return j({ error: "unknown action" }, 400);

      const nextStatus = action === "confirm" ? "bestaetigt" : "storniert";
      const updated = { ...appointment, status: nextStatus, updatedAt: new Date().toISOString() };
      const { error: updateError } = await supabase
        .from("esc_store_appointments")
        .update({ data: updated, updated_at: new Date().toISOString() })
        .eq("id", stored.id);
      if (updateError) throw updateError;
      return j({ success: true, appointment_status: nextStatus, appointment: publicAppointment(updated) });
    }
    if (ev.confirmation_token_expires_at && new Date(ev.confirmation_token_expires_at) < new Date()) {
      return j({ error: "Link ist abgelaufen." }, 410);
    }

    if (action === "lookup") {
      const { data: detail, error: detailError } = await supabase
        .from("esc_events")
        .select("id,title,description,start_at,end_at,customer_name,address,location,appointment_status,confirmation_token")
        .eq("id", ev.id)
        .single();
      if (detailError) throw detailError;
      return j({ appointment: {
        id: detail.id,
        title: detail.title,
        description: detail.description,
        startAt: detail.start_at,
        endAt: detail.end_at,
        customerName: detail.customer_name,
        address: detail.address,
        location: detail.location,
        status: detail.appointment_status,
        confirmationToken: detail.confirmation_token,
      } });
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

function publicAppointment(appointment: Record<string, unknown>) {
  return {
    id: appointment.id,
    title: appointment.title,
    description: appointment.description,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    customerName: appointment.customerName,
    address: appointment.address,
    location: appointment.location,
    status: appointment.status,
    confirmationToken: appointment.confirmationToken,
  };
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
