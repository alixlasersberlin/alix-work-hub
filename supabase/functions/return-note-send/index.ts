import "../_shared/global-bcc.ts";
// Retouren – Abholavis / Retourenschein per E-Mail an den Kunden senden.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCallerAccess } from '../_shared/caller-access.ts';
import { z } from 'npm:zod@3.25.76';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const BCC = "rde@alix-lasers.com";

const TYPES: Record<string, string> = {
  rueckholung: "Rückholung",
  geraetetausch: "Gerätetausch",
  werkstatt: "Werkstatt",
  ersatzgeraet_rueck: "Ersatzgerät zurück",
};

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : String(v);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const access = await requireCallerAccess(req, corsHeaders, ['Admin', 'Super Admin', 'Tourenplanung', 'Auftragsverwaltung', 'Order', 'Österreich']);
    if ('response' in access) return access.response;
    const parsed = z.object({ return_id: z.string().uuid(), email: z.string().trim().email() }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: 'Invalid return request' }, 400);
    const returnId = parsed.data.return_id;
    const to = parsed.data.email;
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY nicht konfiguriert" }, 500);

    const sb = access.caller;
    const { data: canPlan, error: permissionError } = await sb.rpc('can_plan_delivery');
    if (permissionError || canPlan !== true) return json({ error: 'return_send_denied' }, 403);
    const { data: r, error } = await sb.from("delivery_returns").select("*").eq("id", returnId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!r) return json({ error: "Retoure nicht gefunden" }, 404);
    if (!r.order_id) return json({ error: 'Return order assignment unavailable' }, 403);
    const { data: order, error: orderError } = await sb.from('orders').select('id,customer_id,source_system').eq('id', r.order_id).maybeSingle();
    const tenant = access.tenants.find((t: any) => t.zoho_source_system && t.zoho_source_system === order?.source_system);
    if (orderError || !order || !tenant || !order.customer_id) return json({ error: 'Return order scope denied' }, 403);
    const { data: customer, error: customerError } = await sb.from('customers').select('email,source_system').eq('id', order.customer_id).maybeSingle();
    if (customerError || !customer || customer.source_system !== order.source_system || customer.email?.trim().toLowerCase() !== to.toLowerCase()) return json({ error: 'Only the stored customer recipient is permitted' }, 403);

    const rows: [string, unknown][] = [
      ["Retouren-Nr.", r.return_number],
      ["Art", TYPES[r.return_type] ?? r.return_type],
      ["Auftragsnummer", r.order_number],
      ["Gerät", r.device_name],
      ["Seriennummer", r.serial_number],
      ["Abholdatum", fmtDate(r.pickup_date)],
      ["Zubehör", r.accessories],
    ];

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <h2 style="margin:0 0 12px">Abholavis – Retoure ${esc(r.return_number ?? "")}</h2>
        <p>Guten Tag ${esc(r.customer_name || r.company_name || "")},</p>
        <p>wir haben für Sie folgende Retoure erfasst. Bitte halten Sie das Gerät inkl. Zubehör zur Abholung bereit.</p>
        <table style="border-collapse:collapse;margin:12px 0">
          ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v ?? "—")}</b></td></tr>`).join("")}
        </table>
        ${r.reason ? `<p><b>Grund:</b> ${esc(r.reason)}</p>` : ""}
        <p style="color:#666">Bei Rückfragen antworten Sie einfach auf diese E-Mail.</p>
        <p style="color:#666">Ihr Alix Lasers Team</p>
      </div>`;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Alix Lasers ® <noreply@alixwork.de>",
        to: [to],
        bcc: [...([] as string[]).concat([BCC] as any), "service@alix-lasers.com"],
        subject: `Abholavis Retoure ${r.return_number ?? ""}`.trim(),
        html,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: out?.message ?? "Versand fehlgeschlagen" }, 502);

    return json({ ok: true, id: out?.id ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unbekannter Fehler" }, 500);
  }
});