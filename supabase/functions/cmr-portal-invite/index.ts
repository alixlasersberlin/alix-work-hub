import "../_shared/global-bcc.ts";
// CMR – Portal-Zugangslink per E-Mail an den Kunden senden (Resend).
// Rein additiv: betrifft ausschließlich den Mandanten CMR.

import { requireCallerAccess } from "../_shared/caller-access.ts";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });
    const access = await requireCallerAccess(req, corsHeaders, ['Super Admin', 'Admin', 'Geschäftsführung', 'CMR']);
    if ('response' in access) return access.response;
    const parsed = z.object({ tokenId: z.string().uuid(), portalUrl: z.string().max(2000).optional(), to: z.string().trim().email().optional() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: 'Invalid invitation' }, { status: 400, headers: corsHeaders });
    const { tokenId, to: toIn } = parsed.data;
    if (!RESEND_API_KEY) {
      return Response.json({ error: "RESEND_API_KEY fehlt" }, { status: 400, headers: corsHeaders });
    }

    const sb = access.caller;
    const { data: tok, error: tokenError } = await sb.from("cmr_portal_tokens").select("*").eq("id", tokenId).in("tenant_id", access.tenants.map(t => t.id)).maybeSingle();
    if (tokenError || !tok) return Response.json({ error: "Zugang nicht gefunden" }, { status: 404, headers: corsHeaders });

    if (!access.tenants.some(t => t.id === tok.tenant_id)) return Response.json({ error: 'Invitation tenant denied' }, { status: 403, headers: corsHeaders });
    if (tok.is_active !== true || (tok.expires_at && (!Number.isFinite(Date.parse(tok.expires_at)) || Date.parse(tok.expires_at) <= Date.now()))) return Response.json({ error: 'Portal access inactive or expired' }, { status: 409, headers: corsHeaders });
    const storedEmail = z.string().trim().email().safeParse(tok.customer_email);
    if (!storedEmail.success || typeof tok.token !== 'string' || !tok.token) return Response.json({ error: 'Stored portal identity missing' }, { status: 400, headers: corsHeaders });
    const to = storedEmail.data;
    if (toIn && toIn.toLowerCase() !== to.toLowerCase()) return Response.json({ error: 'Recipient must match stored portal customer' }, { status: 403, headers: corsHeaders });
    const portalUrl = new URL(`/cmr-portal/${encodeURIComponent(tok.token)}`, 'https://app.alixwork.de').href;

    const { data: settings, error: settingsError } = await sb.from("cmr_settings").select("*").eq("tenant_id", tok.tenant_id).maybeSingle();
    if (settingsError) return Response.json({ error: "Invitation settings inaccessible" }, { status: 403, headers: corsHeaders });
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

    // Sending an invitation never changes the customer or future portal recipient.

    return Response.json({ ok: true, id: out?.id ?? null }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 500, headers: corsHeaders });
  }
});