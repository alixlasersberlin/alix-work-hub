// Phase 7 – KI-Dispatch-Assistent: analysiert die Planung und erzeugt Vorschläge.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.replace("Bearer ", "");
    const { data: userRes } = await sb.auth.getUser(jwt);
    const user = userRes?.user;
    if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401, headers: corsHeaders });

    const body = await req.json().catch(() => ({}));
    const from: string = body?.from ?? new Date().toISOString().slice(0, 10);
    const to: string = body?.to ?? new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);

    const [tours, appts, unplanned, vehicles, drivers] = await Promise.all([
      sb.from("delivery_tours")
        .select("id, tour_number, tour_date, status, driver_id, vehicle_id, planned_distance_km, planned_drive_minutes, planned_work_minutes, utilization_pct, region")
        .gte("tour_date", from).lte("tour_date", to).limit(200),
      sb.from("delivery_appointments")
        .select("id, order_number, company_name, customer_name, status, planned_date, delivery_zip, delivery_city, appointment_type, priority, device_name")
        .gte("planned_date", from).lte("planned_date", to).limit(400),
      sb.from("delivery_appointments")
        .select("id, order_number, company_name, delivery_zip, delivery_city, created_at")
        .is("planned_date", null).limit(100),
      sb.from("vehicles").select("id, license_plate, status, max_payload_kg").limit(100),
      sb.from("drivers").select("id, full_name, is_active").limit(100),
    ]);

    const context = {
      zeitraum: { von: from, bis: to },
      touren: tours.data ?? [],
      termine: appts.data ?? [],
      ungeplante_termine: unplanned.data ?? [],
      fahrzeuge: vehicles.data ?? [],
      fahrer: drivers.data ?? [],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Du bist Disponent-Assistent eines Medizintechnik-Auslieferungsbetriebs (DACH). " +
              "Analysiere die Tourenplanung und liefere konkrete, umsetzbare Vorschläge auf Deutsch. " +
              "Antworte ausschließlich als JSON-Objekt: {\"suggestions\":[{\"category\":\"tourenvorschlag|auslastung|verspaetungsrisiko|buendelung|ressourcen\",\"title\":\"…\",\"detail\":\"…\",\"rationale\":\"…\",\"impact\":\"…\",\"severity\":\"info|warnung|kritisch\"}]}. " +
              "Maximal 8 Vorschläge, keine Wiederholungen, keine erfundenen Daten.",
          },
          { role: "user", content: JSON.stringify(context).slice(0, 120_000) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("AI gateway error", res.status, text);
      return Response.json(
        { error: res.status === 429 ? "Zu viele Anfragen – bitte später erneut versuchen." : res.status === 402 ? "KI-Guthaben aufgebraucht." : "KI-Analyse fehlgeschlagen", details: text },
        { status: res.status, headers: corsHeaders },
      );
    }

    const json = await res.json();
    let parsed: any = {};
    try { parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 8) : [];

    if (suggestions.length) {
      await sb.from("dispatch_ai_suggestions").insert(
        suggestions.map((s: any) => ({
          scope_date: from,
          category: String(s.category ?? "hinweis").slice(0, 60),
          title: String(s.title ?? "Vorschlag").slice(0, 300),
          detail: s.detail ?? null,
          rationale: s.rationale ?? null,
          impact: s.impact ?? null,
          severity: ["info", "warnung", "kritisch"].includes(s.severity) ? s.severity : "info",
          created_by: user.id,
        })),
      );
    }

    return Response.json({ created: suggestions.length, suggestions }, { headers: corsHeaders });
  } catch (e) {
    console.error("dispatch-ai-assistant error", e);
    return Response.json({ error: "Serverfehler" }, { status: 500, headers: corsHeaders });
  }
});
