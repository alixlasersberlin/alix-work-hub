// ALIX – Wiederkehrende Zahler: erzeugt Zahlungserinnerungen X Kalendertage vor Fälligkeit
// und legt sie als "pending" im Sammelversand ab. Idempotent über dedupe_key.
// Cron-tauglich (CRON_SECRET / Service-Role) und manuell aus dem UI aufrufbar.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isSepaText = (s: string) => /\bsepa\b|lastschrift/i.test(s);

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

  if (!isCron) {
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!who.ok) return json({ error: "Unauthorized" }, 401);
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

  // Einstellungen laden
  const setRes = await rest("rz_reminder_settings?select=*&id=eq.true");
  const settings = setRes.ok ? ((await setRes.json())[0] ?? {}) : {};
  const leadList: number[] = Array.isArray(body.lead_days)
    ? (body.lead_days as number[])
    : [Number(body.lead_days ?? settings.lead_days ?? 3), ...((settings.extra_lead_days ?? []) as number[])];
  const leads = Array.from(new Set(leadList.map(Number).filter((n) => Number.isFinite(n) && n >= 0)));

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sendDate = iso(today);

  let created = 0, skipped = 0, candidates = 0;
  const rows: Record<string, unknown>[] = [];

  for (const lead of leads) {
    const t = new Date(today);
    t.setUTCDate(t.getUTCDate() + lead);
    const dueDate = iso(t);

    const profRes = await rest(
      `zoho_recurring_profiles?select=id,zoho_recurring_invoice_id,source_system,customer_id,customer_name,company_name,email,reference_number,recurrence_name,recurrence_frequency,repeat_every,next_invoice_date,last_sent_date,total,currency,status&next_invoice_date=eq.${dueDate}&status=eq.active`,
    );
    if (!profRes.ok) return json({ error: await profRes.text() }, 502);
    const profiles = (await profRes.json()) as any[];
    candidates += profiles.length;
    if (profiles.length === 0) continue;

    const extIds = Array.from(new Set(profiles.map((p) => p.customer_id).filter(Boolean)));
    const custMap = new Map<string, any>();
    if (extIds.length) {
      const cRes = await rest(
        `customers?select=id,external_customer_id,company_name,contact_name,email&external_customer_id=in.(${extIds.map((x) => `"${x}"`).join(",")})`,
      );
      if (cRes.ok) for (const c of (await cRes.json()) as any[]) custMap.set(String(c.external_customer_id), c);
    }

    // Aktive SEPA-Mandate der betroffenen Kunden
    const custUuids = Array.from(custMap.values()).map((c) => c.id);
    const sepaSet = new Set<string>();
    if (custUuids.length) {
      const mRes = await rest(
        `finance_sepa_mandates?select=customer_id,status&customer_id=in.(${custUuids.join(",")})`,
      );
      if (mRes.ok) {
        for (const m of (await mRes.json()) as any[]) {
          if (!m.status || /aktiv|active/i.test(String(m.status))) sepaSet.add(String(m.customer_id));
        }
      }
      const bRes = await rest(`customer_bank_details?select=customer_id,iban&customer_id=in.(${custUuids.join(",")})`);
      if (bRes.ok) for (const b of (await bRes.json()) as any[]) if (b.iban) sepaSet.add(String(b.customer_id));
    }

    for (const p of profiles) {
      const cust = p.customer_id ? custMap.get(String(p.customer_id)) : null;
      const email = String(p.email ?? cust?.email ?? "").trim();
      const name = p.company_name || p.customer_name || cust?.company_name || cust?.contact_name || "Kundin / Kunde";
      const nameParts = String(p.customer_name || cust?.contact_name || "").trim().split(/\s+/);
      const sepa =
        (cust?.id && sepaSet.has(String(cust.id))) ||
        isSepaText(`${p.recurrence_name ?? ""} ${p.reference_number ?? ""}`);

      rows.push({
        dedupe_key: `${p.zoho_recurring_invoice_id ?? p.id}|${dueDate}`,
        profile_id: p.id,
        zoho_recurring_invoice_id: p.zoho_recurring_invoice_id,
        source_system: p.source_system,
        customer_id: p.customer_id,
        customer_number: p.customer_id ?? null,
        customer_name: name,
        first_name: nameParts.length > 1 ? nameParts[0] : null,
        last_name: nameParts.length > 1 ? nameParts[nameParts.length - 1] : (nameParts[0] || null),
        contract_number: p.reference_number || p.recurrence_name || null,
        invoice_number: p.reference_number || null,
        payment_method: sepa ? "sepa" : "self",
        frequency: p.repeat_every && p.repeat_every > 1
          ? `${p.repeat_every}× ${p.recurrence_frequency ?? ""}`.trim()
          : (p.recurrence_frequency ?? null),
        due_date: dueDate,
        send_date: sendDate,
        last_payment_date: p.last_sent_date ?? null,
        amount: p.total != null ? Number(p.total) : null,
        currency: p.currency || "EUR",
        email: email || null,
        status: "pending",
      });
    }
  }

  if (rows.length) {
    const insRes = await rest("rz_reminders?on_conflict=dedupe_key", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(rows),
    });
    if (!insRes.ok) return json({ error: await insRes.text() }, 502);
    const inserted = (await insRes.json()) as any[];
    created = inserted.length;
    skipped = rows.length - created;
  }

  return json({ success: true, send_date: sendDate, lead_days: leads, candidates, created, skipped });
});
