// Erstellt aus einem Ticket heraus einen Kalendertermin (esc_events) mit
// Bestätigungs-Token und liefert die alixwork.de-Aktionslinks zurück.
// Aufruf: POST { ticket_id, start_at, end_at?, event_kind, title?, requires_confirmation? }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PUBLIC_BASE = "https://alixwork.de";

function normalizePriority(value: unknown): "low" | "normal" | "high" | "urgent" {
  const raw = String(value ?? "normal").trim().toLowerCase();
  const map: Record<string, "low" | "normal" | "high" | "urgent"> = {
    low: "low",
    niedrig: "low",
    normal: "normal",
    mittel: "normal",
    medium: "normal",
    high: "high",
    hoch: "high",
    urgent: "urgent",
    kritisch: "urgent",
    critical: "urgent",
    dringend: "urgent",
  };
  return map[raw] ?? "normal";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const callerAuth = req.headers.get("Authorization") ?? "";
    const body = await req.json();
    const {
      ticket_id, start_at, end_at, event_kind = "kundentermin",
      title, description, requires_confirmation = true,
      department_id: departmentIdOverride,
      assigned_user_id: assignedOverride,
      resource_id: resourceOverride,
      customer_name: customerNameOverride,
      customer_email: customerEmailOverride,
      customer_phone: customerPhoneOverride,
      address: addressOverride,
      location: locationOverride,
      internal_note: internalNoteOverride,
      external_note: externalNoteOverride,
      priority: priorityOverride,
    } = body ?? {};

    if (!ticket_id || !start_at) return j({ error: "ticket_id & start_at required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, title, department, customer_name, customer_email, customer_phone, customer_address, assigned_to, priority")
      .eq("id", ticket_id)
      .single();
    if (tErr || !ticket) return j({ error: "ticket not found" }, 404);

    // esc_department: Override > Name-Match > Fallback
    let escDeptId: string | null = departmentIdOverride ?? null;
    if (!escDeptId && ticket.department) {
      const { data: d } = await supabase
        .from("esc_departments").select("id").ilike("name", ticket.department).maybeSingle();
      escDeptId = (d as any)?.id ?? null;
    }
    if (!escDeptId) {
      const { data: fallback } = await supabase.from("esc_departments").select("id").limit(1).maybeSingle();
      escDeptId = (fallback as any)?.id ?? null;
    }
    if (!escDeptId) return j({ error: "Keine ESC-Abteilung vorhanden — bitte in ESC → Abteilungen anlegen." }, 400);

    const start = new Date(start_at);
    const end = end_at ? new Date(end_at) : new Date(start.getTime() + 30 * 60 * 1000);
    const priority = normalizePriority(priorityOverride ?? ticket.priority);

    const token = crypto.randomUUID().replace(/-/g, "");
    const tokenExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: ev, error: evErr } = await supabase.from("esc_events").insert({
      ticket_id,
      event_kind,
      title: title ?? `${ticket.ticket_number ?? "Ticket"} · ${ticket.title ?? ticket.customer_name ?? ""}`,
      description: description ?? `Erstellt aus Ticket ${ticket.ticket_number ?? ticket_id}`,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      department_id: escDeptId,
      status: "planned",
      priority,
      customer_name: customerNameOverride ?? ticket.customer_name,
      customer_email: customerEmailOverride ?? ticket.customer_email,
      customer_phone: customerPhoneOverride ?? ticket.customer_phone,
      address: addressOverride ?? (ticket as any).customer_address ?? null,
      location: locationOverride ?? null,
      internal_note: internalNoteOverride ?? null,
      external_note: externalNoteOverride ?? null,
      resource_id: resourceOverride ?? null,
      assigned_user_id: assignedOverride ?? ticket.assigned_to,
      requires_confirmation,
      confirmation_status: requires_confirmation ? "pending" : "not_required",
      confirmation_token: token,
      confirmation_token_expires_at: tokenExpires,
      appointment_status: requires_confirmation ? "bestaetigung_ausstehend" : "geplant",
      source: "ticket",
    }).select("id").single();
    if (evErr) throw evErr;


    // Ticket-Felder synchronisieren
    const ticketPatch: Record<string, unknown> = {};
    if (event_kind === "frist" || event_kind === "rueckruf" || event_kind === "eskalation") {
      ticketPatch.due_at = start.toISOString();
    } else if (event_kind === "wiedervorlage") {
      ticketPatch.follow_up_at = start.toISOString();
    } else {
      ticketPatch.appointment_at = start.toISOString();
      ticketPatch.status = "Termin vereinbart";
    }
    if (Object.keys(ticketPatch).length) {
      await supabase.from("tickets").update(ticketPatch).eq("id", ticket_id);
    }

    await supabase.from("ticket_history").insert({
      ticket_id,
      action: "appointment_created",
      field: "event_id",
      new_value: (ev as any).id,
      meta: { event_kind, start_at: start.toISOString() },
    });

    const links = {
      confirm: `${PUBLIC_BASE}/termin/bestaetigen/${token}`,
      reschedule: `${PUBLIC_BASE}/termin/verschieben/${token}`,
      cancel: `${PUBLIC_BASE}/termin/ablehnen/${token}`,
    };

    // E-Mail an Kunde senden (nur wenn Bestätigung nötig und E-Mail vorhanden)
    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    let emailError: string | null = null;
    if (requires_confirmation && ticket.customer_email) {
      try {
        const dateStr = start.toLocaleString("de-DE", {
          timeZone: "Europe/Berlin", dateStyle: "full", timeStyle: "short",
        });
        const subject = `Terminvorschlag zu ${ticket.ticket_number ?? "Ihrem Ticket"} – bitte bestätigen`;
        const html = `
          <div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#111;line-height:1.55;max-width:560px">
            <p>Guten Tag${ticket.customer_name ? " " + ticket.customer_name : ""},</p>
            <p>zu Ihrer Anfrage <strong>${ticket.ticket_number ?? ""}</strong>
               ${ticket.title ? "„" + ticket.title + "\"" : ""} schlagen wir folgenden Termin vor:</p>
            <p style="font-size:16px;font-weight:600;margin:16px 0">${dateStr}</p>
            <p>Bitte wählen Sie eine Option:</p>
            <p style="margin:20px 0">
              <a href="${links.confirm}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-right:6px">Termin bestätigen</a>
              <a href="${links.reschedule}" style="background:#f59e0b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-right:6px">Verschieben</a>
              <a href="${links.cancel}" style="background:#dc2626;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Ablehnen</a>
            </p>
            <p style="color:#6b7280;font-size:12px;margin-top:24px">
              Die Links sind 30 Tage gültig. Bei Fragen antworten Sie einfach auf diese E-Mail.
            </p>
          </div>`;
        const fromEmail = event_kind === "kundentermin" || event_kind === "beratung"
          ? "service@alixwork.de" : "service@alixwork.de";
        const resp = await supabase.functions.invoke("send-mail", {
          body: { to: ticket.customer_email, subject, html, from: fromEmail },
        });
        if (resp.error) throw resp.error;
        emailStatus = "sent";
        await supabase.from("ticket_history").insert({
          ticket_id, action: "appointment_email_sent", field: "customer_email",
          new_value: ticket.customer_email, meta: { event_id: (ev as any).id, links },
        });
      } catch (mailErr) {
        emailStatus = "failed";
        emailError = String((mailErr as Error)?.message ?? mailErr);
        console.error("appointment email failed", emailError);
      }
    }

    return j({ success: true, event_id: (ev as any).id, token, links, email: { status: emailStatus, error: emailError } });
  } catch (err) {
    console.error("ticket-create-appointment error", err);
    return j({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
