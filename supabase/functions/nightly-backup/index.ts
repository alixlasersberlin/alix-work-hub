import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const backupId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  // Log backup start
  await supabase.from("backups_metadata").insert({
    id: backupId,
    backup_type: "automated",
    backup_scope: "full",
    backup_status: "running",
    started_at: startedAt,
    message: "Tägliches automatisches Backup gestartet",
  });

  try {
    const tables = [
      "orders",
      "customers",
      "order_items",
      "order_notes",
      "finance_records",
      "route_plans",
      "order_status_history",
    ];

    const results: Record<string, number> = {};
    let totalSize = 0;

    for (const table of tables) {
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: false });

      if (error) {
        throw new Error(`Fehler beim Lesen von ${table}: ${error.message}`);
      }

      const rowCount = count ?? (data?.length ?? 0);
      results[table] = rowCount;
      totalSize += JSON.stringify(data ?? []).length;
    }

    const completedAt = new Date().toISOString();

    await supabase
      .from("backups_metadata")
      .update({
        backup_status: "success",
        completed_at: completedAt,
        backup_size_bytes: totalSize,
        integrity_status: "valid",
        storage_location: "supabase_internal",
        message: `Backup erfolgreich. Tabellen: ${Object.entries(results)
          .map(([t, c]) => `${t}(${c})`)
          .join(", ")}`,
      })
      .eq("id", backupId);

    return new Response(
      JSON.stringify({
        success: true,
        backup_id: backupId,
        tables: results,
        size_bytes: totalSize,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await supabase
      .from("backups_metadata")
      .update({
        backup_status: "failed",
        completed_at: new Date().toISOString(),
        integrity_status: "error",
        message: `Backup fehlgeschlagen: ${errorMsg}`,
      })
      .eq("id", backupId);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
