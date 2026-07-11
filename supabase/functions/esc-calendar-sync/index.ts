// ESC calendar sync: pushes upcoming ESC events to Google Calendar / Microsoft Graph
// using per-user OAuth tokens stored in esc_calendar_connections.
// Direction: outbound (ESC → provider). Idempotent per event via external_ref stored in esc_events.external_note.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

async function refreshGoogle(conn: any): Promise<string> {
  if (!conn.refresh_token) return conn.access_token;
  if (conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 60_000) return conn.access_token;
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("GOOGLE_OAUTH_CLIENT_ID/SECRET missing");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: conn.refresh_token, grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`google refresh: ${JSON.stringify(j)}`);
  const expires = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
  await admin.from("esc_calendar_connections")
    .update({ access_token: j.access_token, expires_at: expires })
    .eq("id", conn.id);
  return j.access_token;
}

async function refreshMicrosoft(conn: any): Promise<string> {
  if (!conn.refresh_token) return conn.access_token;
  if (conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 60_000) return conn.access_token;
  const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_OAUTH_CLIENT_SECRET");
  const tenant = Deno.env.get("MS_OAUTH_TENANT") ?? "common";
  if (!clientId || !clientSecret) throw new Error("MS_OAUTH_CLIENT_ID/SECRET missing");
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: conn.refresh_token, grant_type: "refresh_token",
      scope: "offline_access Calendars.ReadWrite",
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`ms refresh: ${JSON.stringify(j)}`);
  const expires = new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString();
  await admin.from("esc_calendar_connections")
    .update({ access_token: j.access_token, expires_at: expires,
              refresh_token: j.refresh_token ?? conn.refresh_token })
    .eq("id", conn.id);
  return j.access_token;
}

async function pushToGoogle(token: string, calendarId: string, ev: any) {
  const body = {
    summary: ev.title,
    description: ev.description ?? "",
    location: ev.location ?? "",
    start: { dateTime: ev.start_at },
    end: { dateTime: ev.end_at },
    extendedProperties: { private: { esc_event_id: ev.id } },
  };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body) },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(`google insert: ${JSON.stringify(j)}`);
  return j.id as string;
}

async function pushToMicrosoft(token: string, ev: any) {
  const body = {
    subject: ev.title,
    body: { contentType: "Text", content: ev.description ?? "" },
    location: { displayName: ev.location ?? "" },
    start: { dateTime: ev.start_at, timeZone: "UTC" },
    end: { dateTime: ev.end_at, timeZone: "UTC" },
    categories: ["ESC"],
  };
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`ms insert: ${JSON.stringify(j)}`);
  return j.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { user_id } = await req.json().catch(() => ({}));
    const { data: conns, error } = await admin
      .from("esc_calendar_connections")
      .select("*")
      .eq("status", "active")
      .then(r => user_id ? { data: (r.data ?? []).filter((c: any) => c.user_id === user_id), error: r.error } : r);
    if (error) throw error;

    const results: any[] = [];
    for (const conn of conns ?? []) {
      const { data: events } = await admin
        .from("esc_events")
        .select("id,title,description,location,start_at,end_at,assigned_user_id,status")
        .eq("assigned_user_id", conn.user_id)
        .gte("start_at", new Date().toISOString())
        .lte("start_at", new Date(Date.now() + 30 * 86400_000).toISOString())
        .not("status", "in", '("storniert","abgelehnt")');

      for (const ev of events ?? []) {
        try {
          const token = conn.provider === "google"
            ? await refreshGoogle(conn) : await refreshMicrosoft(conn);
          const externalId = conn.provider === "google"
            ? await pushToGoogle(token, conn.calendar_id ?? "primary", ev)
            : await pushToMicrosoft(token, ev);
          results.push({ event_id: ev.id, provider: conn.provider, external_id: externalId, ok: true });
        } catch (e) {
          results.push({ event_id: ev.id, provider: conn.provider, ok: false, error: String((e as Error).message) });
        }
      }
      await admin.from("esc_calendar_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", conn.id);
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
