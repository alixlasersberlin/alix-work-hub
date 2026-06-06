import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SENDER_ROLE_MAP: Record<string, string[]> = {
  "news@alixwork.de": ["Marketing"],
  "vertrieb@alixwork.de": ["Vertrieb", "Order"],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function appendFooter(html: string, text: string, toEmail: string) {
  const url = `https://alix-finance.de/unsubscribe?email=${encodeURIComponent(toEmail)}`;
  const htmlFooter =
    `<hr style="margin-top:24px;border:none;border-top:1px solid #e5e5e5"/>` +
    `<p style="font-size:11px;color:#888;margin-top:12px">` +
    `Sie möchten keine Werbung mehr erhalten? ` +
    `<a href="${url}" style="color:#888;text-decoration:underline">Hier abmelden</a>.</p>`;
  const textFooter = `\n\n--\nAbmelden: ${url}`;
  return {
    html: html && !html.includes("/unsubscribe?email=") ? html + htmlFooter : html,
    text: text && !text.includes("/unsubscribe?email=") ? text + textFooter : text,
  };
}

function replaceVars(tpl: string, vars: Record<string, string>) {
  if (!tpl) return "";
  return tpl.replace(/\{\{(.*?)\}\}/g, (_m, k) => vars[String(k).trim()] ?? "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Missing env secrets" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: canCampaign } = await authClient.rpc("can_manage_mail_campaigns");
    if (!canCampaign) return jsonResponse({ error: "Forbidden" }, 403);

    const { campaign_id } = await req.json().catch(() => ({}));
    if (!campaign_id) return jsonResponse({ error: "campaign_id required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: campaign, error: campErr } = await supabase
      .from("mail_campaigns").select("*").eq("id", campaign_id).single();
    if (campErr || !campaign) return jsonResponse({ error: "Campaign not found" }, 404);

    if (campaign.status === "Wird gesendet" || campaign.status === "Gesendet") {
      return jsonResponse({ error: "Campaign already sending/sent" }, 409);
    }

    // sender check
    const { data: isAdminRpc } = await authClient.rpc("is_admin");
    if (!isAdminRpc) {
      const allowed = SENDER_ROLE_MAP[String(campaign.sender_email).toLowerCase()];
      if (!allowed) return jsonResponse({ error: "Sender not allowed" }, 403);
      let ok = false;
      for (const r of allowed) {
        const { data: has } = await authClient.rpc("has_role", { check_role: r });
        if (has) { ok = true; break; }
      }
      if (!ok) return jsonResponse({ error: "Forbidden sender" }, 403);
    }

    // load template
    let baseSubject = campaign.subject ?? "";
    let baseHtml = "";
    let baseText = "";
    if (campaign.template_id) {
      const { data: tpl } = await supabase
        .from("mail_templates").select("*").eq("id", campaign.template_id).single();
      if (tpl) {
        baseSubject = campaign.subject || tpl.subject || "";
        baseHtml = tpl.body_html || "";
        baseText = tpl.body_text || "";
      }
    }

    // mark sending
    await supabase.from("mail_campaigns")
      .update({ status: "Wird gesendet" }).eq("id", campaign_id);

    // load recipients (pending only)
    const { data: recipients } = await supabase
      .from("mail_recipients").select("*")
      .eq("campaign_id", campaign_id)
      .in("status", ["pending", "queued", "failed"]);

    let sent = 0, failed = 0, skipped = 0;

    for (const rec of recipients ?? []) {
      try {
        const email = String(rec.email).toLowerCase();
        const { data: unsub } = await supabase
          .from("mail_unsubscribes").select("id")
          .ilike("email", email).limit(1).maybeSingle();
        if (unsub) {
          await supabase.from("mail_recipients").update({
            status: "skipped_unsubscribed", updated_at: new Date().toISOString(),
          }).eq("id", rec.id);
          skipped++;
          continue;
        }

        const vars: Record<string, string> = {
          kunde: rec.name ?? "",
          firma: rec.company ?? "",
          email: rec.email,
        };
        const subj = replaceVars(baseSubject, vars);
        let html = replaceVars(baseHtml, vars);
        let text = replaceVars(baseText, vars);
        const withFooter = appendFooter(html, text, rec.email);
        html = withFooter.html; text = withFooter.text;

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${campaign.sender_name || "Alix"} <${campaign.sender_email}>`,
            to: [rec.name ? `${rec.name} <${rec.email}>` : rec.email],
            subject: subj,
            html: html || undefined,
            text: text || undefined,
            reply_to: campaign.reply_to || undefined,
            headers: {
              "List-Unsubscribe": `<https://alix-finance.de/unsubscribe?email=${encodeURIComponent(rec.email)}>`,
            },
          }),
        });
        const data = await resp.json();

        if (!resp.ok) {
          await supabase.from("mail_recipients").update({
            status: "failed", updated_at: new Date().toISOString(),
          }).eq("id", rec.id);
          failed++;
          continue;
        }

        const { data: msg } = await supabase.from("mail_messages").insert({
          customer_id: rec.customer_id,
          template_id: campaign.template_id,
          to_email: rec.email, to_name: rec.name,
          from_email: campaign.sender_email, from_name: campaign.sender_name,
          reply_to: campaign.reply_to,
          subject: subj, body_html: html, body_text: text,
          status: "sent",
          provider_message_id: data.id,
          sent_at: new Date().toISOString(),
          created_by: userData.user.id,
        }).select().single();

        if (msg?.id) {
          await supabase.from("mail_events").insert({
            message_id: msg.id,
            event_type: "sent",
            event_data: { campaign_id, resend_id: data.id },
          });
        }

        await supabase.from("mail_recipients").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", rec.id);
        sent++;
      } catch (e) {
        await supabase.from("mail_recipients").update({
          status: "failed", updated_at: new Date().toISOString(),
        }).eq("id", rec.id);
        failed++;
        console.error("recipient error", e);
      }
    }

    await supabase.from("mail_campaigns").update({
      status: failed > 0 && sent === 0 ? "Fehler" : "Gesendet",
      sent_at: new Date().toISOString(),
      error_message: failed > 0 ? `${failed} Empfänger fehlgeschlagen` : null,
    }).eq("id", campaign_id);

    return jsonResponse({ success: true, sent, failed, skipped });
  } catch (err) {
    console.error("send-campaign error", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});
