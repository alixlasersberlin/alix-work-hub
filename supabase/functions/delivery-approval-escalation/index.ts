import "../_shared/global-bcc.ts";
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

const STAGE_ROLES: Record<Stage, string[]> = {
  warehouse: ["Freigeber Bereitstellung", "Bereitstellung", "Order"],
  accounting: ["Freigeber Buchhaltung", "Buchhaltung Admin", "Buchhaltung EU", "Buchhaltung CH", "Finance"],
  dispatch: ["Freigeber Tourenplanung", "Tourenplanung"],
};
const LEAD_ROLES: Record<Stage, string[]> = {
  warehouse: ["Order", "Admin"],
  accounting: ["Buchhaltung Admin", "Admin"],
  dispatch: ["Admin"],
};
const OPS_ROLES = ["Admin", "Super Admin"];

const FROM = "Alix Lasers ® <service@alixwork.de>";

interface Settings {
  overdueHours: number;
  l1: number; l2: number; l3: number;
  businessDaysOnly: boolean;
  holidays: string[];
  oneClickApproval: boolean;
  absences?: { email: string; deputyEmail: string; from: string; to: string }[];
}

const DEFAULTS: Settings = {
  overdueHours: 12, l1: 24, l2: 48, l3: 72,
  businessDaysOnly: true, holidays: [], oneClickApproval: true, absences: [],
};

/** Vertretungsregelung: abwesende Empfänger durch ihren Vertreter ersetzen. */
async function applyDeputies(supabase: any, settings: Settings, recipients: any[]): Promise<any[]> {
  const list = (settings.absences ?? []).filter((a) => a?.email && a?.deputyEmail);
  if (!list.length) return recipients;
  const today = new Date().toISOString().slice(0, 10);
  const active = new Map<string, string>();
  for (const a of list) {
    const from = a.from || "0000-01-01";
    const to = a.to || "9999-12-31";
    if (today >= from && today <= to) active.set(a.email.toLowerCase().trim(), a.deputyEmail.toLowerCase().trim());
  }
  if (!active.size) return recipients;

  const needed = recipients
    .filter((r) => active.has(String(r.email ?? "").toLowerCase()))
    .map((r) => active.get(String(r.email).toLowerCase()) as string);
  if (!needed.length) return recipients;

  const { data: deputies } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .in("email", [...new Set(needed)]);
  const byMail = new Map(((deputies ?? []) as any[]).map((d) => [String(d.email).toLowerCase(), d]));

  const out: any[] = [];
  const seen = new Set<string>();
  for (const r of recipients) {
    const mail = String(r.email ?? "").toLowerCase();
    const target = active.has(mail) ? (byMail.get(active.get(mail) as string) ?? null) : r;
    if (!target?.email) continue;
    const key = String(target.email).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

async function loadSettings(supabase: any): Promise<Settings> {
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "delivery_approval_sla").maybeSingle();
    let raw: any = data?.value ?? null;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
    return { ...DEFAULTS, ...(raw ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Verstrichene Stunden – optional nur Werktage (Mo–Fr, ohne Feiertage). */
function elapsedHours(since: number, now: number, s: Settings): number {
  const total = (now - since) / 3_600_000;
  if (!s.businessDaysOnly || total <= 0) return Math.max(0, total);
  const holidays = new Set(s.holidays ?? []);
  let hours = 0;
  let cursor = since;
  while (cursor < now) {
    const d = new Date(cursor);
    const dayEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    const sliceEnd = Math.min(dayEnd, now);
    const dow = d.getUTCDay();
    const working = dow !== 0 && dow !== 6 && !holidays.has(isoDay(d));
    if (working) hours += (sliceEnd - cursor) / 3_600_000;
    cursor = sliceEnd;
  }
  return hours;
}

async function createToken(
  supabase: any,
  p: { approvalId: string; orderId: string; stage: Stage; userId: string | null; userName: string | null },
): Promise<string | null> {
  try {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("delivery_approval_tokens").insert({
      approval_id: p.approvalId,
      order_id: p.orderId,
      stage: p.stage,
      user_id: p.userId,
      user_name: p.userName,
      token,
    });
    if (error) { console.error("token insert", error.message); return null; }
    return token;
  } catch (e) {
    console.error("token", e);
    return null;
  }
}

/** Erinnerungs-E-Mail (personalisiert, optional mit Ein-Klick-Freigabe-Link). */
async function sendReminderMails(
  supabase: any,
  userIds: string[],
  params: {
    level: number; stage: Stage; orderNumber: string; hours: number;
    orderId: string; approvalId: string; reminderOnly?: boolean; settings: Settings; allowOneClick: boolean;
  },
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key || !userIds.length) return 0;
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .in("id", userIds)
    .eq("is_active", true);

  let recipients = ((profiles ?? []) as any[]).filter((p) => p.email && /@/.test(p.email));
  recipients = await applyDeputies(supabase, params.settings, recipients);
  if (!recipients.length) return 0;

  const stageTitle = STAGE_TITLE[params.stage];
  const base = Deno.env.get("SUPABASE_URL");
  let count = 0;

  for (const p of recipients) {
    let linkBlock = "";
    if (params.allowOneClick && params.settings.oneClickApproval && base) {
      const token = await createToken(supabase, {
        approvalId: params.approvalId, orderId: params.orderId, stage: params.stage,
        userId: p.id, userName: p.full_name ?? p.email,
      });
      if (token) {
        const url = `${base}/functions/v1/delivery-approval-approve?token=${token}`;
        linkBlock = `<p style="margin:24px 0">
          <a href="${url}" style="background:#d4af37;color:#111;padding:12px 22px;border-radius:8px;
          text-decoration:none;font-weight:bold;display:inline-block">Jetzt freigeben (1 Klick)</a></p>
          <p style="font-size:12px;color:#666">Der Link ist persönlich und 14 Tage gültig.</p>`;
      }
    }

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Guten Tag${p.full_name ? ` ${p.full_name}` : ""},</p>
        <p>die Freigabe <strong>${stageTitle}</strong> für <strong>Auftrag ${params.orderNumber}</strong>
        ist seit <strong>${Math.floor(params.hours)} Arbeitsstunden</strong> offen${
          params.reminderOnly ? " und damit <strong>überfällig</strong>" : ` (Eskalationsstufe ${params.level})`
        }.</p>
        <p>Bitte prüfen und erteilen Sie die Freigabe zeitnah, damit die Auslieferung nicht verzögert wird.</p>
        ${linkBlock}
        <p>Mit freundlichen Grüßen<br/>Alix Lasers ®</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [p.email],
        subject: params.reminderOnly
          ? `Erinnerung: Freigabe ${stageTitle} überfällig – Auftrag ${params.orderNumber}`
          : `Erinnerung Freigabe ${stageTitle} – Auftrag ${params.orderNumber} (Stufe ${params.level})`,
        html,
      }),
    });
    if (!res.ok) console.error("reminder mail failed", await res.text().catch(() => ""));
    else count++;
  }
  return count;
}

/** Nutzer-IDs zu Rollennamen auflösen. */
async function usersForRoles(supabase: any, roles: string[]): Promise<string[]> {
  const { data: roleRows } = await supabase.from("roles").select("id").in("name", roles);
  const roleIds = ((roleRows ?? []) as any[]).map((r) => r.id);
  if (!roleIds.length) return [];
  const { data: ur } = await supabase.from("user_roles").select("user_id").in("role_id", roleIds);
  return [...new Set(((ur ?? []) as any[]).map((r) => r.user_id))].filter(Boolean) as string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const settings = await loadSettings(supabase);

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
    let reminders = 0;

    for (const a of approvals ?? []) {
      const order: Stage[] = ["warehouse", "accounting", "dispatch"];
      const stage = order.find((s) => (a as any)[`${s}_status`] !== "approved");
      if (!stage) continue;

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
      const hours = elapsedHours(since, now, settings);

      const { data: ordEarly } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", a.order_id)
        .maybeSingle();
      const orderNum = (ordEarly as any)?.order_number ?? a.order_id.slice(0, 8);

      // --- Erinnerung: sobald die Stufe überfällig ist, danach zyklisch erneut ---
      if (hours >= settings.overdueHours) {
        const bucket = Math.floor(hours / settings.overdueHours);
        const remMarker = `reminder:${stage}:B${bucket}`;
        const { data: remExisting } = await supabase
          .from("delivery_approval_events")
          .select("id")
          .eq("approval_id", a.id)
          .eq("comment", remMarker)
          .limit(1);
        if (!remExisting?.length) {
          const remIds = await usersForRoles(supabase, STAGE_ROLES[stage]);
          if (remIds.length) {
            await supabase.from("app_notifications").insert(
              remIds.map((id: string) => ({
                user_id: id,
                category: "operations",
                title: `Freigabe überfällig: ${STAGE_TITLE[stage]}`,
                message: `Auftrag ${orderNum} wartet seit ${Math.floor(hours)} Stunden auf Ihre Freigabe.`,
                priority: "high",
                action_url: `/auftraege/${a.order_id}?tab=freigaben`,
              })),
            );
            try {
              mails += await sendReminderMails(supabase, remIds, {
                level: 0, stage, orderNumber: String(orderNum), hours,
                orderId: a.order_id, approvalId: a.id, reminderOnly: true,
                settings, allowOneClick: true,
              });
            } catch (e) { console.error("overdue reminder mail", e); }
          }
          await supabase.from("delivery_approval_events").insert({
            approval_id: a.id,
            order_id: a.order_id,
            stage,
            old_status: (a as any)[`${stage}_status`],
            new_status: (a as any)[`${stage}_status`],
            user_name: "System (Erinnerung)",
            comment: remMarker,
          });
          reminders += 1;
        }
      }

      let level = 0;
      if (hours >= settings.l3) level = 3;
      else if (hours >= settings.l2) level = 2;
      else if (hours >= settings.l1) level = 1;
      if (!level) continue;

      const marker = `escalation:${stage}:L${level}`;
      const { data: existing } = await supabase
        .from("delivery_approval_events")
        .select("id")
        .eq("approval_id", a.id)
        .eq("comment", marker)
        .limit(1);
      if (existing && existing.length) continue;

      const roles = level === 1 ? STAGE_ROLES[stage] : level === 2 ? LEAD_ROLES[stage] : OPS_ROLES;
      const ids = await usersForRoles(supabase, roles);

      if (ids.length) {
        await supabase.from("app_notifications").insert(
          ids.map((id: string) => ({
            user_id: id,
            category: "operations",
            title: `Eskalation Stufe ${level}: ${STAGE_TITLE[stage]}`,
            message: `Auftrag ${orderNum} wartet seit ${Math.floor(hours)} Stunden auf die Freigabe ${STAGE_TITLE[stage]}.`,
            priority: level >= 2 ? "urgent" : "high",
            action_url: `/auftraege/${a.order_id}?tab=freigaben`,
          })),
        );
        sent += ids.length;
        try {
          mails += await sendReminderMails(supabase, ids as string[], {
            level, stage, orderNumber: String(orderNum), hours,
            orderId: a.order_id, approvalId: a.id, settings,
            allowOneClick: level === 1,
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

    return new Response(JSON.stringify({ ok: true, checked: approvals?.length ?? 0, notifications: sent, reminders, mails }), {
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