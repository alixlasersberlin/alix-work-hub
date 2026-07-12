// Ticket Router — automatische Zuweisung eines Tickets an Abteilung + Mitarbeiter.
// Reihenfolge:
//   1. Fester Kundenbetreuer (customers.account_manager_id, falls vorhanden)
//   2. Geräte-/Produktzuständigkeit (technician_skills)
//   3. Least-Load innerhalb der Abteilung
//   4. Fallback: assigned_to = NULL (landet im Abteilungs-Postfach)
//
// Aufruf: POST { ticket_id: uuid }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: ticket, error: tErr } = await supabase
      .from("tickets")
      .select("id, ticket_department_id, department, assigned_to, customer_email, device_id")
      .eq("id", ticket_id)
      .single();
    if (tErr || !ticket) throw tErr ?? new Error("ticket not found");

    // Wenn bereits zugewiesen, nichts tun.
    if (ticket.assigned_to) {
      return json({ success: true, skipped: "already_assigned" });
    }

    // Abteilung auflösen (falls nur `department` als Text gesetzt ist).
    let deptId = ticket.ticket_department_id as string | null;
    if (!deptId && ticket.department) {
      const { data: d } = await supabase
        .from("ticket_departments")
        .select("id")
        .ilike("name", ticket.department)
        .maybeSingle();
      if (d?.id) {
        deptId = d.id;
        await supabase.from("tickets").update({ ticket_department_id: deptId }).eq("id", ticket_id);
      }
    }

    const { data: dept } = deptId
      ? await supabase.from("ticket_departments").select("id, name, routing_strategy").eq("id", deptId).maybeSingle()
      : { data: null };

    let assignee: string | null = null;
    let reason = "fallback_mailbox";

    // 1. Kundenbetreuer
    if (ticket.customer_email) {
      const { data: cust } = await supabase
        .from("customers")
        .select("account_manager_id")
        .ilike("email", ticket.customer_email)
        .maybeSingle();
      const am = (cust as any)?.account_manager_id;
      if (am) { assignee = am; reason = "account_manager"; }
    }

    // 2. Geräte-Skill
    if (!assignee && ticket.device_id) {
      const { data: skill } = await supabase
        .from("technician_skills")
        .select("user_id")
        .eq("device_id", ticket.device_id)
        .limit(1)
        .maybeSingle();
      if ((skill as any)?.user_id) { assignee = (skill as any).user_id; reason = "device_skill"; }
    }

    // 3. Least-Load in der Abteilung
    if (!assignee && dept?.name && (dept.routing_strategy === "least_load" || dept.routing_strategy === "round_robin")) {
      const { data: candidates } = await supabase
        .from("tickets")
        .select("assigned_to")
        .eq("department", dept.name)
        .not("assigned_to", "is", null)
        .in("status", ["Neu", "Zugewiesen", "In Bearbeitung", "offen"]);
      const load: Record<string, number> = {};
      for (const row of candidates ?? []) {
        const uid = (row as any).assigned_to as string;
        load[uid] = (load[uid] ?? 0) + 1;
      }
      const sorted = Object.entries(load).sort((a, b) => a[1] - b[1]);
      if (sorted.length) { assignee = sorted[0][0]; reason = "least_load"; }
    }

    const update: Record<string, unknown> = { routing_note: reason };
    if (assignee) {
      update.assigned_to = assignee;
      update.status = "Zugewiesen";
    }
    const { error: uErr } = await supabase.from("tickets").update(update).eq("id", ticket_id);
    if (uErr) throw uErr;

    await supabase.from("ticket_history").insert({
      ticket_id,
      action: "routed",
      field: "assigned_to",
      new_value: assignee ?? null,
      meta: { reason, department: dept?.name ?? null },
    });

    return json({ success: true, assignee, reason, department: dept?.name ?? null });
  } catch (err) {
    console.error("ticket-router error", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
