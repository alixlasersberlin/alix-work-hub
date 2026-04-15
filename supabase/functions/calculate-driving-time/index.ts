import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORIGIN = "Buchbaumweg 53, 12357 Berlin, Germany";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error: authError } = await supabase.auth.getClaims(token);
  if (authError || !data?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
