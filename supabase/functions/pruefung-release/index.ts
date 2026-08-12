// ALIX – PRÜFUNG freigeben: versendet alle während der Prüfung zurückgehaltenen
// Ratenrechnungen eines Vertrags an den Kunden und setzt sie auf "offen".
import "../_shared/global-bcc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return `${day}.${m}.${y}`;
};
const fmtAmount = (v: number | null, cur: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(Number(v ?? 0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!who.ok) return json({ error: "Unauthorized" }, 401);

  const rest = (path: string, init?: RequestInit) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  const body = await req.json().catch(() => ({} as any));
  const profileId = String(body?.profile_id ?? "");
  if (!profileId) return json({ error: "profile_id erforderlich" }, 400);

  // Vertrag laden
  const pRes = await rest(
    `zoho_recurring_profiles?select=id,customer_id,customer_name,company_name,email,reference_number,recurrence_name&id=eq.${profileId}`,
  );
  if (!pRes.ok) return json({ error: await pRes.text() }, 502);
  const profile = ((await pRes.json()) as any[])[0];
  if (!profile) return json({ error: "Vertrag nicht gefunden" }, 404);

  // Zurückgehaltene Rechnungen
  const iRes = await rest(
    `ratenplan_generated_invoices?select=*&profile_id=eq.${profileId}&status=eq.zurueckgehalten&order=invoice_date.asc`,
  );
  if (!iRes.ok) return json({ error: await iRes.text() }, 502);
  const invoices = (await iRes.json()) as any[];
  if (!invoices.length) return json({ success: true, sent: 0, skipped_reason: "keine zurückgehaltenen Rechnungen" });

  // Empfänger ermitteln
  let email = String(profile.email ?? "").trim();
  if (!email && profile.customer_id) {
    const cRes = await rest(
      `customers?select=email,company_name,contact_name&external_customer_id=eq.${encodeURIComponent(String(profile.customer_id))}&limit=1`,
    );
    if (cRes.ok) email = String(((await cRes.json()) as any[])[0]?.email ?? "").trim();
  }
  if (!email) return json({ error: "Keine E-Mail-Adresse zum Vertrag hinterlegt" }, 400);

  const name = profile.company_name || profile.customer_name || "Kundin / Kunde";
  const contract = profile.reference_number || profile.recurrence_name || "";

  let sent = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    const subject = `Ihre Rate ${fmtDate(inv.invoice_date)}${contract ? ` – ${contract}` : ""}`;
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden">
      <tr><td style="background:#0c0a09;padding:20px 28px">
        <div style="color:#d4af37;font-size:18px;font-weight:bold">Alix Lasers &reg;</div>
        <div style="color:#a8a29e;font-size:12px;margin-top:2px">Ratenrechnung</div>
      </td></tr>
      <tr><td style="padding:28px;font-size:15px;line-height:1.6">
        <p style="margin:0 0 16px">Sehr geehrte/r ${esc(name)},</p>
        <p style="margin:0 0 16px">anbei die Information zu Ihrer Rate${contract ? ` aus dem Vertrag ${esc(contract)}` : ""}.</p>
        <table role="presentation" width="100%" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;margin:0 0 20px">
          <tr><td style="padding:12px 16px;color:#57534e">Rate</td><td style="padding:12px 16px;text-align:right;font-weight:bold">${esc(inv.installment_no)}${inv.installment_total ? ` / ${esc(inv.installment_total)}` : ""}</td></tr>
          <tr><td style="padding:12px 16px;color:#57534e;border-top:1px solid #e7e5e4">Rechnungsdatum</td><td style="padding:12px 16px;text-align:right;border-top:1px solid #e7e5e4">${fmtDate(inv.invoice_date)}</td></tr>
          <tr><td style="padding:12px 16px;color:#57534e;border-top:1px solid #e7e5e4">Fällig am</td><td style="padding:12px 16px;text-align:right;border-top:1px solid #e7e5e4">${fmtDate(inv.due_date ?? inv.invoice_date)}</td></tr>
          <tr><td style="padding:12px 16px;color:#57534e;border-top:1px solid #e7e5e4">Betrag</td><td style="padding:12px 16px;text-align:right;font-weight:bold;border-top:1px solid #e7e5e4">${fmtAmount(inv.amount, inv.currency)}</td></tr>
        </table>
        <p style="margin:0 0 4px">Mit freundlichen Grüßen</p>
        <p style="margin:0;font-weight:bold">Ihr Team von Alix Lasers &reg;</p>
      </td></tr></table></body></html>`;

    const mail = await fetch(`${supabaseUrl}/functions/v1/send-invoice-mail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        to_email: email,
        to_name: name,
        subject,
        body_text: `Sehr geehrte/r ${name},\n\nRate ${inv.installment_no}${inv.installment_total ? `/${inv.installment_total}` : ""} vom ${fmtDate(inv.invoice_date)} über ${fmtAmount(inv.amount, inv.currency)}, fällig am ${fmtDate(inv.due_date ?? inv.invoice_date)}.\n\nMit freundlichen Grüßen\nIhr Team von Alix Lasers`,
        body_html: html,
      }),
    });

    if (mail.ok) {
      sent++;
      await rest(`ratenplan_generated_invoices?id=eq.${inv.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "offen",
          notes: `${inv.notes ? inv.notes + " | " : ""}Nach PRÜFUNG versendet am ${new Date().toISOString().slice(0, 10)}`,
        }),
      });
    } else {
      errors.push(`${inv.invoice_date}: ${(await mail.text()).slice(0, 200)}`);
    }
  }

  return json({ success: errors.length === 0, sent, held: invoices.length, errors: errors.slice(0, 5) });
});
