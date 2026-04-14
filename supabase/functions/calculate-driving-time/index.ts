import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

const ORIGIN = "Buchbaumweg 53, 12357 Berlin, Germany";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!GOOGLE_MAPS_API_KEY) {
    return new Response(JSON.stringify({ error: "GOOGLE_MAPS_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { destinations } = await req.json();

    if (!Array.isArray(destinations) || destinations.length === 0) {
      return new Response(JSON.stringify({ error: "destinations array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google Distance Matrix API allows max 25 destinations per request
    const results: Record<string, { duration_text: string; duration_seconds: number; distance_text: string } | null> = {};
    const batchSize = 25;

    for (let i = 0; i < destinations.length; i += batchSize) {
      const batch = destinations.slice(i, i + batchSize);
      const destParam = batch.map((d: { id: string; address: string }) => d.address).join("|");

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(ORIGIN)}&destinations=${encodeURIComponent(destParam)}&mode=driving&language=de&key=${GOOGLE_MAPS_API_KEY}`;

      const resp = await fetch(url);
      const data = await resp.json();

      if (data.status !== "OK") {
        console.error("Google API error:", data.status, data.error_message);
        batch.forEach((d: { id: string }) => { results[d.id] = null; });
        continue;
      }

      const elements = data.rows?.[0]?.elements || [];
      batch.forEach((d: { id: string }, idx: number) => {
        const el = elements[idx];
        if (el?.status === "OK") {
          results[d.id] = {
            duration_text: el.duration.text,
            duration_seconds: el.duration.value,
            distance_text: el.distance.text,
          };
        } else {
          results[d.id] = null;
        }
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
