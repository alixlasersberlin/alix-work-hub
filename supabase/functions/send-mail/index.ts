import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appendSignature } from "../_shared/mail-signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map from-email -> allowed roles (Super Admin/Admin always allowed)
const SENDER_ROLE_MAP: Record<string, string[]> = {
  "finance@alixwork.de": ["Finance"],
  "vertrieb@alixwork.de": ["Vertrieb", "Order"],
  "service@alixwork.de": ["Technik", "Kundenservice", "Reparaturannahme"],
  "news@alixwork.de": ["Marketing"],
};

// Reply-To Mapping pro Absenderadresse (eingehende Antworten gehen NICHT an die Absenderadresse)
const REPLY_TO_MAP: Record<string, string> = {
  "finance@alixwork.de": "k.trinh@alix-operation.de",
  "vertrieb@alixwork.de": "rde@alix-lasers.com",
  "service@alixwork.de": "support@alix-lasers.com",
  "news@alixwork.de": "support@alix-operation.de",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Missing environment secrets" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userErr } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: canMail } = await authClient.rpc("can_access_mail");
    if (!canMail) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      template_id = null,
      customer_id = null,
      order_id = null,
      invoice_id = null,
      ticket_id = null,
      repair_id = null,
      to_email,
      to_name = null,
      from_email,
      from_name = null,
      subject_variables = {},
      body_variables = {},
      // free-message fields
      subject: rawSubject = null,
      body_html: rawHtml = null,
      body_text: rawText = null,
      // mode
      is_test = false,
      attachments = [],
    } = body ?? {};

    if (!to_email || !from_email) {
      return jsonResponse({ error: "to_email and from_email are required" }, 400);
    }
    if (!template_id && !rawSubject && !rawHtml && !rawText) {
      return jsonResponse(
        { error: "Either template_id or subject/body must be provided" },
        400,
      );
    }

    // Sender allow-list per role (Super Admin/Admin bypass)
    const { data: isAdminRpc } = await authClient.rpc("is_admin");
    if (!isAdminRpc) {
      const allowedRoles = SENDER_ROLE_MAP[String(from_email).toLowerCase()];
      if (!allowedRoles) {
        return jsonResponse({ error: "Sender address not allowed" }, 403);
      }
      let granted = false;
      for (const role of allowedRoles) {
        const { data: hasIt } = await authClient.rpc("has_role", { check_role: role });
        if (hasIt) {
          granted = true;
          break;
        }
      }
      if (!granted) {
        return jsonResponse(
          { error: "You are not allowed to send from this address" },
          403,
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let baseSubject = rawSubject ?? "";
    let baseHtml = rawHtml ?? "";
    let baseText = rawText ?? "";
    let templateCategory: string | null = (body?.category as string | undefined) ?? null;

    if (template_id) {
      const { data: template, error: templateError } = await supabase
        .from("mail_templates")
        .select("*")
        .eq("id", template_id)
        .single();
      if (templateError || !template) {
        return jsonResponse({ error: "Template not found" }, 404);
      }
      baseSubject = rawSubject ?? template.subject ?? "";
      baseHtml = rawHtml ?? template.body_html ?? "";
      baseText = rawText ?? template.body_text ?? "";
      templateCategory = templateCategory ?? (template.category ?? null);
    }

    // DSGVO: marketing/newsletter must respect mail_unsubscribes
    const MARKETING_CATEGORIES = new Set(["marketing", "newsletter", "kampagne", "campaign"]);
    const isMarketing = !!templateCategory &&
      MARKETING_CATEGORIES.has(String(templateCategory).toLowerCase());

    if (isMarketing && !is_test) {
      const { data: unsub } = await supabase
        .from("mail_unsubscribes")
        .select("id")
        .ilike("email", String(to_email).toLowerCase())
        .limit(1)
        .maybeSingle();
      if (unsub) {
        const { data: skipped } = await supabase
          .from("mail_messages")
          .insert({
            customer_id, order_id, invoice_id, ticket_id, repair_id, template_id,
            to_email, to_name, from_email, from_name,
            subject: baseSubject, body_html: baseHtml, body_text: baseText,
            status: "skipped_unsubscribed",
            created_by: userData.user.id,
          })
          .select()
          .single();
        if (skipped?.id) {
          await supabase.from("mail_events").insert({
            message_id: skipped.id,
            event_type: "skipped_unsubscribed",
            event_data: { reason: "recipient_unsubscribed" },
          });
        }
        return jsonResponse({
          success: true,
          skipped: true,
          reason: "recipient_unsubscribed",
        });
      }

      // Auto-append unsubscribe footer for marketing/newsletter
      const unsubUrl =
        `https://alix-finance.de/unsubscribe?email=${encodeURIComponent(String(to_email))}`;
      const htmlFooter =
        `<hr style="margin-top:24px;border:none;border-top:1px solid #e5e5e5"/>` +
        `<p style="font-size:11px;color:#888;margin-top:12px">` +
        `Sie möchten keine Werbung mehr erhalten? ` +
        `<a href="${unsubUrl}" style="color:#888;text-decoration:underline">Hier abmelden</a>.` +
        `</p>`;
      const textFooter =
        `\n\n--\nSie möchten keine Werbung mehr erhalten? Hier abmelden: ${unsubUrl}`;
      if (baseHtml && !baseHtml.includes("/unsubscribe?email=")) baseHtml += htmlFooter;
      if (baseText && !baseText.includes("/unsubscribe?email=")) baseText += textFooter;
    }

    const variables: Record<string, string> = {
      ...body_variables,
      ...subject_variables,
      kunde: (body_variables as any)?.kunde ?? to_name ?? "",
      email: to_email,
    };

    const replaceVariables = (text: string | null) => {
      if (!text) return "";
      return text.replace(/\{\{(.*?)\}\}/g, (_m, key) => {
        const cleanKey = String(key).trim();
        return variables[cleanKey] ?? `{{${cleanKey}}}`;
      });
    };

    const finalSubject = replaceVariables(baseSubject);
    let finalHtml = replaceVariables(baseHtml);
    let finalText = replaceVariables(baseText);

    // Login-Name für die Signatur ermitteln
    const { data: senderProfile } = await supabase
      .from("user_profiles")
      .select("full_name, first_name, last_name, email")
      .eq("id", userData.user.id)
      .maybeSingle();
    const loginName =
      senderProfile?.full_name ||
      [senderProfile?.first_name, senderProfile?.last_name].filter(Boolean).join(" ") ||
      senderProfile?.email ||
      userData.user.email ||
      "Alix Lasers Team";
    const withSig = appendSignature(finalHtml, finalText, loginName);
    finalHtml = withSig.html;
    finalText = withSig.text;

    if (!finalSubject || (!finalHtml && !finalText)) {
      return jsonResponse({ error: "Subject and body are required" }, 400);
    }


    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: (() => { const lp = String(from_email).split("@")[0]; return `Alix Lasers | ${lp.charAt(0).toUpperCase() + lp.slice(1)} <${from_email}>`; })(),
        to: [to_name ? `${to_name} <${to_email}>` : to_email],
        reply_to: REPLY_TO_MAP[String(from_email).toLowerCase()] || undefined,
        subject: finalSubject,
        html: finalHtml || undefined,
        text: finalText || undefined,
        attachments: Array.isArray(attachments) && attachments.length
          ? attachments.map((a: any) => ({
              filename: a.filename,
              content: a.content,
              content_type: a.contentType || a.content_type || undefined,
            }))
          : undefined,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      await supabase.from("mail_messages").insert({
        customer_id,
        order_id,
        invoice_id,
        ticket_id,
        repair_id,
        template_id,
        to_email,
        to_name,
        from_email,
        from_name,
        subject: finalSubject,
        body_html: finalHtml,
        body_text: finalText,
        status: "failed",
        error_message: JSON.stringify(resendData),
        created_by: userData.user.id,
      });
      return jsonResponse({ error: resendData }, 500);
    }

    const fromLc = String(from_email).toLowerCase();
    const mailbox =
      fromLc.startsWith("news@") ? "marketing" :
      fromLc.startsWith("finance@") ? "finance" :
      fromLc.startsWith("vertrieb@") ? "vertrieb" :
      fromLc.startsWith("service@") ? "service" : "personal";

    const { data: message, error: insertError } = await supabase
      .from("mail_messages")
      .insert({
        customer_id,
        order_id,
        invoice_id,
        ticket_id,
        repair_id,
        template_id,
        to_email,
        to_name,
        from_email,
        from_name,
        subject: finalSubject,
        body_html: finalHtml,
        body_text: finalText,
        status: is_test ? "test_sent" : "sent",
        direction: "outbound",
        mailbox,
        is_read: true,
        provider_message_id: resendData.id,
        sent_at: new Date().toISOString(),
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    await supabase.from("mail_events").insert({
      message_id: message.id,
      event_type: is_test ? "test_sent" : "sent",
      event_data: resendData,
    });

    return jsonResponse({
      success: true,
      message_id: message.id,
      resend_id: resendData.id,
    });
  } catch (error) {
    console.error("send-mail error", error);
    return jsonResponse({ error: String(error) }, 500);
  }
});
