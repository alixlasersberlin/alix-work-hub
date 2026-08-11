import "../_shared/global-bcc.ts";
// Retouren – Abholavis / Retourenschein per E-Mail an den Kunden senden.
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
const BCC = "rde@alix-lasers.com";

const TYPES: Record<string, string> = {
  rueckholung: "Rückholung",
  geraetetausch: "Gerätetausch",
  werkstatt: "Werkstatt",
  ersatzgeraet_rueck: "Ersatzgerät zurück",
};

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
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

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userSb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userSb.auth.getUser();
    if (!userData?.user) return json({ error: "Nicht angemeldet" }, 401);

    const body = await req.json().catch(() => ({}));
    const returnId = String(body?.return_id ?? "");
    const to = String(body?.email ?? "").trim();
    if (!returnId) return json({ error: "return_id fehlt" }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ error: "E-Mail-Adresse ungültig" }, 400);
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY nicht konfiguriert" }, 500);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: r, error } = await sb.from("delivery_returns").select("*").eq("id", returnId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!r) return json({ error: "Retoure nicht gefunden" }, 404);

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
        from: "Alix Lasers ® <noreply@alixlasers.ai>",
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