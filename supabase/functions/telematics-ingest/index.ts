// Telematik-Ingest: nimmt Positions-/Kilometerdaten von Telematik-Anbietern entgegen
// und aktualisiert die Fahrzeugstammdaten (odometer_km, fuel_level_pct, range_km).
// Auth: Header "x-telematics-secret" muss dem Secret TELEMATICS_INGEST_SECRET entsprechen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telematics-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("TELEMATICS_INGEST_SECRET") || "";

type Reading = {
  device_id?: string;
  license_plate?: string;
  odometer_km?: number;
  fuel_level_pct?: number;
  range_km?: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SECRET) return json({ error: "not_configured" }, 503);
  if (req.headers.get("x-telematics-secret") !== SECRET) return json({ error: "unauthorized" }, 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const readings: Reading[] = Array.isArray(payload) ? payload : Array.isArray(payload?.readings) ? payload.readings : [payload];
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  let updated = 0;
  const unmatched: string[] = [];

  for (const r of readings.slice(0, 500)) {
    const key = r.device_id ?? r.license_plate;
    if (!key) continue;

    let q = sb.from("vehicles").select("id, odometer_km").limit(1);
    q = r.device_id ? q.eq("telematics_device_id", r.device_id) : q.eq("license_plate", r.license_plate!);
    const { data: v } = await q.maybeSingle();
    if (!v) {
      unmatched.push(String(key));
      continue;
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // Kilometerstand nur vorwärts fortschreiben
    if (r.odometer_km != null && Number(r.odometer_km) >= Number(v.odometer_km ?? 0)) patch.odometer_km = Number(r.odometer_km);
    if (r.fuel_level_pct != null) patch.fuel_level_pct = Math.max(0, Math.min(100, Number(r.fuel_level_pct)));
    if (r.range_km != null) patch.range_km = Number(r.range_km);
    if (Object.keys(patch).length === 1) continue;

    const { error } = await sb.from("vehicles").update(patch).eq("id", v.id);
    if (!error) updated++;
  }

  return json({ received: readings.length, updated, unmatched });
});
