import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ZOHO_TOKEN_URL = "https://accounts.zoho.eu/oauth/v2/token";
const ZOHO_API = "https://www.zohoapis.eu/books/v3/invoices";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Auth check: only admins / finance
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", user.id);
    const names = (roleRows ?? []).map((r: any) => r.roles?.name);
    const allowed = names.includes("Admin") || names.includes("Super Admin") || names.includes("Finance");
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const refreshToken = (Deno.env.get("ZOHO_EU_1_REFRESH_TOKEN") ?? "").trim();
    const clientId = (Deno.env.get("ZOHO_EU_1_CLIENT_ID") ?? "").trim();
    const clientSecret = (Deno.env.get("ZOHO_EU_1_CLIENT_SECRET") ?? "").trim();
    const orgId = (Deno.env.get("ZOHO_EU_1_ORGANIZATION_ID") ?? "").trim();

    if (!refreshToken || !clientId || !clientSecret || !orgId) {
      return json({ error: "Zoho-Konfiguration unvollständig (Secrets fehlen)" }, 500);
    }

    // 1) Access Token holen
    const tokenRes = await fetch(ZOHO_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData?.access_token;
    if (!accessToken) {
      return json({ error: "Zoho Token-Fehler", details: tokenData }, 502);
    }

    // 2) Unpaid Rechnungen holen (alle Seiten, mit Limit)
    let page = 1;
    let hasMore = true;
    const all: any[] = [];
    const startedAt = Date.now();
    const SOFT_DEADLINE_MS = 50_000;

    while (hasMore && page <= 20) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) break;
      const url = `${ZOHO_API}?organization_id=${orgId}&status=unpaid&page=${page}&per_page=200`;
      const r = await fetch(url, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      });
      if (!r.ok) {
        const t = await r.text();
        return json({ error: `Zoho API-Fehler (Seite ${page})`, details: t.substring(0, 500) }, 502);
      }
      const d = await r.json();
      const list: any[] = d.invoices ?? [];
      all.push(...list);
      hasMore = d.page_context?.has_more_page === true;
      page++;
    }

    // 3) Upsert in zoho_unpaid_invoices via invoice_id
    let imported = 0, updated = 0, failed = 0;
    for (const inv of all) {
      try {
        const invoiceId = String(inv.invoice_id);
        const payload = {
          invoice_id: invoiceId,
          invoice_number: inv.invoice_number ?? null,
          customer_name: inv.customer_name ?? null,
          invoice_date: inv.date ?? null,
          due_date: inv.due_date ?? null,
          total: Number(inv.total ?? 0),
          balance: Number(inv.balance ?? 0),
          status: inv.status ?? null,
          currency_code: inv.currency_code ?? null,
          raw: inv,
          synced_at: new Date().toISOString(),
        };

        const { data: existing } = await admin
          .from("zoho_unpaid_invoices")
          .select("id")
          .eq("invoice_id", invoiceId)
          .maybeSingle();

        if (existing) {
          const { error } = await admin
            .from("zoho_unpaid_invoices")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const { error } = await admin.from("zoho_unpaid_invoices").insert(payload);
          if (error) throw error;
          imported++;
        }
      } catch (e: any) {
        console.error("Upsert failed:", e?.message);
        failed++;
      }
    }

    return json({
      success: true,
      total: all.length,
      imported,
      updated,
      failed,
      pages: page - 1,
      has_more: hasMore,
    });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? "Unknown error" }, 500);
  }
});
