// Phase 7 – Öffentliche Sendungsverfolgung (kein Login, nur Einmal-Token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256(v: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "");
    if (token.length < 20) {
      return Response.json({ error: "Ungültiger Link" }, { status: 400, headers: corsHeaders });
    }

    const hash = await sha256(token);
    const { data: tok } = await sb
      .from("delivery_confirmation_tokens")
      .select("appointment_id, revoked, expires_at")
      .eq("token_hash", hash)
      .maybeSingle();

    if (!tok || tok.revoked) {
      return Response.json({ error: "Dieser Link ist nicht mehr gültig." }, { status: 404, headers: corsHeaders });
    }

    const { data: appt } = await sb
      .from("delivery_appointments")
      .select(
        "id, order_number, customer_name, company_name, status, appointment_type, planned_date, time_window_start, time_window_end, device_name, delivery_street, delivery_zip, delivery_city, delivered_at",
      )
      .eq("id", tok.appointment_id)
      .maybeSingle();

    if (!appt) return Response.json({ error: "Termin nicht gefunden" }, { status: 404, headers: corsHeaders });

    const { data: events } = await sb
      .from("delivery_tracking_events")
      .select("event_type, message, eta, created_at")
      .eq("appointment_id", appt.id)
      .eq("visible_to_customer", true)
      .order("created_at", { ascending: true });

    const { data: stop } = await sb
      .from("delivery_tour_stops")
      .select("position, planned_arrival, actual_arrival, stop_status, delay_minutes, delivery_tours(tour_date, status)")
      .eq("appointment_id", appt.id)
      .maybeSingle();

    return Response.json(
      {
        appointment: {
          order_number: appt.order_number,
          recipient: appt.company_name || appt.customer_name,
          status: appt.status,
          appointment_type: appt.appointment_type,
          planned_date: appt.planned_date,
          time_window_start: appt.time_window_start,
          time_window_end: appt.time_window_end,
          device_name: appt.device_name,
          city: appt.delivery_city,
          zip: appt.delivery_zip,
          street: appt.delivery_street,
          delivered_at: appt.delivered_at,
        },
        stop: stop
          ? {
              position: stop.position,
              planned_arrival: stop.planned_arrival,
              actual_arrival: stop.actual_arrival,
              stop_status: stop.stop_status,
              delay_minutes: stop.delay_minutes,
              tour_status: (stop as any).delivery_tours?.status ?? null,
            }
          : null,
        events: events ?? [],
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    console.error("delivery-tracking error", e);
    return Response.json({ error: "Serverfehler" }, { status: 500, headers: corsHeaders });
  }
});
