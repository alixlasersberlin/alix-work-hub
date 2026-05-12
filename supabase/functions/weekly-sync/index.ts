import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// WEEKLY orchestrator: imports last 7 days of customers, then last 7 days of orders.
// Uses existing scheduled-customer-sync and scheduled-order-sync functions which
// perform upsert/dedup against external_customer_id / external_order_id (per source_system).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const apiKeyHeader = req.headers.get("apikey") ?? "";
    const isServiceCall =
      authHeader === `Bearer ${serviceRoleKey}` || apiKeyHeader === serviceRoleKey;

    let userId: string | null = null;

    if (!isServiceCall) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await userClient.auth.getUser(token);
      const user = data?.user;
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminCheck = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: roles } = await adminCheck
        .from("user_roles")
        .select("roles!inner(name)")
        .eq("user_id", user.id);
      const roleNames = (roles ?? []).map((r: any) => r.roles?.name).filter(Boolean);
      if (!roleNames.includes("Admin") && !roleNames.includes("Super Admin")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      /* empty body OK */
    }

    const sourceSystem = (body.source_system as string) ?? "zoho_eu_1";
    const daysBack = Math.max(1, Math.min(90, Number(body.days_back ?? 7) || 7));

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callChild = async (functionName: string) => {
      const url = `${supabaseUrl}/functions/v1/${functionName}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source_system: sourceSystem, days_back: daysBack }),
      });
      const text = await res.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
      if (!res.ok) {
        throw new Error(
          `${functionName} failed (${res.status}): ${typeof parsed?.error === "string" ? parsed.error : text.slice(0, 200)}`,
        );
      }
      return parsed;
    };

    console.log(`[weekly-sync] Starting WEEKLY for ${sourceSystem}, days_back=${daysBack}`);

    // 1) Customers first (orders depend on local customer rows)
    const customersResult = await callChild("scheduled-customer-sync");
    console.log(`[weekly-sync] Customers done:`, JSON.stringify(customersResult));

    // 2) Orders second
    const ordersResult = await callChild("scheduled-order-sync");
    console.log(`[weekly-sync] Orders done:`, JSON.stringify(ordersResult));

    const durationMs = Date.now() - startTime;

    const summary = {
      success: true,
      job_name: "WEEKLY",
      source_system: sourceSystem,
      days_back: daysBack,
      customers: {
        fetched: customersResult.total_fetched ?? 0,
        imported: customersResult.imported ?? 0,
        updated: customersResult.updated ?? 0,
        skipped: customersResult.skipped ?? 0,
        failed: customersResult.failed ?? 0,
      },
      orders: {
        fetched: ordersResult.total_fetched ?? 0,
        imported: ordersResult.imported ?? 0,
        updated: ordersResult.updated ?? 0,
        skipped: ordersResult.skipped ?? 0,
        failed: ordersResult.failed ?? 0,
      },
      duration_ms: durationMs,
    };

    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "weekly_sync",
      module: "import_management",
      details: summary,
    });

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[weekly-sync] Fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
