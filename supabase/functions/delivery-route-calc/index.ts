import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_START = "Buchbaumweg 53, 12357 Berlin, Germany";
const DEFAULT_START_COORDS: [number, number] = [13.4561, 52.4231];
const ORS_BASE = "https://api.openrouteservice.org";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Zu ungenaue Treffer (Land/Bundesland/Region) sind für Routen unbrauchbar. */
const COARSE_TYPES = new Set(["country", "state", "region", "county", "continent"]);

async function geocode(address: string): Promise<[number, number] | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lang=de`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "AlixWork/1.0 dispatch" } });
      if (r.ok) {
        const j = await r.json();
        const f = j?.features?.[0];
        const c = f?.geometry?.coordinates;
        const type = String(f?.properties?.type ?? "");
        if (COARSE_TYPES.has(type)) {
          console.warn("geocode too coarse", address, type);
          return null;
        }
        if (Array.isArray(c) && c.length >= 2) return [c[0], c[1]];
        return null;
      }
      if (r.status < 500) return null;
    } catch (_e) {
      /* retry */
    }
    await sleep(400 * (attempt + 1));
  }
  return null;
}

/** Ohne Straße + (PLZ oder Ort) ist eine Geokodierung wertlos. */
function usableAddress(a: any): string | null {
  const street = String(a?.delivery_street ?? "").trim();
  const zip = String(a?.delivery_zip ?? "").trim();
  const city = String(a?.delivery_city ?? "").trim();
  if (!street || (!zip && !city)) return null;
  return [street, `${zip} ${city}`.trim(), a?.delivery_country || "Deutschland"].filter(Boolean).join(", ");
}


/** NxN Distanz-/Zeitmatrix. Fällt bei ORS-Problemen auf Luftlinie zurück. */
async function buildMatrix(locations: [number, number][], apiKey: string | undefined) {
  const n = locations.length;
  if (apiKey && n <= 50) {
    try {
      const resp = await fetch(`${ORS_BASE}/v2/matrix/driving-car`, {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ locations, metrics: ["duration", "distance"], units: "m" }),
      });
      if (resp.ok) {
        const j = await resp.json();
        if (j?.distances && j?.durations) {
          return {
            provider: "openrouteservice",
            dist: j.distances.map((row: number[]) => row.map((m) => (m ?? 0) / 1000)),
            dur: j.durations.map((row: number[]) => row.map((s) => (s ?? 0) / 60)),
          };
        }
      } else {
        console.warn("ORS matrix failed", resp.status, await resp.text());
      }
    } catch (e) {
      console.warn("ORS matrix exception", (e as Error).message);
    }
  }
  // Fallback: Luftlinie * 1.3, 60 km/h Schnitt
  const dist = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : haversineKm(locations[i], locations[j]) * 1.3)),
  );
  const dur = dist.map((row) => row.map((km) => (km / 60) * 60));
  return { provider: "haversine", dist, dur };
}

type StopInput = {
  id: string;
  appointment_id: string;
  label: string;
  coords: [number, number] | null;
  duration_minutes: number;
  is_vip: boolean;
  priority: string | null;
  window_start: string | null;
  window_end: string | null;
};

function minutesFromTime(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

/** Nearest-Neighbour + 2-opt mit Zeitfenster-, Prioritäts- und VIP-Gewichtung. */
function optimizeOrder(stops: StopInput[], dur: number[][], startMinutes: number): number[] {
  const n = stops.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n <= 1) return idx;

  const penalty = (stopIdx: number, arrival: number) => {
    const s = stops[stopIdx];
    let p = 0;
    const ws = minutesFromTime(s.window_start);
    const we = minutesFromTime(s.window_end);
    if (we != null && arrival > we) p += (arrival - we) * 4;
    if (ws != null && arrival < ws) p += (ws - arrival) * 0.5;
    if (s.is_vip) p -= 45;
    if (s.priority === 'hoch' || s.priority === 'high') p -= 20;
    return p;
  };

  // Nearest Neighbour ab Start (Matrixindex 0 = Start, Stops = i+1)
  const unvisited = new Set(idx);
  const order: number[] = [];
  let current = 0;
  let clock = startMinutes;
  while (unvisited.size) {
    let best = -1;
    let bestCost = Infinity;
    for (const i of unvisited) {
      const drive = dur[current][i + 1] ?? 0;
      const cost = drive + penalty(i, clock + drive);
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    }
    const drive = dur[current][best + 1] ?? 0;
    clock += drive + (stops[best].duration_minutes || 0);
    order.push(best);
    unvisited.delete(best);
    current = best + 1;
  }

  const totalCost = (seq: number[]) => {
    let c = 0;
    let node = 0;
    let t = startMinutes;
    for (const i of seq) {
      const drive = dur[node][i + 1] ?? 0;
      t += drive;
      c += drive + penalty(i, t);
      t += stops[i].duration_minutes || 0;
      node = i + 1;
    }
    return c;
  };

  // 2-opt
  let improved = true;
  let guard = 0;
  let bestSeq = order;
  let bestVal = totalCost(bestSeq);
  while (improved && guard++ < 40) {
    improved = false;
    for (let a = 0; a < n - 1; a++) {
      for (let b = a + 1; b < n; b++) {
        const cand = bestSeq.slice(0, a).concat(bestSeq.slice(a, b + 1).reverse(), bestSeq.slice(b + 1));
        const val = totalCost(cand);
        if (val < bestVal - 0.01) {
          bestSeq = cand;
          bestVal = val;
          improved = true;
        }
      }
    }
  }
  return bestSeq;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (authErr || !claims?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const tourId = String(body?.tour_id || "");
    const optimize = body?.optimize === true;
    if (!tourId) {
      return new Response(JSON.stringify({ error: "tour_id erforderlich" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tour, error: tourErr } = await admin
      .from("delivery_tours")
      .select("id, tour_date, planned_start_time, custom_start_address, planned_break_minutes")
      .eq("id", tourId)
      .maybeSingle();
    if (tourErr || !tour) throw new Error(tourErr?.message || "Tour nicht gefunden");

    const { data: stopRows, error: stopErr } = await admin
      .from("delivery_tour_stops")
      .select(
        "id, appointment_id, position, delivery_appointments:appointment_id(id, customer_name, company_name, delivery_street, delivery_zip, delivery_city, delivery_country, delivery_lat, delivery_lng, duration_minutes, is_vip, priority, time_window_start, time_window_end)",
      )
      .eq("tour_id", tourId)
      .order("position", { ascending: true });
    if (stopErr) throw new Error(stopErr.message);

    const rows = stopRows ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "Tour hat keine Stopps" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startAddress = body?.start_address || tour.custom_start_address || DEFAULT_START;
    const startCoords =
      startAddress === DEFAULT_START ? DEFAULT_START_COORDS : (await geocode(startAddress)) ?? DEFAULT_START_COORDS;

    const stops: StopInput[] = [];
    for (const r of rows) {
      const a: any = (r as any).delivery_appointments;
      const address = usableAddress(a);
      let coords: [number, number] | null =
        a?.delivery_lat != null && a?.delivery_lng != null ? [Number(a.delivery_lng), Number(a.delivery_lat)] : null;
      // Ohne belastbare Adresse sind gespeicherte Koordinaten oft ein Länder-Mittelpunkt → verwerfen.
      if (coords && !address) {
        console.warn("verwerfe Koordinaten ohne Adresse", a?.id);
        coords = null;
        await admin.from("delivery_appointments").update({ delivery_lat: null, delivery_lng: null }).eq("id", a.id);
      }
      if (!coords && address) {
        coords = await geocode(address);
        if (coords) {
          await admin
            .from("delivery_appointments")
            .update({ delivery_lng: coords[0], delivery_lat: coords[1] })
            .eq("id", a.id);
        }
      }
      stops.push({
        id: (r as any).id,
        appointment_id: (r as any).appointment_id,
        label: a?.company_name || a?.customer_name || address || "Ohne Adresse",
        coords,
        duration_minutes: Number(a?.duration_minutes) || 60,
        is_vip: !!a?.is_vip,
        priority: a?.priority ?? null,
        window_start: a?.time_window_start ?? null,
        window_end: a?.time_window_end ?? null,
      });
    }

    // Stopps ohne Koordinaten dürfen keine Kilometer/Zeiten aus einer alten Berechnung behalten.
    for (const s of stops.filter((x) => !x.coords)) {
      await admin
        .from("delivery_tour_stops")
        .update({ distance_from_prev_km: null, drive_minutes_from_prev: null, planned_arrival: null, planned_departure: null })
        .eq("id", s.id);
    }


    const missing = stops.filter((s) => !s.coords).map((s) => s.label);
    const geoStops = stops.filter((s) => s.coords);
    if (geoStops.length === 0) {
      await admin
        .from("delivery_tours")
        .update({ planned_distance_km: 0, planned_drive_minutes: 0, planned_work_minutes: 0, utilization_pct: 0 })
        .eq("id", tourId);
      throw new Error(`Keine gültige Lieferadresse vorhanden: ${missing.join(", ")}`);
    }

    const locations: [number, number][] = [startCoords, ...geoStops.map((s) => s.coords!)];
    const { dist, dur, provider } = await buildMatrix(locations, Deno.env.get("OPENROUTESERVICE_API_KEY"));

    const startMinutes = minutesFromTime(tour.planned_start_time) ?? 8 * 60;
    const seq = optimize
      ? optimizeOrder(geoStops, dur, startMinutes)
      : geoStops.map((_, i) => i);

    // Stopps schreiben
    let totalKm = 0;
    let totalDrive = 0;
    let clock = startMinutes;
    let node = 0;
    const resultStops: any[] = [];
    for (let pos = 0; pos < seq.length; pos++) {
      const i = seq[pos];
      const s = geoStops[i];
      const km = dist[node][i + 1] ?? 0;
      const drive = dur[node][i + 1] ?? 0;
      totalKm += km;
      totalDrive += drive;
      clock += drive;
      const arrival = new Date(`${tour.tour_date}T00:00:00Z`);
      arrival.setUTCMinutes(Math.round(clock));
      const departure = new Date(arrival);
      departure.setUTCMinutes(departure.getUTCMinutes() + (s.duration_minutes || 60));
      await admin
        .from("delivery_tour_stops")
        .update({
          position: pos + 1,
          distance_from_prev_km: Number(km.toFixed(1)),
          drive_minutes_from_prev: Math.round(drive),
          planned_arrival: arrival.toISOString(),
          planned_departure: departure.toISOString(),
        })
        .eq("id", s.id);
      resultStops.push({
        stop_id: s.id,
        position: pos + 1,
        label: s.label,
        distance_km: Number(km.toFixed(1)),
        drive_minutes: Math.round(drive),
        planned_arrival: arrival.toISOString(),
      });
      clock += s.duration_minutes || 60;
      node = i + 1;
    }

    // Rückfahrt zum Start
    const backKm = dist[node][0] ?? 0;
    const backDrive = dur[node][0] ?? 0;
    totalKm += backKm;
    totalDrive += backDrive;
    const workMinutes = Math.round(clock + backDrive - startMinutes);

    await admin
      .from("delivery_tours")
      .update({
        planned_distance_km: Number(totalKm.toFixed(1)),
        planned_drive_minutes: Math.round(totalDrive),
        planned_work_minutes: workMinutes,
        utilization_pct: Number(Math.min(100, (workMinutes / (8 * 60)) * 100).toFixed(1)),
        planned_end_time: new Date(Date.UTC(2000, 0, 1, 0, Math.round(clock + backDrive)))
          .toISOString()
          .slice(11, 19),
      })
      .eq("id", tourId);

    // Ergebnis cachen
    await admin.from("route_calculations").insert({
      cache_key: `tour:${tourId}:${tour.tour_date}:${seq.length}`,
      origin: startAddress,
      destination: `tour:${tourId}`,
      distance_km: Number(totalKm.toFixed(1)),
      duration_minutes: Math.round(totalDrive),
      provider,
      raw: { stops: resultStops, optimize, missing },
      expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    });

    return new Response(
      JSON.stringify({
        ok: true,
        provider,
        optimized: optimize,
        total_distance_km: Number(totalKm.toFixed(1)),
        total_drive_minutes: Math.round(totalDrive),
        work_minutes: workMinutes,
        return_km: Number(backKm.toFixed(1)),
        stops: resultStops,
        missing_geocode: missing,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("delivery-route-calc error", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
