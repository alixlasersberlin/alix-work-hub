// Einmaliger Stapelversand von Zoho-Rechnungen eines Tages (Original-PDF aus Zoho).
// Nur per x-cron-secret aufrufbar. Idempotent über email_send_log (source_id = zoho-inv-<id>).
import { createClient } from "npm:@supabase/supabase-js@2";

const CC = "buchhaltung@alix-operation.de";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

function b64(bytes: Uint8Array) {
  let s = ""; const c = 0x8000;
  for (let i = 0; i < bytes.length; i += c) s += String.fromCharCode(...bytes.subarray(i, i + c));
  return btoa(s);
}
const money = (n: number, cur: string) => new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(n || 0);
const dateDe = (d?: string | null) => (d ? d.split("-").reverse().join(".") : "");

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const gatewayKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const supplied = req.headers.get("x-cron-secret");
  if (!supplied) return json({ error: "Unauthorized" }, 401);
  if (supplied !== Deno.env.get("CRON_SECRET")) {
    const ok = await admin.rpc("auto_az_secret_ok", { p_secret: supplied });
    if (ok.error || ok.data !== true) return json({ error: "Unauthorized" }, 401);
  }
  if (!gatewayKey || !resendKey) return json({ error: "Versandkonfiguration fehlt" }, 500);

  const body = await req.json().catch(() => ({}));
  const date: string = body.date;
  const limit = Math.min(Math.max(Number(body.limit ?? 15), 1), 30);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return json({ error: "date fehlt" }, 400);

  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  const tokRes = await fetch("https://accounts.zoho.eu/oauth/v2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: env("ZOHO_EU_1_REFRESH_TOKEN"), client_id: env("ZOHO_EU_1_CLIENT_ID"), client_secret: env("ZOHO_EU_1_CLIENT_SECRET"), grant_type: "refresh_token" }),
  });
  const tok = await tokRes.json();
  if (!tok?.access_token) return json({ error: "Zoho-Anmeldung fehlgeschlagen", details: tok }, 502);
  const org = env("ZOHO_EU_1_ORGANIZATION_ID");

  const cols = "zoho_invoice_id, invoice_number, customer_name, total, currency, due_date, raw_data";
  const [a, b] = await Promise.all([
    admin.from("zoho_invoices").select(cols).eq("source_system", "zoho_eu_1").eq("invoice_date", date),
    admin.from("zoho_recurring_invoices").select(cols).eq("source_system", "zoho_eu_1").eq("invoice_date", date),
  ]);
  if (a.error || b.error) return json({ error: (a.error ?? b.error)!.message }, 500);
  const all = [...(a.data ?? []), ...(b.data ?? [])];

  const ids = all.map((i) => `zoho-inv-${i.zoho_invoice_id}`);
  const sentQ = await admin.from("email_send_log").select("source_id").in("source_id", ids).eq("status", "sent");
  const done = new Set((sentQ.data ?? []).map((r: any) => r.source_id));
  const todo = all.filter((i) => !done.has(`zoho-inv-${i.zoho_invoice_id}`));

  const results: any[] = [];
  for (const inv of todo.slice(0, limit)) {
    const sid = `zoho-inv-${inv.zoho_invoice_id}`;
    const to = String(inv.raw_data?.email ?? "").trim();
    try {
      if (!to.includes("@")) throw new Error("Keine E-Mail-Adresse");
      const pdfRes = await fetch(`https://www.zohoapis.eu/books/v3/invoices/${inv.zoho_invoice_id}?organization_id=${org}&accept=pdf`, { headers: { Authorization: `Zoho-oauthtoken ${tok.access_token}` } });
      if (!pdfRes.ok) throw new Error(`PDF aus Zoho fehlgeschlagen (${pdfRes.status})`);
      const pdf = new Uint8Array(await pdfRes.arrayBuffer());
      const subject = `Ihre Rechnung ${inv.invoice_number} – Alix Lasers`;
      const text = `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie Ihre Rechnung ${inv.invoice_number} vom ${dateDe(date)} über ${money(Number(inv.total), inv.currency)}${inv.due_date ? `, fällig am ${dateDe(inv.due_date)}` : ""}.\n\nBei Fragen erreichen Sie uns unter buchhaltung@alix-operation.de.\n\nMit freundlichen Grüßen\nAlix Lasers Finance`;
      const cc = to.toLowerCase() === CC ? [] : [CC];
      const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${gatewayKey}`, "X-Connection-Api-Key": resendKey, "Content-Type": "application/json", "Idempotency-Key": sid },
        body: JSON.stringify({ from: "Alix Lasers Finance <finance@alixwork.de>", to: [to], cc, reply_to: CC, subject, text, html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!))}</pre>`, attachments: [{ filename: `Rechnung_${inv.invoice_number}.pdf`, content: b64(pdf), content_type: "application/pdf" }] }),
      });
      if (!r.ok) throw new Error(`Versand fehlgeschlagen (${r.status}): ${(await r.text()).slice(0, 200)}`);
      const res = await r.json();
      await admin.from("email_send_log").insert([to, ...cc].map((rc, i) => ({ source_id: sid, recipient_email: rc, subject, template: "zoho-invoice-batch", status: "sent", provider_message_id: res.id, sent_at: new Date().toISOString(), metadata: { role: i === 0 ? "primary" : "cc", invoice_number: inv.invoice_number } })));
      results.push({ nr: inv.invoice_number, to, ok: true });
    } catch (e: any) {
      results.push({ nr: inv.invoice_number, to, ok: false, error: e?.message });
    }
  }
  return json({ total: all.length, already_sent: done.size, processed: results.length, remaining: Math.max(0, todo.length - results.length), sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) });
});
