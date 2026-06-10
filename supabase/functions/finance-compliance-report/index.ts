// Phase 11: Compliance / Audit Report Export (CSV)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? new Date(Date.now() - 90 * 86400_000).toISOString();
    const to = url.searchParams.get("to") ?? new Date().toISOString();

    const modules = [
      "finance_incoming_invoices", "finance_approvals", "finance_sepa_runs",
      "finance_reminders", "finance_transactions", "finance_year_end_runs",
      "finance_bank_statements", "finance_automations",
    ];

    const { data: logs } = await supabase
      .from("audit_logs")
      .select("created_at, user_id, action, module, record_id, details")
      .in("module", modules)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .limit(10000);

    const header = "timestamp;user_id;action;module;record_id;details\n";
    const csv = header + (logs ?? []).map((r: any) =>
      [r.created_at, r.user_id ?? "", r.action, r.module, r.record_id ?? "",
       JSON.stringify(r.details ?? {}).replace(/[\r\n;]/g, " ")].join(";")
    ).join("\n");

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="compliance-${from.slice(0,10)}_${to.slice(0,10)}.csv"`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
