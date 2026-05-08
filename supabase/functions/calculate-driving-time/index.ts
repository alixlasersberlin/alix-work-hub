import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORIGIN_ADDRESS = "Buchbaumweg 53, 12357 Berlin, Germany";
// Pre-known coordinates for the origin (lon, lat) to save geocoding calls
const ORIGIN_COORDS: [number, number] = [13.4561, 52.4231];

const ORS_BASE = "https://api.openrouteservice.org";

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} Min.`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// In-memory geocode cache (per function instance)
const geoCache = new Map<string, [number, number] | null>();

async function geocode(_apiKey: string, address: string): Promise<[number, number] | null> {
  const key = address.trim().toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key)!;

  // Use Photon (Komoot, OSM-based, no rate limits, no key required)
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lang=de`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "AlixWork/1.0 route-planning" },
    });
    if (!r.ok) {
      console.error("Geocode failed", address, r.status);
      geoCache.set(key, null);
      return null;
    }
    const j = await r.json();
    const coords = j?.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const result: [number, number] = [coords[0], coords[1]];
      geoCache.set(key, result);
      return result;
    }
    geoCache.set(key, null);
    return null;
  } catch (e) {
    console.error("Geocode exception", address, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
  const { data: authData, error: authError } = await supabase.auth.getClaims(token);
  if (authError || !authData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ORS_API_KEY = Deno.env.get("OPENROUTESERVICE_API_KEY");
  if (!ORS_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTESERVICE_API_KEY not configured" }), {
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

    const results: Record<string, { duration_text: string; duration_seconds: number; distance_text: string } | null> = {};

    // ORS Matrix free plan: max 50 locations per request (driving-car)
    // We use 1 origin + up to 49 destinations per batch
    const batchSize = 49;

    for (let i = 0; i < destinations.length; i += batchSize) {
      const batch = destinations.slice(i, i + batchSize);

      // 1) Geocode all addresses in this batch in parallel
      const coordPairs = await Promise.all(
        batch.map(async (d: { id: string; address: string }) => ({
          id: d.id,
          coords: await geocode(ORS_API_KEY, d.address),
        }))
      );

      // Mark failed geocodes
      const valid = coordPairs.filter((p) => p.coords !== null) as { id: string; coords: [number, number] }[];
      coordPairs.filter((p) => p.coords === null).forEach((p) => { results[p.id] = null; });

      if (valid.length === 0) continue;

      // 2) Matrix request: locations[0] = origin, rest = destinations
      const locations = [ORIGIN_COORDS, ...valid.map((v) => v.coords)];
      const matrixUrl = `${ORS_BASE}/v2/matrix/driving-car`;
      const matrixResp = await fetch(matrixUrl, {
        method: "POST",
        headers: {
          "Authorization": ORS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          locations,
          sources: [0],
          destinations: valid.map((_, idx) => idx + 1),
          metrics: ["duration", "distance"],
          units: "m",
        }),
      });

      if (!matrixResp.ok) {
        const txt = await matrixResp.text();
        console.error("ORS Matrix error:", matrixResp.status, txt);
        valid.forEach((v) => { results[v.id] = null; });
        continue;
      }

      const matrixData = await matrixResp.json();
      const durations: (number | null)[] = matrixData?.durations?.[0] || [];
      const distances: (number | null)[] = matrixData?.distances?.[0] || [];

      valid.forEach((v, idx) => {
        const dur = durations[idx];
        const dist = distances[idx];
        if (typeof dur === "number" && typeof dist === "number") {
          results[v.id] = {
            duration_text: formatDuration(dur),
            duration_seconds: Math.round(dur),
            distance_text: formatDistance(dist),
          };
        } else {
          results[v.id] = null;
        }
      });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
