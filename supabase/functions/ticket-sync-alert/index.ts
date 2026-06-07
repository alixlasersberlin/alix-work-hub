// Ticket Sync Alert Watcher
// Detects sync failures across ticket_sync_logs (inbound) and ticket_outbound_sync_logs (outbound)
// and sends an email to the configured admin recipient, with per-ticket cooldown (30 minutes).
//
// Triggered manually, on demand from the UI, or by a scheduled cron job.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ALERT_RECIPIENT = "rde@alix-lasers.com";
const COOLDOWN_MINUTES = 30;
const FROM_ADDRESS = "Alix Sync Alert <alerts@alixwork.de>";

type AlertGroup =
  | "sync_failed_streak"
  | "webhook_failed_streak"
  | "webhook_unmapped_repeat"
  | "http_error"
  | "retry_exhausted";

interface LogRow {
  id: string;
  ticket_id?: string | null;
  external_ticket_id: string | null;
  direction: string | null;
  action: string | null;
  status: string | null;
  error_message: string | null;
  response_code: number | null;
  attempt: number | null;
  payload?: unknown;
  created_at: string;
}

interface AlertCandidate {
  group: AlertGroup;
  alert_type: string;
  reason: string;
  log: LogRow;
  source: "inbound" | "outbound";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Look back 1 hour by default; allow override via body
    let lookbackMinutes = 60;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (typeof body?.lookback_minutes === "number") lookbackMinutes = body.lookback_minutes;
      }
    } catch { /* noop */ }

    const sinceIso = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();

    const [inbound, outbound] = await Promise.all([
      supabase.from("ticket_sync_logs").select("*")
        .gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(500),
      supabase.from("ticket_outbound_sync_logs").select("*")
        .gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(500),
    ]);

    const inboundRows: LogRow[] = (inbound.data as any[] || []).map((r) => ({ ...r, direction: r.direction || "inbound" }));
    const outboundRows: LogRow[] = (outbound.data as any[] || []).map((r) => ({ ...r, direction: r.direction || "outbound" }));

    const candidates: AlertCandidate[] = [];

    // 1) Streak: 3 consecutive failures per ticket (outbound = sync_failed, inbound = webhook_failed)
    candidates.push(...detectFailureStreak(outboundRows, "outbound", "sync_failed_streak", "sync_failed (3x in Folge)"));
    candidates.push(...detectFailureStreak(inboundRows, "inbound", "webhook_failed_streak", "webhook_failed (3x in Folge)"));

    // 2) Repeated webhook_unmapped (>= 3 within window)
    candidates.push(...detectUnmappedRepeat(inboundRows));

    // 3) HTTP error (response_code >= 400) - any single occurrence
    for (const row of [...outboundRows, ...inboundRows]) {
      if ((row.response_code ?? 0) >= 400) {
        candidates.push({
          group: "http_error",
          alert_type: `http_${row.response_code}`,
          reason: `HTTP ${row.response_code}`,
          log: row,
          source: (row.direction === "inbound" ? "inbound" : "outbound"),
        });
      }
    }

    // 4) Retry endgültig fehlgeschlagen - outbound status=error with attempt>=2
    for (const row of outboundRows) {
      if (row.status === "error" && (row.attempt ?? 0) >= 2) {
        candidates.push({
          group: "retry_exhausted",
          alert_type: "retry_exhausted",
          reason: `Retry endgültig fehlgeschlagen (attempt=${row.attempt})`,
          log: row,
          source: "outbound",
        });
      }
    }

    // Deduplicate by ticket key (ticket_id || external_ticket_id) + group
    const seen = new Set<string>();
    const deduped: AlertCandidate[] = [];
    for (const c of candidates) {
      const key = `${c.group}:${c.log.ticket_id || c.log.external_ticket_id || c.log.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(c);
    }

    // Apply cooldown: skip if an alert for the same ticket was sent in last COOLDOWN_MINUTES
    const cooldownIso = new Date(Date.now() - COOLDOWN_MINUTES * 60_000).toISOString();
    const sent: any[] = [];
    const skipped: any[] = [];

    for (const c of deduped) {
      const ticketKey = c.log.ticket_id || c.log.external_ticket_id;
      if (!ticketKey) { skipped.push({ reason: "no ticket key", group: c.group }); continue; }

      const cooldownQ = supabase
        .from("ticket_sync_alerts")
        .select("id, sent_at", { count: "exact", head: true })
        .gte("sent_at", cooldownIso);

      if (c.log.ticket_id) cooldownQ.eq("ticket_id", c.log.ticket_id);
      else cooldownQ.eq("external_ticket_id", c.log.external_ticket_id as string);

      const { count } = await cooldownQ;
      if ((count ?? 0) > 0) {
        skipped.push({ reason: "cooldown", group: c.group, ticket_key: ticketKey });
        continue;
      }

      // Resolve ticket_number
      let ticketNumber: string | null = null;
      if (c.log.ticket_id) {
        const { data: t } = await supabase.from("tickets").select("ticket_number").eq("id", c.log.ticket_id).maybeSingle();
        ticketNumber = (t as any)?.ticket_number ?? null;
      }

      const payloadExcerpt = truncatePayload(c.log.payload);
      const subject = "Alix Sync Fehler erkannt";
      const html = renderEmail({
        timestamp: c.log.created_at,
        system: c.source === "inbound" ? "AlixSmart → AlixWork" : "AlixWork → AlixSmart",
        direction: c.log.direction || c.source,
        ticket_number: ticketNumber,
        external_ticket_id: c.log.external_ticket_id,
        event: `${c.alert_type} (${c.reason})`,
        response_code: c.log.response_code,
        error_message: c.log.error_message,
        payload_excerpt: payloadExcerpt,
      });

      let sendStatus = "sent";
      let providerResponse: any = null;
      try {
        if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: [ALERT_RECIPIENT],
            subject,
            html,
          }),
        });
        providerResponse = await r.json().catch(() => null);
        if (!r.ok) sendStatus = "failed";
      } catch (e) {
        sendStatus = "failed";
        providerResponse = { error: (e as Error).message };
      }

      const { data: insertData } = await supabase.from("ticket_sync_alerts").insert({
        alert_type: c.alert_type,
        error_group: c.group,
        ticket_id: c.log.ticket_id ?? null,
        external_ticket_id: c.log.external_ticket_id ?? null,
        ticket_number: ticketNumber,
        direction: c.log.direction,
        action: c.log.action,
        response_code: c.log.response_code,
        error_message: c.log.error_message,
        payload_excerpt: payloadExcerpt,
        sent_to: ALERT_RECIPIENT,
        status: sendStatus,
        provider_response: providerResponse,
      }).select("id").maybeSingle();

      sent.push({ group: c.group, alert_type: c.alert_type, ticket_key: ticketKey, status: sendStatus, id: (insertData as any)?.id });
    }

    return json({
      ok: true,
      lookback_minutes: lookbackMinutes,
      cooldown_minutes: COOLDOWN_MINUTES,
      candidates: deduped.length,
      sent_count: sent.length,
      skipped_count: skipped.length,
      sent,
      skipped,
    });
  } catch (e) {
    console.error("ticket-sync-alert fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function detectFailureStreak(rows: LogRow[], source: "inbound" | "outbound", group: AlertGroup, label: string): AlertCandidate[] {
  // rows are descending by created_at, group by ticket key
  const byTicket = new Map<string, LogRow[]>();
  for (const r of rows) {
    const key = r.ticket_id || r.external_ticket_id;
    if (!key) continue;
    if (!byTicket.has(key)) byTicket.set(key, []);
    byTicket.get(key)!.push(r);
  }
  const out: AlertCandidate[] = [];
  for (const [, list] of byTicket) {
    // Newest first; consider a streak if the latest 3 are all error
    const top3 = list.slice(0, 3);
    if (top3.length >= 3 && top3.every((r) => r.status === "error")) {
      out.push({
        group,
        alert_type: source === "outbound" ? "sync_failed" : "webhook_failed",
        reason: label,
        log: top3[0],
        source,
      });
    }
  }
  return out;
}

function detectUnmappedRepeat(rows: LogRow[]): AlertCandidate[] {
  const byTicket = new Map<string, LogRow[]>();
  for (const r of rows) {
    if ((r.action || "").toLowerCase().includes("unmapped") || (r.status || "").toLowerCase() === "unmapped") {
      const key = r.ticket_id || r.external_ticket_id;
      if (!key) continue;
      if (!byTicket.has(key)) byTicket.set(key, []);
      byTicket.get(key)!.push(r);
    }
  }
  const out: AlertCandidate[] = [];
  for (const [, list] of byTicket) {
    if (list.length >= 3) {
      out.push({
        group: "webhook_unmapped_repeat",
        alert_type: "webhook_unmapped",
        reason: `webhook_unmapped (${list.length}x)`,
        log: list[0],
        source: "inbound",
      });
    }
  }
  return out;
}

function truncatePayload(payload: unknown) {
  if (!payload) return null;
  try {
    const s = typeof payload === "string" ? payload : JSON.stringify(payload);
    return { excerpt: s.slice(0, 1000) };
  } catch {
    return null;
  }
}

function renderEmail(d: {
  timestamp: string; system: string; direction: string;
  ticket_number: string | null; external_ticket_id: string | null;
  event: string; response_code: number | null; error_message: string | null;
  payload_excerpt: any;
}) {
  const row = (k: string, v: any) => `<tr><td style="padding:6px 12px;color:#666;border-bottom:1px solid #eee;">${k}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;font-family:monospace;">${escapeHtml(String(v ?? "—"))}</td></tr>`;
  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;">
    <h2 style="color:#b91c1c;">⚠️ Alix Sync Fehler erkannt</h2>
    <p>Bei der Synchronisation zwischen AlixWork und AlixSmart ist ein Fehler aufgetreten.</p>
    <table style="border-collapse:collapse;width:100%;background:#fafafa;border:1px solid #eee;">
      ${row("Zeitpunkt", new Date(d.timestamp).toLocaleString("de-DE"))}
      ${row("System", d.system)}
      ${row("Richtung", d.direction)}
      ${row("Ticket-Nr.", d.ticket_number)}
      ${row("external_ticket_id", d.external_ticket_id)}
      ${row("Event", d.event)}
      ${row("response_code", d.response_code)}
      ${row("error_message", d.error_message)}
    </table>
    <h4 style="margin-top:18px;">Payload-Auszug</h4>
    <pre style="background:#0f172a;color:#e2e8f0;padding:12px;border-radius:6px;overflow:auto;font-size:12px;">${escapeHtml(JSON.stringify(d.payload_excerpt ?? {}, null, 2))}</pre>
    <p style="color:#888;font-size:12px;margin-top:24px;">Automatischer Alert von AlixWork · Monitoring unter /tickets/sync</p>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
