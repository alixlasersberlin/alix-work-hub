import "../_shared/global-bcc.ts";
// PLM – Bestellung per E-Mail an den Lieferanten senden.
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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const BCC = "rde@alix-lasers.com";

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : String(v);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userSb = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userSb.auth.getUser();
    if (!userData?.user) return json({ error: "Nicht angemeldet" }, 401);

    const body = await req.json().catch(() => ({}));
    const poId = String(body?.po_id ?? "");
    const pdfBase64 = typeof body?.pdf_base64 === "string" ? body.pdf_base64 : "";
    if (!poId) return json({ error: "po_id fehlt" }, 400);
    if (!RESEND_API_KEY || !LOVABLE_API_KEY) return json({ error: "E-Mail-Konfiguration fehlt" }, 500);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: po, error } = await sb
      .from("plm_purchase_orders")
      .select("*, supplier:supplier_id(name, supplier_number, contact_name, email)")
      .eq("id", poId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!po) return json({ error: "Bestellung nicht gefunden" }, 404);

    const supplier: any = (po as any).supplier ?? {};
    const to = (po as any).contact_email || supplier.email;
    if (!to) return json({ error: "Für diesen Lieferanten ist keine E-Mail hinterlegt." }, 400);

    const { data: items } = await sb
      .from("plm_purchase_order_items")
      .select("position_no, description, quantity, unit, price, part:part_id(part_number, name)")
      .eq("po_id", poId)
      .order("position_no", { ascending: true });

    const cur = (po as any).currency || "EUR";
    const rows = ((items as any[]) || []).map((it, i) => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.price || 0);
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #eee">${it.position_no ?? i + 1}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(it.part?.part_number ?? "—")}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee">${esc(it.description || it.part?.name || "—")}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${qty} ${esc(it.unit || "Stk")}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${price.toFixed(2)} ${esc(cur)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${(qty * price).toFixed(2)} ${esc(cur)}</td>
      </tr>`;
    }).join("");
    const total = ((items as any[]) || []).reduce((s, it) => s + Number(it.quantity || 0) * Number(it.price || 0), 0);

    const subject = `Bestellung ${(po as any).po_number ?? ""} – Alix Lasers GmbH`.trim();
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">
        <h2>Bestellung ${esc((po as any).po_number ?? "")}</h2>
        <p>Guten Tag${supplier.contact_name ? " " + esc(supplier.contact_name) : ""},</p>
        <p>wir bestellen hiermit verbindlich die folgenden Positionen:</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%">
          <tr style="background:#f5f5f5">
            <th style="padding:6px 8px;text-align:left">Pos.</th>
            <th style="padding:6px 8px;text-align:left">Teilenummer</th>
            <th style="padding:6px 8px;text-align:left">Bezeichnung</th>
            <th style="padding:6px 8px;text-align:right">Menge</th>
            <th style="padding:6px 8px;text-align:right">Preis</th>
            <th style="padding:6px 8px;text-align:right">Summe</th>
          </tr>
          ${rows || `<tr><td colspan="6" style="padding:8px">Keine Positionen</td></tr>`}
        </table>
        <p style="text-align:right"><b>Gesamtsumme (netto): ${total.toFixed(2)} ${esc(cur)}</b></p>
        <table cellpadding="6" style="border-collapse:collapse">
          <tr><td><b>Bestelldatum</b></td><td>${esc(fmtDate((po as any).order_date))}</td></tr>
          <tr><td><b>Gewünschter Liefertermin</b></td><td>${esc(fmtDate((po as any).expected_date))}</td></tr>
        </table>
        ${(po as any).notes ? `<p><b>Hinweise:</b><br>${esc((po as any).notes).replace(/\n/g, "<br>")}</p>` : ""}
        <p style="color:#666">Bitte bestätigen Sie Preise, Mengen und Liefertermin. Lieferungen bitte mit Lieferschein, Chargen-/Seriennummern und ggf. Materialzertifikat. Es gelten unsere Qualitätsanforderungen gemäß ISO 13485.</p>
        <p>Freundliche Grüße<br>Alix Lasers GmbH – Einkauf</p>
      </div>`;

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Alix Lasers ® <noreply@alixlasers.ai>",
        to: [to],
        bcc: [...([] as string[]).concat([BCC] as any), "service@alix-lasers.com"],
        subject,
        html,
        ...(pdfBase64
          ? { attachments: [{ filename: `Bestellung_${String((po as any).po_number ?? "PO").replace(/[^\w-]/g, "_")}.pdf`, content: pdfBase64 }] }
          : {}),
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: out?.message || `HTTP ${res.status}` }, 502);

    await sb.from("plm_purchase_orders")
      .update({ sent_at: new Date().toISOString(), status: (po as any).status === "entwurf" ? (po as any).status : "bestellt" })
      .eq("id", poId);

    await sb.from("plm_audit_log").insert({
      entity_type: "purchase_order",
      entity_id: poId,
      action: "email_sent",
      changes: { recipient: to, subject },
    }).then(() => {}, () => {});

    return json({ ok: true, recipient: to });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});