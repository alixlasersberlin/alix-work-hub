import "../_shared/global-bcc.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appendSignature } from "../_shared/mail-signature.ts";
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { bulkOrderMailSchema } from './order-bulk-validation.ts';

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
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
    const uuidOrNull = (v: unknown) =>
      typeof v === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
        ? v
        : null;
    const customer_id = uuidOrNull(body?.customer_id);
    const order_id = uuidOrNull(body?.order_id);
    const invoice_id = uuidOrNull(body?.invoice_id);
    const ticket_id = uuidOrNull(body?.ticket_id);
    const repair_id = uuidOrNull(body?.repair_id);
    const {
      template_id = null,
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
      bcc = null,
      skip_system_copies = false,
      skip_signature = false,
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

    // Bulk order mail stays on the existing transport, but checks the concrete
    // order through the caller's RLS and archives before provider submission.
    let bulkDraftId: string | null = null;
    if (body.order_bulk === true) {
      const parsed = bulkOrderMailSchema.safeParse(body);
      if (!parsed.success) return jsonResponse({ error: 'Nachricht oder Anhänge ungültig', details: parsed.error.flatten() }, 400);
      if (template_id || rawHtml || is_test || skip_system_copies || skip_signature) return jsonResponse({ error: 'Ungültiger Auftragsversand' }, 400);
      const { data: profile } = await supabase.from('user_profiles').select('account_status,is_active,invitation_status,password_reset_required').eq('id', userData.user.id).maybeSingle();
      if (profile?.account_status !== 'active' || !profile.is_active || profile.invitation_status !== 'accepted' || profile.password_reset_required) return jsonResponse({ error: 'Benutzer nicht freigegeben' }, 403);
      const { data: callerRoles } = await supabase.from('user_roles').select('role').eq('user_id', userData.user.id);
      const senderRoles = ['Super Admin', 'Admin', ...(SENDER_ROLE_MAP[parsed.data.from_email] ?? [])];
      if (!(callerRoles ?? []).some(r => senderRoles.includes(r.role))) return jsonResponse({ error: 'Keine Versandberechtigung' }, 403);
      const { data: authorizedOrder, error: orderError } = await authClient.from('orders').select('id,customer_id,tenant_id').eq('id', parsed.data.order_id).maybeSingle();
      if (orderError || !authorizedOrder || authorizedOrder.customer_id !== parsed.data.customer_id) return jsonResponse({ error: 'Auftrag oder Kundenzuordnung nicht zugänglich' }, 403);
      const { data: authorizedCustomer } = await authClient.from('customers').select('email').eq('id', parsed.data.customer_id).maybeSingle();
      if (authorizedCustomer?.email?.trim().toLowerCase() !== parsed.data.to_email.toLowerCase()) return jsonResponse({ error: 'Kundenadresse wurde geändert. Bitte Aufträge neu laden.' }, 409);
      const { data: draft, error: draftError } = await supabase.from('mail_messages').insert({
        customer_id, order_id, tenant_id: authorizedOrder.tenant_id, to_email, to_name, from_email,
        subject: parsed.data.subject, body_text: parsed.data.body_text,
        status: 'draft', direction: 'outbound', created_by: userData.user.id,
      }).select('id').single();
      if (draftError || !draft) return jsonResponse({ error: 'Kundenakte konnte nicht gespeichert werden. Keine E-Mail versendet.' }, 500);
      bulkDraftId = draft.id;
      try {
        for (const [index, attachment] of parsed.data.attachments.entries()) {
          const bytes = Uint8Array.from(atob(attachment.content), c => c.charCodeAt(0));
          const path = `${order_id}/mail/${draft.id}/${index}-${attachment.filename}`;
          const { error: uploadError } = await supabase.storage.from('order-invoices').upload(path, bytes, { contentType: attachment.contentType, upsert: false });
          if (uploadError) throw uploadError;
          const { error: documentError } = await supabase.from('order_documents').insert({ order_id, file_name: attachment.filename, file_path: path, file_type: attachment.contentType, document_type: 'E-Mail-Anhang', uploaded_by: userData.user.id });
          if (documentError) throw documentError;
          const { error: attachmentError } = await supabase.from('mail_attachments').insert({
            message_id: draft.id, customer_id, order_id, file_name: attachment.filename,
            storage_bucket: 'order-invoices', storage_path: path, file_size: bytes.length,
            mime_type: attachment.contentType, document_type: 'E-Mail-Anhang', created_by: userData.user.id,
          });
          if (attachmentError) throw attachmentError;
        }
      } catch (e) {
        await supabase.from('mail_messages').update({ status: 'failed', error_message: String(e) }).eq('id', draft.id);
        return jsonResponse({ error: 'Anhänge konnten nicht archiviert werden. Keine E-Mail versendet.' }, 500);
      }
    }

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

    // Login-Name für die Signatur ermitteln (nur Klarname – niemals E-Mail-Adresse in der Signatur)
    const { data: senderProfile } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", userData.user.id)
      .maybeSingle();
    const rawName = senderProfile?.full_name?.trim();
    // Fallback: lokaler Teil der E-Mail (vor dem @) – so wird nie die volle Adresse in der Signatur angezeigt
    const emailLocalPart = (senderProfile?.email || userData.user.email || "")
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    const loginName = rawName || emailLocalPart || "Alix Lasers Team";
    const { data: isAdminForFlags } = await authClient.rpc("is_admin");
    const rawMode = !!isAdminForFlags && (skip_system_copies === true || skip_signature === true);
    if (!(rawMode && skip_signature === true)) {
      const withSig = appendSignature(finalHtml, finalText, loginName);
      finalHtml = withSig.html;
      finalText = withSig.text;
    }
    const noCopies = !!isAdminForFlags && skip_system_copies === true;

    if (!finalSubject || (!finalHtml && !finalText)) {
      return jsonResponse({ error: "Subject and body are required" }, 400);
    }


    const resendResponse = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Nur in Resend verifizierte Domain verwenden (alixwork.de)
        from: (() => {
          const addr = String(from_email).toLowerCase().trim();
          const safe = addr.endsWith("@alixwork.de") ? addr : "noreply@alixwork.de";
          return `Alix Lasers ® <${safe}>`;
        })(),
        to: [to_name ? `${to_name} <${to_email}>` : to_email],
        bcc: (() => {
          const list = Array.isArray(bcc) ? [...bcc] : (bcc ? [bcc] : []);
          if (noCopies) return list;
          const isInvoice = !!invoice_id || String(templateCategory ?? '').toLowerCase() === 'finance';
          const archives = isInvoice
            ? ['rde@alix-lasers.com', 'k.trinh@alix-operation.de', 'service@alix-lasers.com']
            : ['rde@alix-lasers.com', 'service@alix-lasers.com'];
          for (const archive of archives) {
            if (!list.some((e: string) => String(e).trim().toLowerCase() === archive.toLowerCase())) list.push(archive);
          }
          return list;
        })(),
        reply_to: REPLY_TO_MAP[String(from_email).toLowerCase()] || undefined,
        ...(noCopies ? { headers: { "X-Alix-No-System-Copies": "1" } } : {}),
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

    const resendText = await resendResponse.text();
    let resendData: any;
    try {
      resendData = resendText ? JSON.parse(resendText) : {};
    } catch (_parseError) {
      resendData = { raw: resendText };
    }

    if (!resendResponse.ok) {
      const failedPayload = {
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
      };
      if (bulkDraftId) await supabase.from('mail_messages').update(failedPayload).eq('id', bulkDraftId);
      else await supabase.from('mail_messages').insert(failedPayload);
      return jsonResponse({ error: "Provider request failed", status: resendResponse.status, details: resendData }, resendResponse.status);
    }

    const fromLc = String(from_email).toLowerCase();
    const mailbox =
      fromLc.startsWith("news@") ? "marketing" :
      fromLc.startsWith("finance@") ? "finance" :
      fromLc.startsWith("vertrieb@") ? "vertrieb" :
      fromLc.startsWith("service@") ? "service" : "personal";

    const messagePayload = {
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
      };
    const { data: message, error: insertError } = bulkDraftId
      ? await supabase.from('mail_messages').update(messagePayload).eq('id', bulkDraftId).select().single()
      : await supabase.from('mail_messages').insert(messagePayload).select().single();

    if (insertError) {
      if (bulkDraftId) return jsonResponse({ success: true, message_id: bulkDraftId, resend_id: resendData.id, archive_warning: 'E-Mail versendet; Entwurf in Kundenakte vorhanden, Versandstatus konnte nicht aktualisiert werden. Nicht erneut senden.' });
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