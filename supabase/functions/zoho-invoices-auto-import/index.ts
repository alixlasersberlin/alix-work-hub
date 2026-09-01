import "../_shared/global-bcc.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  /** Quellsysteme, standardmässig beide Mandanten */
  sources?: string[];
  date_from?: string;
  per_page?: number;
  max_pages?: number;
  /** 'cron' | 'manual' */
  trigger_type?: string;
  /** true = nur Test-Mail mit Beispielinhalt senden, kein Import */
  test_email?: boolean;
  /** true = nur zählen, nichts schreiben, keine Mail */
  dry_run?: boolean;
  /** Empfänger überschreiben (optional) */
  to?: string;
  cc?: string;
};

const MAIL_TO = "rde@alix-lasers.com";
const MAIL_CC = "k.trinh@alix-operation.de";
const MAIL_BCC = "service@alix-lasers.com";
const MAIL_FROM = "Alix Lasers ® <noreply@alixlasers.ai>";

const CH_BRANCH_ID = "598077000000065075";
const CH_MARKERS = ["alix lasers ® schweiz", "alix lasers (r) schweiz", "alix lasers schweiz"];

/** Felder, die gegen den Bestand verglichen werden (kein Überschreiben, nur Meldung). */
const DIFF_FIELDS = [
  "invoice_number", "reference_number", "customer_name", "city",
  "invoice_date", "due_date", "currency", "total", "balance",
  "status", "payment_status", "last_payment_date", "accounting_region",
] as const;

const FIELD_LABELS: Record<string, string> = {
  invoice_number: "Rechnungsnr.", reference_number: "Referenz", customer_name: "Kunde",
  city: "Ort", invoice_date: "Datum", due_date: "Fällig", currency: "Währung",
  total: "Betrag", balance: "Saldo", status: "Status", payment_status: "Zahlungsstatus",
  last_payment_date: "Letzte Zahlung", accounting_region: "Buchungskreis",
};

const SOURCE_LABELS: Record<string, string> = {
  zoho_eu_1: "Alix Deutschland 🇩🇪",
  zoho_eu_2: "Alix Austria 🇦🇹",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function detectInvoiceRegion(inv: any): "EU" | "CH" {
  if (inv?.branch_id && String(inv.branch_id) === CH_BRANCH_ID) return "CH";
  if ((inv?.currency_code ?? "").toString().toUpperCase() === "CHF") return "CH";
  const hay = JSON.stringify(inv ?? {}).toLowerCase();
  if (CH_MARKERS.some((m) => hay.includes(m))) return "CH";
  const country = (inv?.billing_address?.country ?? inv?.billing_address?.country_code ?? "").toString().toLowerCase();
  if (country === "ch" || country.includes("schweiz") || country.includes("switzerland")) return "CH";
  return "EU";
}

function payStatusFromInvoice(inv: any): string {
  const s = (inv.status ?? "").toLowerCase();
  if (s === "paid") return "Bezahlt";
  if (s === "partially_paid") return "Teilweise bezahlt";
  if (s === "overdue") return "Überfällig";
  if (s === "sent" || s === "viewed") return "Offen";
  if (s === "draft") return "Entwurf";
  if (s === "void") return "Storniert";
  return inv.status ?? "Unbekannt";
}

function getZohoConfig(source: string) {
  const map: Record<string, { prefix: string; accountsBase: string; apiBase: string }> = {
    zoho_eu_1: { prefix: "ZOHO_EU_1", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_eu_2: { prefix: "ZOHO_EU_2", accountsBase: "https://accounts.zoho.eu", apiBase: "https://www.zohoapis.eu/books/v3" },
    zoho_us_1: { prefix: "ZOHO_US_1", accountsBase: "https://accounts.zoho.com", apiBase: "https://www.zohoapis.com/books/v3" },
  };
  const c = map[source];
  if (!c) return null;
  const env = (k: string) => (Deno.env.get(k) ?? "").trim();
  return {
    clientId: source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_ID") : env(`${c.prefix}_CLIENT_ID`),
    clientSecret: source === "zoho_eu_2" ? env("ZOHO_EU_1_CLIENT_SECRET") : env(`${c.prefix}_CLIENT_SECRET`),
    refreshToken: source === "zoho_eu_2" ? env("ZOHO_EU_1_REFRESH_TOKEN") : env(`${c.prefix}_REFRESH_TOKEN`),
    organizationId: env(`${c.prefix}_ORGANIZATION_ID`),
    accountsBaseUrl: c.accountsBase,
    booksApiBaseUrl: c.apiBase,
  };
}

async function getAccessToken(cfg: NonNullable<ReturnType<typeof getZohoConfig>>) {
  const res = await fetch(`${cfg.accountsBaseUrl}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: cfg.refreshToken,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data?.access_token) throw new Error(`Zoho token error: ${JSON.stringify(data).slice(0, 300)}`);
  return data.access_token as string;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (typeof a === "number" || typeof b === "number") {
    const na = Number(a ?? 0), nb = Number(b ?? 0);
    if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 0.005;
  }
  return String(a ?? "") === String(b ?? "");
}

type ChangeEntry = {
  kind: "new" | "changed";
  source_system: string;
  invoice_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  total: number | null;
  currency: string | null;
  diffs: { field: string; old: unknown; new: unknown }[];
};

function fmtVal(v: unknown): string {
  if (v == null || v === "") return "–";
  return String(v);
}

function buildEmailHtml(opts: {
  isTest: boolean;
  triggerType: string;
  startedAt: string;
  newCount: number;
  changedCount: number;
  unchanged: number;
  failed: number;
  processed: number;
  changes: ChangeEntry[];
}): string {
  const rows = opts.changes.slice(0, 300).map((c) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">
        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;background:${c.kind === "new" ? "#e6f7ee;color:#0a7c42" : "#fff5e0;color:#a06a00"};">
          ${c.kind === "new" ? "NEU" : "GEÄNDERT"}
        </span>
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:600;">${fmtVal(c.invoice_number)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${fmtVal(c.customer_name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${fmtVal(c.invoice_date)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${fmtVal(c.total)} ${fmtVal(c.currency)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;color:#444;">
        ${c.diffs.length === 0 ? (c.kind === "new" ? "neu importiert" : "–") : c.diffs.map((d) =>
          `${FIELD_LABELS[d.field] ?? d.field}: <s style="color:#999">${fmtVal(d.old)}</s> → <b>${fmtVal(d.new)}</b>`).join("<br/>")}
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:12px;">${SOURCE_LABELS[c.source_system] ?? c.source_system}</td>
    </tr>`).join("");

  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111;">
  <div style="max-width:900px;margin:0 auto;">
    <h2 style="margin:0 0 4px;">Zoho Rechnungs-Auto-Import${opts.isTest ? " – TESTMAIL" : ""}</h2>
    <p style="margin:0 0 16px;color:#555;font-size:13px;">
      Lauf: ${opts.startedAt} · Auslöser: ${opts.triggerType === "manual" ? "manuell" : "automatisch"}
      ${opts.isTest ? "<br/><b>Dies ist eine Testmail mit Beispieldaten – es wurden keine Daten verändert.</b>" : ""}
    </p>
    <table style="border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:8px 14px;border:1px solid #eee;">Neu importiert<br/><b style="font-size:18px;color:#0a7c42;">${opts.newCount}</b></td>
        <td style="padding:8px 14px;border:1px solid #eee;">Veränderungen (nicht überschrieben)<br/><b style="font-size:18px;color:#a06a00;">${opts.changedCount}</b></td>
        <td style="padding:8px 14px;border:1px solid #eee;">Unverändert<br/><b style="font-size:18px;">${opts.unchanged}</b></td>
        <td style="padding:8px 14px;border:1px solid #eee;">Fehler<br/><b style="font-size:18px;">${opts.failed}</b></td>
        <td style="padding:8px 14px;border:1px solid #eee;">Geprüft<br/><b style="font-size:18px;">${opts.processed}</b></td>
      </tr>
    </table>
    ${opts.changes.length === 0
      ? `<p style="color:#555;">Keine Veränderungen festgestellt.</p>`
      : `<table style="border-collapse:collapse;width:100%;font-size:13px;">
          <thead><tr style="background:#f6f6f6;">
            <th style="text-align:left;padding:6px 8px;">Art</th>
            <th style="text-align:left;padding:6px 8px;">Rechnung</th>
            <th style="text-align:left;padding:6px 8px;">Kunde</th>
            <th style="text-align:left;padding:6px 8px;">Datum</th>
            <th style="text-align:right;padding:6px 8px;">Betrag</th>
            <th style="text-align:left;padding:6px 8px;">Veränderung</th>
            <th style="text-align:left;padding:6px 8px;">Mandant</th>
          </tr></thead><tbody>${rows}</tbody></table>
        ${opts.changes.length > 300 ? `<p style="color:#777;font-size:12px;">… ${opts.changes.length - 300} weitere Einträge (siehe AlixWork · Import · AUTO IMPORT)</p>` : ""}`}
    <p style="margin-top:20px;color:#888;font-size:12px;">
      Bestehende Rechnungen werden nicht überschrieben – Abweichungen werden ausschliesslich gemeldet.<br/>
      AlixWork · Buchhaltung · Rechnungen
    </p>
  </div></body></html>`;
}

async function sendMail(subject: string, html: string, to: string, cc: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!key || !lovableKey) throw new Error("Mail-Konfiguration fehlt (RESEND_API_KEY / LOVABLE_API_KEY)");
  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], cc: [cc], bcc: [MAIL_BCC], subject, html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ${res.status}: ${t.slice(0, 300)}`);
  }
  return await res.json();
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let runId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const isService = authHeader === `Bearer ${serviceKey}`;
    let userId: string | null = null;

    if (!isService) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: { user } } = authHeader.startsWith("Bearer ")
        ? await userClient.auth.getUser()
        : { data: { user: null } } as any;
      if (user) {
        // Angemeldeter Aufruf (manueller Start): nur Admin / Super Admin
        userId = user.id;
        const { data: roleRows } = await admin.from("user_roles").select("roles!inner(name)").eq("user_id", user.id);
        const names = (roleRows ?? []).map((r: any) => r.roles?.name);
        if (!names.includes("Admin") && !names.includes("Super Admin")) return json({ error: "Forbidden" }, 403);
      }
      // Ohne Benutzer-Session = geplanter Cron-Aufruf (pg_cron mit apikey), wie bei den übrigen Job-Funktionen
    }


    const body = (await req.json().catch(() => ({}))) as Payload;
    const triggerType = body.trigger_type ?? (isService ? "cron" : "manual");
    const to = body.to ?? MAIL_TO;
    const cc = body.cc ?? MAIL_CC;

    // ---- Testmail: Beispielinhalt, kein Import ----
    if (body.test_email) {
      const sample: ChangeEntry[] = [
        { kind: "new", source_system: "zoho_eu_1", invoice_number: "INV-10450", customer_name: "Beispiel Kosmetik GmbH", invoice_date: "2026-08-07", total: 1190, currency: "EUR", diffs: [] },
        { kind: "changed", source_system: "zoho_eu_1", invoice_number: "INV-10193", customer_name: "Buket Anani", invoice_date: "2026-06-14", total: 249, currency: "EUR", diffs: [{ field: "balance", old: 249, new: 0 }, { field: "payment_status", old: "Offen", new: "Bezahlt" }] },
        { kind: "changed", source_system: "zoho_eu_2", invoice_number: "INV-2201-AT", customer_name: "Alix Lasers GmbH – Graz", invoice_date: "2026-07-30", total: 3570, currency: "EUR", diffs: [{ field: "due_date", old: "2026-08-14", new: "2026-08-28" }] },
      ];
      const html = buildEmailHtml({
        isTest: true, triggerType, startedAt: new Date().toLocaleString("de-DE"),
        newCount: 1, changedCount: 2, unchanged: 0, failed: 0, processed: 3, changes: sample,
      });
      const sent = await sendMail("[TEST] Zoho Rechnungs-Auto-Import – Veränderungen", html, to, cc);
      return json({ success: true, test_email: true, to, cc, resend: sent });
    }

    const sources = (body.sources?.length ? body.sources : ["zoho_eu_1", "zoho_eu_2"]).filter((s) => !!getZohoConfig(s));
    const dateFrom = body.date_from ?? "2025-01-01";
    const perPage = Math.min(Math.max(body.per_page ?? 200, 1), 200);
    const maxPages = Math.min(Math.max(body.max_pages ?? 15, 1), 40);

    const dryRun = body.dry_run === true;
    const startedAt = new Date();
    if (!dryRun) {
      const { data: runRow } = await admin
        .from("zoho_auto_import_runs")
        .insert({ trigger_type: triggerType, status: "running", sources, created_by: userId })
        .select("id")
        .single();
      runId = runRow?.id ?? null;
    }


    let newCount = 0, changedCount = 0, unchanged = 0, failed = 0, processed = 0;
    const changes: ChangeEntry[] = [];
    const SOFT_DEADLINE_MS = 140_000;

    for (const sourceSystem of sources) {
      const cfg = getZohoConfig(sourceSystem)!;
      if (!cfg.refreshToken || !cfg.organizationId) continue;
      const token = await getAccessToken(cfg);
      const authH = { Authorization: `Zoho-oauthtoken ${token}` };

      let page = 1, hasMore = true;
      while (hasMore && page <= maxPages) {
        if (Date.now() - startedAt.getTime() > SOFT_DEADLINE_MS) { hasMore = false; break; }
        const url = `${cfg.booksApiBaseUrl}/invoices?organization_id=${cfg.organizationId}` +
          `&page=${page}&per_page=${perPage}&date_after=${dateFrom}` +
          `&filter_by=Status.All&sort_column=date&sort_order=A`;
        const r = await fetch(url, { headers: authH });
        if (!r.ok) { failed++; break; }
        const d = await r.json();
        const invoices: any[] = d.invoices ?? [];
        hasMore = d.page_context?.has_more_page === true;

        for (const inv of invoices) {
          processed++;
          try {
            const invId = String(inv.invoice_id);
            const region = detectInvoiceRegion(inv);
            const billing = inv.billing_address ?? null;
            const payload = {
              source_system: sourceSystem,
              zoho_invoice_id: invId,
              invoice_number: inv.invoice_number ?? null,
              reference_number: inv.reference_number ?? null,
              customer_name: inv.customer_name ?? null,
              customer_id: inv.customer_id?.toString() ?? null,
              city: billing?.city ?? inv.billing_city ?? null,
              billing_address: billing,
              invoice_date: inv.date ?? null,
              due_date: inv.due_date ?? null,
              currency: inv.currency_code ?? null,
              total: Number(inv.total ?? 0),
              balance: Number(inv.balance ?? 0),
              status: inv.status ?? null,
              payment_status: payStatusFromInvoice(inv),
              last_payment_date: inv.last_payment_date ?? null,
              raw_data: inv,
              accounting_region: region,
              synced_at: new Date().toISOString(),
            };

            const { data: existing } = await admin
              .from("zoho_invoices")
              .select(DIFF_FIELDS.join(", "))
              .eq("source_system", sourceSystem)
              .eq("zoho_invoice_id", invId)
              .maybeSingle();

            if (!existing) {
              // Zusätzlicher Schutz: gleiche Rechnungsnummer bereits vorhanden -> nicht doppelt anlegen
              if (payload.invoice_number) {
                const { data: dupNum } = await admin
                  .from("zoho_invoices").select("id")
                  .eq("source_system", sourceSystem)
                  .eq("invoice_number", payload.invoice_number)
                  .limit(1).maybeSingle();
                if (dupNum) { unchanged++; continue; }
              }
              if (!dryRun) {
                const { error: insErr } = await admin.from("zoho_invoices").insert(payload);
                if (insErr) throw insErr;
              }
              newCount++;
              changes.push({
                kind: "new", source_system: sourceSystem,
                invoice_number: payload.invoice_number, customer_name: payload.customer_name,
                invoice_date: payload.invoice_date, total: payload.total, currency: payload.currency, diffs: [],
              });
            } else {
              // KEIN Überschreiben – nur Abweichungen melden
              const diffs = DIFF_FIELDS
                .filter((f) => !sameValue((existing as any)[f], (payload as any)[f]))
                .map((f) => ({ field: f, old: (existing as any)[f], new: (payload as any)[f] }));
              if (diffs.length === 0) unchanged++;
              else {
                changedCount++;
                changes.push({
                  kind: "changed", source_system: sourceSystem,
                  invoice_number: payload.invoice_number, customer_name: payload.customer_name,
                  invoice_date: payload.invoice_date, total: payload.total, currency: payload.currency, diffs,
                });
              }
            }
          } catch (e: any) {
            console.error("auto-import invoice failed:", e?.message);
            failed++;
          }
        }
        page++;
      }
    }

    if (dryRun) {
      return json({ success: true, dry_run: true, sources, date_from: dateFrom, would_import: newCount, changed: changedCount, unchanged, failed, processed, preview: changes.slice(0, 100) });
    }

    // Benachrichtigung
    let emailSent = false, emailError: string | null = null;
    try {
      const html = buildEmailHtml({
        isTest: false, triggerType, startedAt: startedAt.toLocaleString("de-DE"),
        newCount, changedCount, unchanged, failed, processed, changes,
      });
      await sendMail(
        `Zoho Rechnungs-Auto-Import: ${newCount} neu · ${changedCount} Veränderungen`,
        html, to, cc,
      );
      emailSent = true;
    } catch (e: any) {
      emailError = e?.message ?? "Mailversand fehlgeschlagen";
      console.error("auto-import mail failed:", emailError);
    }

    if (runId) {
      await admin.from("zoho_auto_import_runs").update({
        status: "completed",
        finished_at: new Date().toISOString(),
        new_count: newCount,
        changed_count: changedCount,
        unchanged_count: unchanged,
        failed_count: failed,
        processed_count: processed,
        changes: changes.slice(0, 1000),
        email_sent: emailSent,
        email_error: emailError,
      }).eq("id", runId);
    }

    return json({
      success: true, run_id: runId, trigger_type: triggerType,
      new_count: newCount, changed_count: changedCount, unchanged_count: unchanged,
      failed_count: failed, processed_count: processed,
      email_sent: emailSent, email_error: emailError,
      changes: changes.slice(0, 300),
    });
  } catch (e: any) {
    console.error(e);
    if (runId) {
      await admin.from("zoho_auto_import_runs").update({
        status: "failed", finished_at: new Date().toISOString(), error_message: e?.message ?? "Unbekannter Fehler",
      }).eq("id", runId);
    }
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});