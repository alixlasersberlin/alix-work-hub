// Public ICS endpoint – serves .ics files for single events or subscription feeds.
// Compatible with Apple/iOS, Google Calendar, Outlook, Microsoft 365, Exchange,
// Thunderbird, Samsung Kalender and CalDAV clients (via HTTP subscription).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function toIcsDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function esc(s?: string | null): string {
  return (s ?? "").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
}
function fold(line: string): string {
  // RFC 5545 line folding at 75 octets
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let s = line;
  parts.push(s.slice(0, 75));
  s = s.slice(75);
  while (s.length) { parts.push(" " + s.slice(0, 74)); s = s.slice(74); }
  return parts.join("\r\n");
}

function eventBlock(e: any): string[] {
  const uid = e.ics_uid || `${e.id}@alixworks.de`;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(e.start_at)}`,
    `DTEND:${toIcsDate(e.end_at)}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description || e.external_note || "")}`,
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.address && !e.location ? `LOCATION:${esc(e.address)}` : "",
    e.customer_email
      ? `ATTENDEE;CN=${esc(e.customer_name || e.customer_email)};RSVP=TRUE:mailto:${e.customer_email}`
      : "",
    `STATUS:${(e.status || "CONFIRMED").toUpperCase() === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    `LAST-MODIFIED:${toIcsDate(e.updated_at || e.created_at || new Date().toISOString())}`,
    "END:VEVENT",
  ].filter(Boolean);
  return lines.map(fold);
}

function calendarWrap(events: any[], name: string): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AlixWorks//Enterprise Scheduling Center//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
  ];
  const body: string[] = [];
  for (const e of events) body.push(...eventBlock(e));
  const footer = ["END:VCALENDAR"];
  return [...header, ...body, ...footer].join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || url.pathname.split("/").pop()?.replace(/\.ics$/,"") || "";
    if (!token) return new Response("token required", { status: 400, headers: cors });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: t } = await admin.from("esc_ics_tokens").select("*").eq("token", token).maybeSingle();
    if (!t) return new Response("not found", { status: 404, headers: cors });
    if (t.revoked_at) return new Response("revoked", { status: 410, headers: cors });
    if (t.expires_at && new Date(t.expires_at) < new Date())
      return new Response("expired", { status: 410, headers: cors });

    let events: any[] = [];
    let name = "AlixWorks Kalender";
    if (t.action === "feed" && t.user_id) {
      const { data } = await admin.from("esc_events")
        .select("*").is("deleted_at", null).eq("assigned_user_id", t.user_id)
        .gte("end_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("start_at").limit(500);
      events = data || [];
      name = "AlixWorks – Meine Termine";
    } else if (t.event_id) {
      const { data } = await admin.from("esc_events").select("*").eq("id", t.event_id).maybeSingle();
      if (data) { events = [data]; name = data.title || name; }
    }

    // Audit
    admin.from("esc_audit_log").insert({
      entity_type: "esc_ics", entity_id: t.event_id ?? t.user_id ?? null,
      action: "ICS_FETCH", new_data: { token: token.slice(0, 12), count: events.length },
    }).then(() => {});

    const body = calendarWrap(events, name);
    return new Response(body, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="alixworks-${(t.action || "event")}.ics"`,
        "Cache-Control": "no-cache, max-age=60",
      },
    });
  } catch (e: any) {
    return new Response(`error: ${e?.message ?? e}`, { status: 500, headers: cors });
  }
});
