// ALIX – Wiederkehrende Zahler: versendet Zahlungserinnerungen (Sammel- & Einzelversand).
// Nutzt die bestehende Mail-Infrastruktur (send-invoice-mail) und protokolliert in rz_reminder_log.
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
  v == null ? "" : new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(Number(v));

type Vars = {
  salutation: string; firstName: string; lastName: string; customerName: string;
  customerNumber: string; invoiceNumber: string; amount: string; due: string;
  sepa: boolean; shopUrl: string;
};

// Frei konfigurierbare Textbausteine (Tabelle rz_reminder_settings, Spalten tpl_*).
type Tpl = {
  greeting: string; intro: string;
  sepaTitle: string; sepaText: string;
  selfTitle: string; selfText: string;
  thanks: string; shopTitle: string; shopText: string; shopItems: string[];
  closing: string; team: string; showShopBox: boolean;
  lblCustomerNo: string; lblInvoiceNo: string; lblAmount: string; lblDue: string;
};

const DEFAULT_TPL: Tpl = {
  greeting: "Sehr geehrte/r {anrede} {nachname},",
  intro: "bitte beachten Sie, dass die Fälligkeit Ihrer monatlichen Rechnung am {faelligkeit} bevorsteht.",
  sepaTitle: "SEPA-Lastschriftverfahren",
  sepaText:
    "Da Sie bereits an unserem SEPA-Lastschriftverfahren teilnehmen, müssen Sie nichts weiter unternehmen. Der Rechnungsbetrag wird zum Fälligkeitstermin automatisch von Ihrem Konto eingezogen.",
  selfTitle: "Selbstzahler",
  selfText:
    "Als Selbstzahler bitten wir Sie, den offenen Rechnungsbetrag pünktlich bis zum Fälligkeitstermin zu überweisen.",
  thanks: "Vielen Dank. Wir wünschen Ihnen einen angenehmen Tag.",
  shopTitle: "Schon gewusst?",
  shopText: "Viele Dinge können Sie ganz bequem online erledigen. Besuchen Sie einfach:",
  shopItems: ["Ultraschallgel", "Zubehör", "Ersatzteile", "Verbrauchsmaterial", "Dienstleistungen", "viele weitere Produkte"],
  closing: "Vielen Dank für Ihr Vertrauen.",
  team: "Ihr Team von Alix.",
  showShopBox: true,
  lblCustomerNo: "Kundennummer",
  lblInvoiceNo: "Rechnungsnummer",
  lblAmount: "Rechnungsbetrag",
  lblDue: "Fälligkeitsdatum",
};

function tplFromSettings(s: Record<string, unknown>): Tpl {
  const str = (k: string, d: string) => (typeof s[k] === "string" && (s[k] as string).trim() ? (s[k] as string) : d);
  return {
    greeting: str("tpl_greeting", DEFAULT_TPL.greeting),
    intro: str("tpl_intro", DEFAULT_TPL.intro),
    sepaTitle: str("tpl_sepa_title", DEFAULT_TPL.sepaTitle),
    sepaText: str("tpl_sepa_text", DEFAULT_TPL.sepaText),
    selfTitle: str("tpl_self_title", DEFAULT_TPL.selfTitle),
    selfText: str("tpl_self_text", DEFAULT_TPL.selfText),
    thanks: str("tpl_thanks", DEFAULT_TPL.thanks),
    shopTitle: str("tpl_shop_title", DEFAULT_TPL.shopTitle),
    shopText: str("tpl_shop_text", DEFAULT_TPL.shopText),
    shopItems: Array.isArray(s.tpl_shop_items) ? (s.tpl_shop_items as string[]) : DEFAULT_TPL.shopItems,
    closing: str("tpl_closing", DEFAULT_TPL.closing),
    team: str("tpl_team", DEFAULT_TPL.team),
    showShopBox: s.tpl_show_shop_box === false ? false : true,
    lblCustomerNo: DEFAULT_TPL.lblCustomerNo,
    lblInvoiceNo: DEFAULT_TPL.lblInvoiceNo,
    lblAmount: DEFAULT_TPL.lblAmount,
    lblDue: DEFAULT_TPL.lblDue,
  };
}

// Platzhalter ersetzen: {anrede} {vorname} {nachname} {kunde} {kundennummer}
// {rechnungsnummer} {betrag} {faelligkeit} {shop}
export function fill(tplText: string, v: Vars) {
  const map: Record<string, string> = {
    anrede: v.salutation,
    vorname: v.firstName,
    nachname: v.lastName,
    kunde: v.customerName,
    kundennummer: v.customerNumber,
    rechnungsnummer: v.invoiceNumber,
    betrag: v.amount,
    faelligkeit: v.due,
    shop: v.shopUrl,
  };
  return String(tplText ?? "")
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? map[k] : m))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ,/g, ",")
    .trim();
}

const para = (s: string) =>
  esc(s).split(/\n/).map((l) => l || "&nbsp;").join("<br/>");

function buildHtml(v: Vars, t: Tpl) {
  const block = v.sepa
    ? `<p style="margin:0 0 6px;font-size:15px;font-weight:bold">${esc(fill(t.sepaTitle, v))}</p><p style="margin:0 0 18px;font-size:15px;line-height:1.6">${para(fill(t.sepaText, v))}</p>`
    : `<p style="margin:0 0 6px;font-size:15px;font-weight:bold">${esc(fill(t.selfTitle, v))}</p><p style="margin:0 0 18px;font-size:15px;line-height:1.6">${para(fill(t.selfText, v))}</p>`;
  const row = (label: string, value: string) =>
    value
      ? `<tr><td style="padding:10px 16px;font-size:14px;color:#57534e;border-top:1px solid #e7e5e4">${label}</td><td style="padding:10px 16px;font-size:14px;font-weight:bold;text-align:right;border-top:1px solid #e7e5e4">${esc(value)}</td></tr>`
      : "";
  const shopBox = t.showShopBox
    ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;line-height:1.6">
        <strong>${esc(fill(t.shopTitle, v))}</strong><br/>${para(fill(t.shopText, v))}
        <a href="${esc(v.shopUrl)}" style="color:#a16207;font-weight:bold">${esc(v.shopUrl)}</a>
        <ul style="margin:10px 0 0;padding-left:20px">${t.shopItems.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      </div>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden">
    <tr><td style="background:#0c0a09;padding:20px 28px">
      <div style="color:#d4af37;font-size:18px;font-weight:bold;letter-spacing:.5px">Alix Lasers &reg;</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 16px;font-size:15px">${para(fill(t.greeting, v))}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${para(fill(t.intro, v))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;margin:0 0 20px">
        ${row(t.lblDue, v.due)}${row(t.lblAmount, v.amount)}${row(t.lblInvoiceNo, v.invoiceNumber)}${row(t.lblCustomerNo, v.customerNumber)}
      </table>
      ${block}
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${para(fill(t.thanks, v))}</p>
      ${shopBox}
      <p style="margin:0 0 4px;font-size:15px">${para(fill(t.closing, v))}</p>
      <p style="margin:0;font-size:15px;font-weight:bold">${para(fill(t.team, v))}</p>
    </td></tr>
  </table></body></html>`;
}

function buildText(v: Vars, t: Tpl) {
  const shop = t.showShopBox
    ? `\n${fill(t.shopTitle, v)}\n${fill(t.shopText, v)} ${v.shopUrl}\n${t.shopItems.join(", ")}\n`
    : "";
  return `${fill(t.greeting, v)}

${fill(t.intro, v)}

${t.lblDue}: ${v.due}${v.amount ? `\n${t.lblAmount}: ${v.amount}` : ""}${v.invoiceNumber ? `\n${t.lblInvoiceNo}: ${v.invoiceNumber}` : ""}${v.customerNumber ? `\n${t.lblCustomerNo}: ${v.customerNumber}` : ""}

${v.sepa ? `${fill(t.sepaTitle, v)}\n${fill(t.sepaText, v)}` : `${fill(t.selfTitle, v)}\n${fill(t.selfText, v)}`}

${fill(t.thanks, v)}
${shop}
${fill(t.closing, v)}
${fill(t.team, v)}`;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const apiKeyHeader = req.headers.get("apikey") ?? "";

  const isCron =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    authHeader === `Bearer ${serviceKey}` ||
    apiKeyHeader === serviceKey;

  let userId: string | null = null;
  let userEmail: string | null = null;
  if (!isCron) {
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!who.ok) return json({ error: "Unauthorized" }, 401);
    const u = await who.json().catch(() => null);
    userId = u?.id ?? null;
    userEmail = u?.email ?? null;
  }

  const rest = async (path: string, init?: RequestInit) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const ids: string[] = Array.isArray(body.reminder_ids) ? (body.reminder_ids as string[]) : [];
  const preview = body.preview === true;
  const mode = body.mode === "auto" ? "auto" : "manual";
  if (ids.length === 0) return json({ error: "reminder_ids required" }, 400);

  // Manuelle Super-Admin-Übersteuerung (Empfänger, Betreff, Inhalt, BCC).
  const ov = (body.override ?? null) as Record<string, unknown> | null;
  let isSuperAdmin = false;
  if (ov && userId) {
    const rolesRes = await rest(`user_roles?select=role&user_id=eq.${userId}`);
    const roles = rolesRes.ok ? ((await rolesRes.json()) as any[]).map((x) => String(x.role)) : [];
    isSuperAdmin = roles.includes("Super Admin");
    if (!isSuperAdmin) return json({ error: "Nur Super Admin darf den Versand übersteuern." }, 403);
  }
  const override = isSuperAdmin ? ov : null;


  const setRes = await rest("rz_reminder_settings?select=*&id=eq.true");
  const settings = setRes.ok ? ((await setRes.json())[0] ?? {}) : {};
  const bcc: string[] = Array.isArray(settings.bcc) ? settings.bcc : [];
  const tpl = tplFromSettings(settings as Record<string, unknown>);
  const shopUrl = settings.shop_url ?? "https://alixsmart.de";
  const subjectBase = settings.subject ?? "Ihre monatliche Rechnung";

  const remRes = await rest(`rz_reminders?select=*&id=in.(${ids.join(",")})`);
  if (!remRes.ok) return json({ error: await remRes.text() }, 502);
  const reminders = (await remRes.json()) as any[];

  const results: any[] = [];
  let sent = 0, failed = 0;

  for (const r of reminders) {
    const vars: Vars = {
      salutation: r.salutation ?? "",
      firstName: r.first_name ?? "",
      lastName: r.last_name ?? "",
      customerName: r.customer_name ?? "",
      customerNumber: r.customer_number ?? "",
      invoiceNumber: r.invoice_number ?? "",
      amount: fmtAmount(r.amount, r.currency),
      due: fmtDate(r.due_date),
      sepa: r.payment_method === "sepa",
      shopUrl,
    };
    const ovStr = (k: string) =>
      override && typeof override[k] === "string" && String(override[k]).trim() ? String(override[k]) : null;
    const subject = ovStr("subject") ? fill(ovStr("subject")!, vars) : fill(subjectBase, vars);
    const html = ovStr("body_html") ? fill(ovStr("body_html")!, vars) : buildHtml(vars, tpl);
    const text = ovStr("body_text") ? fill(ovStr("body_text")!, vars) : buildText(vars, tpl);
    const toEmail = ovStr("to_email") ?? r.email;
    const effBcc = override && Array.isArray(override.bcc) ? (override.bcc as string[]) : bcc;

    if (preview) {
      results.push({ id: r.id, email: toEmail, subject, html, text });
      continue;
    }

    if (!String(toEmail ?? "").includes("@")) {
      failed++;
      await rest(`rz_reminders?id=eq.${r.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "failed", error: "Keine E-Mail-Adresse hinterlegt" }),
      });
      results.push({ id: r.id, ok: false, error: "Keine E-Mail-Adresse" });
      continue;
    }

    let ok = false, error: string | null = null;
    try {
      const mail = await fetch(`${supabaseUrl}/functions/v1/send-invoice-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: JSON.stringify({
          to_email: toEmail,
          to_name: r.customer_name,
          subject,
          body_text: text,
          body_html: html,
          bcc: effBcc,
          invoice_number: `rz-${r.id}`,
        }),
      });
      const txt = await mail.text();
      ok = mail.ok;
      if (!ok) error = `${mail.status}: ${txt.slice(0, 300)}`;
    } catch (e) {
      error = (e as Error).message;
    }

    const now = new Date().toISOString();
    await rest(`rz_reminders?id=eq.${r.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: ok ? "sent" : "failed",
        sent_at: ok ? now : null,
        sent_by: userId,
        send_mode: mode,
        error,
      }),
    }).catch(() => {});

    await rest("rz_reminder_log", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        reminder_id: r.id,
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        invoice_number: r.invoice_number,
        email: toEmail,
        due_date: r.due_date,
        amount: r.amount,
        currency: r.currency,
        payment_method: r.payment_method,
        channel: "email",
        mode,
        success: ok,
        error,
        user_id: userId,
        user_email: userEmail,
        sent_at: now,
      }),
    }).catch(() => {});

    if (ok) sent++; else failed++;
    results.push({ id: r.id, ok, error });
  }

  return json({ success: true, preview, sent, failed, results });
});
