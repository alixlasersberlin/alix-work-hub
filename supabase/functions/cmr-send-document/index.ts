import "../_shared/global-bcc.ts";
// CMR – Beleg per E-Mail versenden (Resend), inkl. PDF-Anhang.
// Rein additiv: betrifft ausschließlich den Mandanten CMR.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userSb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await userSb.auth.getUser();
    if (!u?.user) return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });

    const roleChecks = await Promise.all(
      ["Super Admin", "Admin", "Geschäftsführung", "CMR"].map((r) => userSb.rpc("has_role", { check_role: r })),
    );
    if (!roleChecks.some((r) => !!r.data)) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const documentId: string = body?.documentId;
    const to: string[] = (Array.isArray(body?.to) ? body.to : [body?.to]).filter((x: any) => typeof x === "string" && x.includes("@"));
    const subjectIn: string | undefined = body?.subject;
    const messageIn: string | undefined = body?.message;
    const pdfBase64: string | undefined = body?.pdfBase64;
    const filename: string = body?.filename || "beleg.pdf";

    if (!documentId) return Response.json({ error: "documentId fehlt" }, { status: 400, headers: corsHeaders });
    if (!to.length) return Response.json({ error: "Keine gültige Empfängeradresse" }, { status: 400, headers: corsHeaders });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: doc, error: docErr } = await sb.from("cmr_documents").select("*").eq("id", documentId).maybeSingle();
    if (docErr) throw docErr;
    if (!doc) return Response.json({ error: "Beleg nicht gefunden" }, { status: 404, headers: corsHeaders });

    const { data: settings } = await sb.from("cmr_settings").select("*").eq("tenant_id", doc.tenant_id).maybeSingle();

    // Versandprotokoll je Beleg
    const logSend = async (status: string, provider: string, subj: string, err?: string) => {
      await sb.from("cmr_email_log").insert({
        tenant_id: doc.tenant_id,
        document_id: doc.id,
        recipients: to.join(", "),
        subject: subj,
        provider,
        status,
        error: err ?? null,
      });
    };

    const subject = subjectIn?.trim() || `${doc.doc_type} ${doc.doc_number ?? ""} – ${settings?.company_name ?? "CMR"}`.trim();
    const messageText = messageIn?.trim() || `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unser Dokument ${doc.doc_number ?? ""}.\n\nMit freundlichen Grüßen`;

    const primary = settings?.color_primary || "#d4af37";
    const html = `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#eee">
      <div style="max-width:640px;margin:0 auto;padding:32px 24px">
        <div style="padding:20px;border:1px solid ${esc(primary)};border-radius:12px;background:linear-gradient(135deg,#1a1a1a,#0a0a0a)">
          <div style="color:${esc(primary)};font-size:11px;letter-spacing:2px">${esc(settings?.company_name || "CMR")}</div>
          <h1 style="margin:6px 0 0;font-size:20px;color:#fff">${esc(subject)}</h1>
        </div>
        <div style="padding:24px 6px;color:#ddd;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(messageText)}</div>
        ${settings?.email_signature ? `<div style="padding:0 6px;color:#aaa;font-size:13px;white-space:pre-wrap">${esc(settings.email_signature)}</div>` : ""}
        ${settings?.footer_html ? `<div style="margin-top:24px;color:#666;font-size:11px">${settings.footer_html}</div>` : ""}
      </div></body></html>`;

    const fromName = settings?.email_from_name || settings?.company_name || "CMR";
    const fromAddress = settings?.email_from_address || "no-reply@alix-lasers.com";

    const payload: Record<string, unknown> = {
      from: "Alix Lasers ® <noreply@alixlasers.ai>",
      to,
      bcc: [...([] as string[]).concat(["rde@alix-lasers.com"] as any), "service@alix-lasers.com"],
      subject,
      html,
    };
    if (settings?.email_reply_to) payload.reply_to = settings.email_reply_to;
    if (pdfBase64) payload.attachments = [{ filename, content: pdfBase64 }];

    // Eigener SMTP-Server des Mandanten (falls in den CMR-Einstellungen hinterlegt), sonst Resend.
    if (settings?.smtp_host) {
      const smtpPass = Deno.env.get("CMR_SMTP_PASSWORD") || "";
      if (!smtpPass) {
        return Response.json({ error: "SMTP ist konfiguriert, aber das Secret CMR_SMTP_PASSWORD fehlt." }, { status: 500, headers: corsHeaders });
      }
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
      const client = new SMTPClient({
        connection: {
          hostname: settings.smtp_host,
          port: Number(settings.smtp_port || 587),
          tls: settings.smtp_secure !== false,
          auth: { username: settings.smtp_user || fromAddress, password: smtpPass },
        },
      });
      try {
        await client.send({
          from: "Alix Lasers ® <noreply@alixlasers.ai>",
          to,
          bcc: [...([] as string[]).concat(["rde@alix-lasers.com"] as any), "service@alix-lasers.com"],
          replyTo: settings.email_reply_to || undefined,
          subject,
          html,
          attachments: pdfBase64
            ? [{ filename, encoding: "base64", content: pdfBase64, contentType: "application/pdf" }]
            : undefined,
        });
      } catch (e) {
        await logSend("failed", "smtp", subject, String((e as Error)?.message || e));
        throw e;
      } finally {
        await client.close().catch(() => {});
      }

      await sb.from("cmr_documents").update({
        sent_at: new Date().toISOString(),
        status: doc.status === "entwurf" ? "versendet" : doc.status,
      }).eq("id", documentId);
      await logSend("sent", "smtp", subject);

      return Response.json({ ok: true, to, subject, transport: "smtp" }, { headers: corsHeaders });
    }

    if (!RESEND_API_KEY) return Response.json({ error: "RESEND_API_KEY fehlt" }, { status: 500, headers: corsHeaders });

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const resText = await r.text();
    if (!r.ok) {
      await logSend("failed", "resend", subject, resText);
      return Response.json({ error: `Versand fehlgeschlagen: ${resText}` }, { status: 502, headers: corsHeaders });
    }

    await sb.from("cmr_documents").update({
      sent_at: new Date().toISOString(),
      status: doc.status === "entwurf" ? "versendet" : doc.status,
    }).eq("id", documentId);
    await logSend("sent", "resend", subject);

    return Response.json({ ok: true, to, subject }, { headers: corsHeaders });

  } catch (e: any) {
    return Response.json({ error: String(e?.message || e) }, { status: 500, headers: corsHeaders });
  }
});