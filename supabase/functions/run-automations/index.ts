// Alix MailCenter – Automations runner
// Iterates active automations, finds new trigger records, applies delay,
// sends via Resend, logs in mail_messages / mail_events / mail_automation_runs.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appendSignature } from "../_shared/mail-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MARKETING = new Set(["marketing", "newsletter", "kampagne", "campaign"]);

const REPLY_TO_MAP: Record<string, string> = {
  "finance@alixwork.de": "k.trinh@alix-operation.de",
  "vertrieb@alixwork.de": "rde@alix-lasers.com",
  "service@alixwork.de": "support@alix-lasers.com",
  "news@alixwork.de": "support@alix-operation.de",
};

interface TriggerRecord {
  id: string;
  customer_id?: string | null;
  order_id?: string | null;
  invoice_id?: string | null;
  ticket_id?: string | null;
  repair_id?: string | null;
  number?: string | null;
  created_at: string;
  status_at?: string | null;
}

async function findTriggerRecords(
  supabase: any,
  triggerType: string,
  delayMinutes: number,
): Promise<TriggerRecord[]> {
  // Only look back up to 30 days to limit scope
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000).toISOString();

  switch (triggerType) {
    case "order_created": {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_id, order_number, created_at")
        .gte("created_at", since)
        .lte("created_at", cutoff)
        .limit(200);
      return (data ?? []).map((o: any) => ({
        id: o.id, customer_id: o.customer_id, order_id: o.id,
        number: o.order_number, created_at: o.created_at,
      }));
    }
    case "order_paid": {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_id, order_number, order_status, updated_at")
        .ilike("order_status", "%bezahlt%")
        .gte("updated_at", since)
        .lte("updated_at", cutoff)
        .limit(200);
      return (data ?? []).map((o: any) => ({
        id: o.id, customer_id: o.customer_id, order_id: o.id,
        number: o.order_number, created_at: o.updated_at,
      }));
    }
    case "deposit_open": {
      // Orders older than delay with status "Anzahlung offen"
      const { data } = await supabase
        .from("orders")
        .select("id, customer_id, order_number, order_status, created_at")
        .ilike("order_status", "%Anzahlung%")
        .gte("created_at", since)
        .lte("created_at", cutoff)
        .limit(200);
      return (data ?? []).map((o: any) => ({
        id: o.id, customer_id: o.customer_id, order_id: o.id,
        number: o.order_number, created_at: o.created_at,
      }));
    }
    case "production_started": {
      const { data } = await supabase
        .from("production_orders")
        .select("id, customer_id, order_number, status, created_at")
        .gte("created_at", since)
        .lte("created_at", cutoff)
        .limit(200);
      return (data ?? []).map((o: any) => ({
        id: o.id, customer_id: o.customer_id, order_id: o.id,
        number: o.order_number, created_at: o.created_at,
      }));
    }
    case "delivery_planned": {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_id, order_number, order_status, updated_at")
        .ilike("order_status", "%lieferung%")
        .gte("updated_at", since)
        .lte("updated_at", cutoff)
        .limit(200);
      return (data ?? []).map((o: any) => ({
        id: o.id, customer_id: o.customer_id, order_id: o.id,
        number: o.order_number, created_at: o.updated_at,
      }));
    }
    case "delivered": {
      const { data } = await supabase
        .from("orders")
        .select("id, customer_id, order_number, order_status, updated_at")
        .ilike("order_status", "geliefert")
        .gte("updated_at", since)
        .lte("updated_at", cutoff)
        .limit(200);
      return (data ?? []).map((o: any) => ({
        id: o.id, customer_id: o.customer_id, order_id: o.id,
        number: o.order_number, created_at: o.updated_at,
      }));
    }
    case "repair_received": {
      const { data } = await supabase
        .from("repair_orders")
        .select("id, customer_id, repair_number, created_at")
        .gte("created_at", since)
        .lte("created_at", cutoff)
        .limit(200);
      return (data ?? []).map((r: any) => ({
        id: r.id, customer_id: r.customer_id, repair_id: r.id,
        number: r.repair_number, created_at: r.created_at,
      }));
    }
    case "repair_done": {
      const { data } = await supabase
        .from("repair_orders")
        .select("id, customer_id, repair_number, repair_status, updated_at")
        .or("repair_status.ilike.%abgeschlossen%,repair_status.ilike.%fertig%")
        .gte("updated_at", since)
        .lte("updated_at", cutoff)
        .limit(200);
      return (data ?? []).map((r: any) => ({
        id: r.id, customer_id: r.customer_id, repair_id: r.id,
        number: r.repair_number, created_at: r.updated_at,
      }));
    }
    default:
      return [];
  }
}

function replaceVars(tpl: string, vars: Record<string, string>) {
  if (!tpl) return "";
  return tpl.replace(/\{\{(.*?)\}\}/g, (_m, k) => vars[String(k).trim()] ?? "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require CRON_SECRET — function is verify_jwt=false and triggers mass email sends.
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing env" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Optional single automation invocation
  const body = await req.json().catch(() => ({}));
  const specificId = body?.automation_id as string | undefined;

  let q = supabase.from("mail_automations").select("*").eq("is_active", true);
  if (specificId) q = q.eq("id", specificId);
  const { data: automations } = await q;

  const results: any[] = [];

  for (const a of automations ?? []) {
    let processed = 0, sent = 0, failed = 0, skipped = 0;
    try {
      const records = await findTriggerRecords(
        supabase, a.trigger_type, a.delay_minutes ?? 0,
      );

      const { data: tpl } = a.template_id
        ? await supabase.from("mail_templates").select("*").eq("id", a.template_id).single()
        : { data: null };

      if (!tpl) {
        await supabase.from("mail_automations").update({
          status: "Fehler", last_error: "Vorlage nicht gefunden",
          last_run_at: new Date().toISOString(),
        }).eq("id", a.id);
        results.push({ id: a.id, error: "template_missing" });
        continue;
      }

      const isMarketing = tpl.category &&
        MARKETING.has(String(tpl.category).toLowerCase());

      for (const rec of records) {
        processed++;

        // Dedup check via unique index
        const { data: existing } = await supabase
          .from("mail_automation_runs").select("id")
          .eq("automation_id", a.id)
          .eq("order_id", rec.order_id ?? "00000000-0000-0000-0000-000000000000")
          .eq("invoice_id", rec.invoice_id ?? "00000000-0000-0000-0000-000000000000")
          .eq("repair_id", rec.repair_id ?? "00000000-0000-0000-0000-000000000000")
          .eq("ticket_id", rec.ticket_id ?? "00000000-0000-0000-0000-000000000000")
          .eq("customer_id", rec.customer_id ?? "00000000-0000-0000-0000-000000000000")
          .maybeSingle();
        if (existing) continue;

        // Load customer
        const { data: cust } = rec.customer_id
          ? await supabase.from("customers").select("*").eq("id", rec.customer_id).single()
          : { data: null };
        if (!cust?.email) {
          await supabase.from("mail_automation_runs").insert({
            automation_id: a.id, customer_id: rec.customer_id,
            order_id: rec.order_id, invoice_id: rec.invoice_id,
            repair_id: rec.repair_id, ticket_id: rec.ticket_id,
            status: "skipped_no_email",
          });
          skipped++;
          continue;
        }

        // Unsubscribe check for marketing
        if (isMarketing) {
          const { data: unsub } = await supabase
            .from("mail_unsubscribes").select("id")
            .ilike("email", String(cust.email).toLowerCase())
            .maybeSingle();
          if (unsub) {
            await supabase.from("mail_automation_runs").insert({
              automation_id: a.id, customer_id: cust.id,
              order_id: rec.order_id, invoice_id: rec.invoice_id,
              repair_id: rec.repair_id, ticket_id: rec.ticket_id,
              status: "skipped_unsubscribed",
            });
            skipped++;
            continue;
          }
        }

        const vars: Record<string, string> = {
          kunde: cust.contact_name ?? cust.company_name ?? "",
          firma: cust.company_name ?? "",
          email: cust.email,
          auftragsnummer: rec.number ?? "",
          kundennummer: cust.external_customer_id ?? "",
        };
        const subj = replaceVars(tpl.subject ?? "", vars);
        let html = replaceVars(tpl.body_html ?? "", vars);
        let text = replaceVars(tpl.body_text ?? "", vars);
        const senderEmail = a.sender_email || "news@alixwork.de";
        const senderLp = (() => { const lp = String(senderEmail).split("@")[0]; return lp.charAt(0).toUpperCase() + lp.slice(1); })();
        const sigName = a.sender_name || `Alix Lasers | ${senderLp}`;
        const sig = appendSignature(html, text, sigName);
        html = sig.html; text = sig.text;

        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `Alix Lasers | ${senderLp} <${senderEmail}>`,
              to: [cust.contact_name ? `${cust.contact_name} <${cust.email}>` : cust.email],
              reply_to: REPLY_TO_MAP[String(a.sender_email || "news@alixwork.de").toLowerCase()] || undefined,
              subject: subj,
              html: html || undefined,
              text: text || undefined,
            }),
          });
          const data = await resp.json();

          if (!resp.ok) {
            await supabase.from("mail_automation_runs").insert({
              automation_id: a.id, customer_id: cust.id,
              order_id: rec.order_id, invoice_id: rec.invoice_id,
              repair_id: rec.repair_id, ticket_id: rec.ticket_id,
              status: "failed", error_message: JSON.stringify(data),
            });
            failed++;
            continue;
          }

          const { data: msg } = await supabase.from("mail_messages").insert({
            customer_id: cust.id,
            order_id: rec.order_id, repair_id: rec.repair_id,
            invoice_id: rec.invoice_id, ticket_id: rec.ticket_id,
            template_id: tpl.id,
            to_email: cust.email, to_name: cust.contact_name,
            from_email: a.sender_email, from_name: a.sender_name,
            subject: subj, body_html: html, body_text: text,
            status: "sent",
            provider_message_id: data.id,
            sent_at: new Date().toISOString(),
          }).select().single();

          if (msg?.id) {
            await supabase.from("mail_events").insert({
              message_id: msg.id,
              event_type: "sent",
              event_data: { automation_id: a.id, resend_id: data.id },
            });
          }

          await supabase.from("mail_automation_runs").insert({
            automation_id: a.id, customer_id: cust.id,
            order_id: rec.order_id, invoice_id: rec.invoice_id,
            repair_id: rec.repair_id, ticket_id: rec.ticket_id,
            status: "sent", message_id: msg?.id,
          });
          sent++;
        } catch (e) {
          await supabase.from("mail_automation_runs").insert({
            automation_id: a.id, customer_id: cust.id,
            order_id: rec.order_id, invoice_id: rec.invoice_id,
            repair_id: rec.repair_id, ticket_id: rec.ticket_id,
            status: "failed", error_message: String(e),
          });
          failed++;
        }
      }

      await supabase.from("mail_automations").update({
        status: failed > 0 && sent === 0 ? "Fehler" : "Aktiv",
        last_error: failed > 0 ? `${failed} Fehler beim letzten Lauf` : null,
        last_run_at: new Date().toISOString(),
      }).eq("id", a.id);

      results.push({ id: a.id, processed, sent, failed, skipped });
    } catch (err) {
      await supabase.from("mail_automations").update({
        status: "Fehler", last_error: String(err),
        last_run_at: new Date().toISOString(),
      }).eq("id", a.id);
      results.push({ id: a.id, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
