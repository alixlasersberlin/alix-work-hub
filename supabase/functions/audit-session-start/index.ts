// ALIX Audit Center — session start
import { corsHeaders, createAuditServiceClient, jsonResponse, requireAuditUser } from "../_shared/audit-auth.ts";

async function geoLookup(ip: string) {
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuditUser(req);
    if ("response" in auth) return auth.response;
    const { user } = auth;
    const supabase = createAuditServiceClient();


    const body = await req.json().catch(() => ({} as any));
    const {
      device_id, user_agent, browser, browser_version, os, os_version,
      screen_resolution, language, timezone, is_mobile, cookie_id, gps_latitude, gps_longitude,
    } = body ?? {};

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("cf-connecting-ip") ?? "";
    const ipHash = ip ? await sha256(ip + (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")) : null;

    const { data: session, error: sErr } = await supabase.from("audit_sessions").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      device_id: device_id ?? null,
      ip_hash: ipHash,
    }).select("id").single();
    if (sErr) throw sErr;

    if (device_id) {
      await supabase.from("audit_devices").insert({
        user_id: user.id, session_id: session.id, device_id,
        user_agent, browser, browser_version, os, os_version,
        screen_resolution, language, timezone, is_mobile, cookie_id,
      });
    }

    const geo = ip ? await geoLookup(ip) : null;
    const isIPv6 = ip.includes(":");
    await supabase.from("audit_geo").insert({
      session_id: session.id,
      user_id: user.id,
      ipv4: !isIPv6 ? ip : null,
      ipv6: isIPv6 ? ip : null,
      asn: geo?.asn ?? null,
      provider: geo?.org ?? null,
      country: geo?.country_name ?? geo?.country ?? null,
      region: geo?.region ?? null,
      city: geo?.city ?? null,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      vpn_detected: !!geo?.security?.vpn,
      proxy_detected: !!geo?.security?.proxy,
      tor_detected: !!geo?.security?.tor,
      gps_latitude: gps_latitude ?? null,
      gps_longitude: gps_longitude ?? null,
    });

    return new Response(JSON.stringify({ session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return jsonResponse({ error: e?.message ?? String(e) }, 500);
  }
});
