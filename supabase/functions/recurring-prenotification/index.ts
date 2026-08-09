// Sendet 5 Tage vor jeder Fälligkeit eine höfliche Vorankündigung an Ratenzahler.
// Cron-tauglich (CRON_SECRET / Service-Role) und manuell aus dem UI aufrufbar.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BCC = "ktrinh@alix-operation.de";
const LEAD_DAYS = 5;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
};

const fmtAmount = (v: number | null, cur: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(Number(v ?? 0));

function buildHtml(p: {
  name: string; due: string; amount: number | null; currency: string; reference: string | null;
}) {
  const amount = fmtAmount(p.amount, p.currency);
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden">
    <tr><td style="background:#0c0a09;padding:20px 28px">
      <div style="color:#d4af37;font-size:18px;font-weight:bold;letter-spacing:.5px">Alix Lasers &reg;</div>
      <div style="color:#a8a29e;font-size:12px;margin-top:2px">Zahlungserinnerung &ndash; freundliche Vorankündigung</div>
    </td></tr>
    <tr><td style="padding:28px">
      <p style="margin:0 0 16px;font-size:15px">Sehr geehrte/r ${esc(p.name)},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
        vielen Dank für Ihr Vertrauen und die angenehme Zusammenarbeit. Wir möchten Sie heute rein informativ
        und rechtzeitig darüber in Kenntnis setzen, dass die nächste Rate Ihres Vertrages in Kürze fällig wird.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;margin:0 0 20px">
        <tr><td style="padding:14px 16px;font-size:14px;color:#57534e">Fälligkeitsdatum</td>
            <td style="padding:14px 16px;font-size:14px;font-weight:bold;text-align:right">${fmtDate(p.due)}</td></tr>
        <tr><td style="padding:14px 16px;font-size:14px;color:#57534e;border-top:1px solid #e7e5e4">Betrag</td>
            <td style="padding:14px 16px;font-size:14px;font-weight:bold;text-align:right;border-top:1px solid #e7e5e4">${amount}</td></tr>
        ${p.reference ? `<tr><td style="padding:14px 16px;font-size:14px;color:#57534e;border-top:1px solid #e7e5e4">Vertrag / Referenz</td>
            <td style="padding:14px 16px;font-size:14px;text-align:right;border-top:1px solid #e7e5e4">${esc(p.reference)}</td></tr>` : ""}
      </table>
      <p style="margin:0 0 10px;font-size:15px;font-weight:bold">Was bedeutet das für Sie?</p>
      <ul style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.7;color:#292524">
        <li><strong>Sie nehmen am SEPA-Lastschriftverfahren teil:</strong> Sie müssen nichts weiter veranlassen.
            Wir ziehen den Betrag am Fälligkeitstag bequem von Ihrem hinterlegten Konto ein.
            Bitte sorgen Sie lediglich für eine ausreichende Kontodeckung.</li>
        <li><strong>Sie nehmen nicht am SEPA-Verfahren teil:</strong> Wir bitten Sie höflich, den Betrag
            bis zum Fälligkeitstag auf unser Konto zu überweisen.</li>
      </ul>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;line-height:1.6">
        <strong>Unser Tipp:</strong> Richten Sie bei Ihrer Bank einen <strong>Dauerauftrag</strong> ein &ndash;
        so ist Ihre Rate immer pünktlich beglichen, ganz ohne weiteren Aufwand. Gerne senden wir Ihnen auf Wunsch
        auch ein SEPA-Lastschriftmandat zu.
      </div>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#57534e">
        Sollten Sie Fragen zu Ihrem Vertrag haben oder eine abweichende Zahlungsvereinbarung wünschen,
        melden Sie sich bitte einfach kurz bei uns &ndash; wir finden gemeinsam eine gute Lösung.
      </p>
      <p style="margin:0 0 4px;font-size:15px">Mit freundlichen Grüßen</p>
      <p style="margin:0;font-size:15px;font-weight:bold">Ihr Team von Alix Lasers &reg;</p>
      <p style="margin:16px 0 0;font-size:12px;color:#a8a29e">
        service@alix-lasers.com &middot; Diese Nachricht dient ausschließlich Ihrer Information und stellt keine Mahnung dar.
      </p>
    </td></tr>
  </table></body></html>`;
}

function buildText(p: { name: string; due: string; amount: number | null; currency: string; reference: string | null }) {
  return `Sehr geehrte/r ${p.name},

wir möchten Sie rechtzeitig informieren, dass die nächste Rate Ihres Vertrages am ${fmtDate(p.due)} fällig wird.

Betrag: ${fmtAmount(p.amount, p.currency)}${p.reference ? `\nVertrag / Referenz: ${p.reference}` : ""}

- Nehmen Sie am SEPA-Lastschriftverfahren teil, buchen wir den Betrag am Fälligkeitstag bequem von Ihrem Konto ab. Bitte achten Sie auf ausreichende Kontodeckung.
- Nehmen Sie nicht am SEPA-Verfahren teil, bitten wir Sie höflich um Überweisung bis zum Fälligkeitstag.

Tipp: Ein Dauerauftrag bei Ihrer Bank sorgt dafür, dass Ihre Rate immer pünktlich beglichen wird. Gerne senden wir Ihnen alternativ ein SEPA-Lastschriftmandat zu.

Bei Fragen sind wir jederzeit gerne für Sie da.

Mit freundlichen Grüßen
Ihr Team von Alix Lasers ®
service@alix-lasers.com`;
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

  let userToken: string | null = null;
  if (!isCron) {
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userToken = authHeader.slice(7);
    const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!who.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const leadDays = Number(body.lead_days ?? LEAD_DAYS);
  const dryRun = body.dry_run === true;

  const target = new Date();
  target.setUTCDate(target.getUTCDate() + leadDays);
  const dueDate = target.toISOString().slice(0, 10);

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

  const profRes = await rest(
    `zoho_recurring_profiles?select=id,zoho_recurring_invoice_id,source_system,customer_name,company_name,email,reference_number,recurrence_name,next_invoice_date,total,currency,status&next_invoice_date=eq.${dueDate}&status=eq.active&email=not.is.null`,
  );
  if (!profRes.ok) {
    const t = await profRes.text();
    return new Response(JSON.stringify({ error: t }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const profiles = (await profRes.json()) as any[];

  // Bereits versendete Vorankündigungen für dieses Datum ermitteln
  const sentRes = await rest(`recurring_prenotifications?select=zoho_recurring_invoice_id,profile_id&due_date=eq.${dueDate}&status=eq.sent`);
  const sent = sentRes.ok ? ((await sentRes.json()) as any[]) : [];
  const sentKeys = new Set(sent.map((s) => s.zoho_recurring_invoice_id ?? s.profile_id));

  const results: any[] = [];
  let sentCount = 0, skipped = 0, failed = 0;

  for (const p of profiles) {
    const key = p.zoho_recurring_invoice_id ?? p.id;
    const email = String(p.email ?? "").trim();
    if (!email.includes("@")) { skipped++; continue; }
    if (sentKeys.has(key)) { skipped++; continue; }

    const name = p.company_name || p.customer_name || "Kundin / Kunde";
    const payload = {
      name,
      due: dueDate,
      amount: p.total != null ? Number(p.total) : null,
      currency: p.currency || "EUR",
      reference: p.reference_number || p.recurrence_name || null,
    };

    if (dryRun) { results.push({ email, name, preview: true }); continue; }

    let ok = false, error: string | null = null;
    try {
      const mail = await fetch(`${supabaseUrl}/functions/v1/send-invoice-mail`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
        body: JSON.stringify({
          to_email: email,
          to_name: name,
          subject: `Ihre nächste Rate wird am ${fmtDate(dueDate)} fällig`,
          body_text: buildText(payload),
          body_html: buildHtml(payload),
          bcc: [BCC],
          invoice_number: `prenotif-${key}-${dueDate}`,
        }),
      });
      const txt = await mail.text();
      ok = mail.ok;
      if (!ok) error = `${mail.status}: ${txt.slice(0, 300)}`;
    } catch (e) {
      error = (e as Error).message;
    }

    await rest("recurring_prenotifications?on_conflict=", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        profile_id: p.id,
        zoho_recurring_invoice_id: p.zoho_recurring_invoice_id,
        source_system: p.source_system,
        customer_name: name,
        email,
        due_date: dueDate,
        amount: payload.amount,
        currency: payload.currency,
        status: ok ? "sent" : "failed",
        error,
      }),
    }).catch(() => {});

    if (ok) sentCount++; else failed++;
    results.push({ email, name, ok, error });
  }

  return new Response(
    JSON.stringify({ success: true, due_date: dueDate, lead_days: leadDays, candidates: profiles.length, sent: sentCount, skipped, failed, results: results.slice(0, 50) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
