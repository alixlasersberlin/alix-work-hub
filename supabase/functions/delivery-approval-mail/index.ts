import "../_shared/global-bcc.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const FROM = "Alix Lasers ® <service@alixwork.de>";
const FORCED_BCC = "k.trinh@alix-operation.de";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: "Missing secrets" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const to: string[] = Array.isArray(body?.to) ? body.to.filter((x: unknown) => typeof x === "string" && /.+@.+\..+/.test(x)) : [];
    const pdfBase64: string = typeof body?.pdf_base64 === "string" ? body.pdf_base64 : "";
    const filename: string = typeof body?.filename === "string" && body.filename ? body.filename : "Freigabeprotokoll.pdf";
    const orderNumber: string | null = body?.order_number ?? null;
    const note: string | null = typeof body?.note === "string" ? body.note : null;

    if (!to.length) return json({ error: "Keine gültige Empfängeradresse" }, 400);
    if (!pdfBase64) return json({ error: "PDF fehlt" }, 400);

    const ref = orderNumber ? `Auftrag ${orderNumber}` : "Auftrag";
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Guten Tag,</p>
        <p>anbei erhalten Sie das revisionssichere <strong>Freigabeprotokoll zur Auslieferung</strong> für ${ref}.</p>
        ${note ? `<p>${String(note).replace(/</g, "&lt;")}</p>` : ""}
        <p>Das Protokoll dokumentiert alle drei Freigabestufen (Bereitstellung, Buchhaltung, Tourenplanung)
        inklusive Prüfpunkten, Unterschriften und vollständigem Audit-Trail gemäß ISO 13485 / MDR.</p>
        <p>Mit freundlichen Grüßen<br/>Alix Lasers ®</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to,
        bcc: [FORCED_BCC],
        subject: `Freigabeprotokoll Auslieferung – ${ref}`,
        html,
        attachments: [{ filename, content: pdfBase64 }],
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: out?.message ?? "Versand fehlgeschlagen" }, 502);

    return json({ ok: true, id: out?.id ?? null });
  } catch (e) {
    console.error("delivery-approval-mail", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});