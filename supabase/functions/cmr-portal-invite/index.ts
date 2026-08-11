import "../_shared/global-bcc.ts";
// CMR – Portal-Zugangslink per E-Mail an den Kunden senden (Resend).
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
    const tokenId: string = body?.tokenId;
    const portalUrl: string = body?.portalUrl;
    const toIn: string | undefined = body?.to;
    if (!tokenId || !portalUrl) {
      return Response.json({ error: "tokenId und portalUrl erforderlich" }, { status: 400, headers: corsHeaders });
    }
    if (!RESEND_API_KEY) {
      return Response.json({ error: "RESEND_API_KEY fehlt" }, { status: 400, headers: corsHeaders });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: tok } = await sb.from("cmr_portal_tokens").select("*").eq("id", tokenId).maybeSingle();
    if (!tok) return Response.json({ error: "Zugang nicht gefunden" }, { status: 404, headers: corsHeaders });

    const to = (toIn || tok.customer_email || "").trim();
    if (!to.includes("@")) return Response.json({ error: "Keine gültige E-Mail-Adresse" }, { status: 400, headers: corsHeaders });

    const { data: settings } = await sb.from("cmr_settings").select("*").eq("tenant_id", tok.tenant_id).maybeSingle();
    const company = settings?.company_name || "CMR";
    const from = `${settings?.email_from_name || company} <${settings?.email_from_address || "onboarding@resend.dev"}>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <p>Guten Tag ${esc(tok.customer_name || "")},</p>
        <p>über den folgenden Link können Sie jederzeit Ihre Belege, offenen Posten und Zahlungen einsehen:</p>
        <p><a href="${esc(portalUrl)}" style="color:#C9A227">${esc(portalUrl)}</a></p>
        <p>Bitte behandeln Sie diesen Link vertraulich.</p>
        <p>Freundliche Grüße<br/>${esc(company)}</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: settings?.email_reply_to || undefined,
        subject: `Ihr Kundenportal bei ${company}`,
        html,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json({ error: out?.message || "Versand fehlgeschlagen" }, { status: 502, headers: corsHeaders });
    }

    await sb.from("cmr_portal_tokens").update({ customer_email: to, updated_at: new Date().toISOString() }).eq("id", tokenId);

    return Response.json({ ok: true, id: out?.id ?? null }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 500, headers: corsHeaders });
  }
});