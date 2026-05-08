import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("OPENROUTESERVICE_API_KEY") ?? "";
  const result: Record<string, unknown> = {
    keyLength: key.length,
    keyPrefix: key.slice(0, 8),
  };

  try {
    const geo = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${encodeURIComponent(key)}&text=Berlin&size=1`,
    );
    result.geocodeStatus = geo.status;
    result.geocodeBody = (await geo.text()).slice(0, 400);
  } catch (e) {
    result.geocodeError = String(e);
  }

  try {
    const mat = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [[13.4, 52.5], [13.5, 52.6]],
        metrics: ["duration"],
      }),
    });
    result.matrixStatus = mat.status;
    result.matrixBody = (await mat.text()).slice(0, 500);
  } catch (e) {
    result.matrixError = String(e);
  }

  try {
    const dir = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({ coordinates: [[13.4, 52.5], [13.5, 52.6]] }),
    });
    result.directionsStatus = dir.status;
    result.directionsBody = (await dir.text()).slice(0, 500);
  } catch (e) {
    result.directionsError = String(e);
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
