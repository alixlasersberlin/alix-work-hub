import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Stage = "warehouse" | "accounting" | "dispatch";

const STAGE_TITLE: Record<Stage, string> = {
  warehouse: "Bereitstellung",
  accounting: "Buchhaltung",
  dispatch: "Tourenplanung",
};

// Level 1 (24h): zuständige Abteilung, Level 2 (48h): Leitung, Level 3 (72h): Operations
const STAGE_ROLES: Record<Stage, string[]> = {
  warehouse: ["Bereitstellung", "Order"],
  accounting: ["Buchhaltung Admin", "Buchhaltung EU", "Buchhaltung CH", "Finance"],
  dispatch: ["Tourenplanung"],
};
const LEAD_ROLES: Record<Stage, string[]> = {
  warehouse: ["Order", "Admin"],
  accounting: ["Buchhaltung Admin", "Admin"],
  dispatch: ["Admin"],
};
const OPS_ROLES = ["Admin", "Super Admin"];

const FROM = "Alix Lasers ® <service@alixwork.de>";

/** Erinnerungs-E-Mail an die säumigen Freigeber. */
async function sendReminderMails(
  supabase: any,
  userIds: string[],
  params: { level: number; stageTitle: string; orderNumber: string; hours: number; orderId: string },
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !userIds.length) return 0;
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("email, full_name")
    .in("id", userIds)
    .eq("is_active", true);
  const to = [...new Set(((profiles ?? []) as any[]).map((p) => p.email).filter((e: string | null) => !!e && /@/.test(e)))];
  if (!to.length) return 0;

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
      <p>Guten Tag,</p>
      <p>die Freigabe <strong>${params.stageTitle}</strong> für <strong>Auftrag ${params.orderNumber}</strong>
      ist seit <strong>${Math.floor(params.hours)} Stunden</strong> offen (Eskalationsstufe ${params.level}).</p>
      <p>Bitte prüfen und erteilen Sie die Freigabe zeitnah, damit die Auslieferung nicht verzögert wird.</p>
      <p>Mit freundlichen Grüßen<br/>Alix Lasers ®</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: `Erinnerung Freigabe ${params.stageTitle} – Auftrag ${params.orderNumber} (Stufe ${params.level})`,
      html,
    }),
  });
  if (!res.ok) console.error("reminder mail failed", await res.text().catch(() => ""));
  return to.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: approvals, error } = await supabase
      .from("delivery_approvals")
      .select("id, order_id, warehouse_status, accounting_status, dispatch_status, overall_status, created_at, updated_at")
      .neq("overall_status", "released")
      .neq("overall_status", "delivered")
      .neq("overall_status", "completed")
      .limit(1000);
    if (error) throw error;

    const now = Date.now();
    let sent = 0;
    let mails = 0;

    for (const a of approvals ?? []) {
      // Aktive Stufe = erste nicht genehmigte Stufe (sequentiell)
      const order: Stage[] = ["warehouse", "accounting", "dispatch"];
      const stage = order.find((s) => (a as any)[`${s}_status`] !== "approved");
      if (!stage) continue;

      // Wartezeit ab Erstellung bzw. Freigabe der Vorstufe
      const idx = order.indexOf(stage);
      let since = new Date(a.created_at).getTime();
      if (idx > 0) {
        const { data: prev } = await supabase
          .from("delivery_approvals")
          .select(`${order[idx - 1]}_at`)
          .eq("id", a.id)
          .maybeSingle();
        const prevAt = prev ? (prev as any)[`${order[idx - 1]}_at`] : null;
        if (prevAt) since = new Date(prevAt).getTime();
      }
      const hours = (now - since) / 3_600_000;

      let level = 0;
      if (hours >= 72) level = 3;
      else if (hours >= 48) level = 2;
      else if (hours >= 24) level = 1;
      if (!level) continue;

      // Doppelte Eskalation pro Stufe/Level vermeiden
      const marker = `escalation:${stage}:L${level}`;
      const { data: existing } = await supabase
        .from("delivery_approval_events")
        .select("id")
        .eq("approval_id", a.id)
        .eq("comment", marker)
        .limit(1);
      if (existing && existing.length) continue;

      const roles = level === 1 ? STAGE_ROLES[stage] : level === 2 ? LEAD_ROLES[stage] : OPS_ROLES;
      const { data: ur } = await supabase.from("user_roles").select("user_id").in("role", roles);
      const ids = [...new Set((ur ?? []).map((r: any) => r.user_id))].filter(Boolean);

      const { data: ord } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", a.order_id)
        .maybeSingle();
      const num = (ord as any)?.order_number ?? a.order_id.slice(0, 8);

      if (ids.length) {
        await supabase.from("app_notifications").insert(
          ids.map((id: string) => ({
            user_id: id,
            category: "operations",
            title: `Eskalation Stufe ${level}: ${STAGE_TITLE[stage]}`,
            message: `Auftrag ${num} wartet seit ${Math.floor(hours)} Stunden auf die Freigabe ${STAGE_TITLE[stage]}.`,
            priority: level >= 2 ? "urgent" : "high",
            action_url: `/auftraege/${a.order_id}?tab=freigaben`,
          })),
        );
        sent += ids.length;
        try {
          mails += await sendReminderMails(supabase, ids as string[], {
            level, stageTitle: STAGE_TITLE[stage], orderNumber: String(num), hours, orderId: a.order_id,
          });
        } catch (e) { console.error("reminder mail", e); }
      }

      await supabase.from("delivery_approval_events").insert({
        approval_id: a.id,
        order_id: a.order_id,
        stage,
        old_status: (a as any)[`${stage}_status`],
        new_status: (a as any)[`${stage}_status`],
        user_name: "System (Eskalation)",
        comment: marker,
      });
    }

    return new Response(JSON.stringify({ ok: true, checked: approvals?.length ?? 0, notifications: sent, mails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delivery-approval-escalation", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
