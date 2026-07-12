// Ticket-Eskalations-Engine (Stufe 2)
// Läuft als Cron (z.B. alle 15 Min) und:
//  1. Eskaliert überfällige Tickets (due_at < now, nicht geschlossen)
//     → Priorität hochstufen, Status="Eskaliert", history log.
//  2. Setzt Wiedervorlagen fällig (follow_up_at < now, status offen)
//     → status="Wiedervorlage fällig"
//  3. Markiert Termin-Bestätigungen als überfällig, wenn Kunde nicht reagiert
//     (esc_events.requires_confirmation, confirmation_status='pending',
//      start_at < now + 24h und confirmation_token_expires_at < now)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRIO_ORDER = ["Niedrig", "Normal", "Hoch", "Dringend", "Kritisch"];
const CLOSED = ["Geschlossen", "Erledigt", "Abgelehnt", "Storniert"];

function bumpPriority(p: string | null | undefined): string {
  const idx = PRIO_ORDER.indexOf(p ?? "Normal");
  if (idx < 0) return "Hoch";
  return PRIO_ORDER[Math.min(idx + 1, PRIO_ORDER.length - 1)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();
  const stats = { escalated: 0, followups: 0, appointments_overdue: 0, errors: [] as string[] };

  // 1) Überfällige Tickets eskalieren
  try {
    const { data: overdue, error } = await supabase
      .from("tickets")
      .select("id, ticket_number, priority, status, due_at, escalation_count")
      .lt("due_at", nowIso)
      .not("status", "in", `(${CLOSED.map((s) => `"${s}"`).join(",")})`)
      .neq("status", "Eskaliert")
      .limit(200);
    if (error) throw error;

    for (const t of overdue ?? []) {
      const newPrio = bumpPriority(t.priority);
      const patch: Record<string, unknown> = {
        priority: newPrio,
        status: "Eskaliert",
        escalation_count: ((t as any).escalation_count ?? 0) + 1,
        escalated_at: nowIso,
      };
      const { error: uErr } = await supabase.from("tickets").update(patch).eq("id", t.id);
      if (uErr) { stats.errors.push(`ticket ${t.id}: ${uErr.message}`); continue; }
      await supabase.from("ticket_history").insert({
        ticket_id: t.id,
        action: "auto_escalated",
        field: "priority",
        old_value: t.priority ?? null,
        new_value: newPrio,
        meta: { reason: "due_at_passed", due_at: t.due_at },
      });
      stats.escalated++;
    }
  } catch (e) {
    stats.errors.push("escalation: " + String((e as Error).message));
  }

  // 2) Wiedervorlagen fällig
  try {
    const { data: due, error } = await supabase
      .from("tickets")
      .select("id, status, follow_up_at")
      .lt("follow_up_at", nowIso)
      .not("status", "in", `(${CLOSED.map((s) => `"${s}"`).join(",")})`)
      .neq("status", "Wiedervorlage fällig")
      .limit(200);
    if (error) throw error;

    for (const t of due ?? []) {
      const { error: uErr } = await supabase.from("tickets")
        .update({ status: "Wiedervorlage fällig" }).eq("id", t.id);
      if (uErr) { stats.errors.push(`followup ${t.id}: ${uErr.message}`); continue; }
      await supabase.from("ticket_history").insert({
        ticket_id: t.id,
        action: "followup_due",
        field: "status",
        old_value: t.status ?? null,
        new_value: "Wiedervorlage fällig",
        meta: { follow_up_at: t.follow_up_at },
      });
      stats.followups++;
    }
  } catch (e) {
    stats.errors.push("followup: " + String((e as Error).message));
  }

  // 3) Termin-Bestätigungen abgelaufen
  try {
    const { data: expired, error } = await supabase
      .from("esc_events")
      .select("id, ticket_id, confirmation_token_expires_at")
      .eq("requires_confirmation", true)
      .eq("confirmation_status", "pending")
      .lt("confirmation_token_expires_at", nowIso)
      .limit(200);
    if (error) throw error;

    for (const ev of expired ?? []) {
      await supabase.from("esc_events").update({
        confirmation_status: "expired",
        appointment_status: "bestaetigung_abgelaufen",
      }).eq("id", ev.id);
      if ((ev as any).ticket_id) {
        await supabase.from("ticket_history").insert({
          ticket_id: (ev as any).ticket_id,
          action: "appointment_confirmation_expired",
          field: "event_id",
          new_value: ev.id,
          meta: { expired_at: (ev as any).confirmation_token_expires_at },
        });
      }
      stats.appointments_overdue++;
    }
  } catch (e) {
    stats.errors.push("appt-expiry: " + String((e as Error).message));
  }

  return new Response(JSON.stringify({ ok: true, ran_at: nowIso, ...stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
