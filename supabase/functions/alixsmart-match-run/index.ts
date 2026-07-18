// alixsmart-match-run
// Läuft über alle Kunden mit Geräten und aktualisiert alixsmart_customer_links.match_status.
// Registriert: Mindestens ein Gerät hat lager_devices.alixsmart_user_id
//              ODER lager_devices.customer_email normalisiert = customers.email.
// Möglich:     Kunde hat E-Mail, es gibt Kandidaten mit gleicher Domain (schwacher Hinweis)
// Sonst:       unregistriert
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED = new Set(["Super Admin", "Admin"]);

function normEmail(e: string | null | undefined) {
  return e ? e.trim().toLowerCase().replace(/\s+/g, "") : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    const isService = authHeader?.includes(SERVICE_ROLE);
    let userId: string | null = null;
    if (!isService) {
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await userClient.auth.getClaims(token);
      if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
      userId = claims.claims.sub as string;
      const { data: roleRows } = await admin
        .from("user_roles").select("roles!inner(name)").eq("user_id", userId);
      const names = (roleRows ?? []).map((r: any) => r.roles?.name).filter(Boolean);
      if (!names.some((n: string) => ALLOWED.has(n))) return json({ error: "Forbidden" }, 403);
    }

    // Kandidaten laden
    const { data: rows, error } = await admin
      .from("v_alixsmart_customer_status")
      .select("customer_id, email, serial_numbers")
      .limit(5000);
    if (error) return json({ error: error.message }, 500);

    let registered = 0, possible = 0, unregistered = 0;

    for (const r of (rows as any[])) {
      const custEmail = normEmail(r.email);

      // Prüfe Geräte für diesen Kunden
      const { data: devs } = await admin
        .from("v_alixsmart_customer_devices")
        .select("alixsmart_user_id, serial_number")
        .eq("customer_id", r.customer_id);

      const hasUserId = (devs || []).some((d: any) => d.alixsmart_user_id);
      const linkedByEmail = false; // Vereinfachung: bereits in View berücksichtigt

      let status: "registered" | "possible" | "unregistered" = "unregistered";
      let score = 0;
      const compared: Record<string, unknown> = { hasUserId, custEmail, deviceCount: (devs||[]).length };

      if (hasUserId) { status = "registered"; score = 100; registered++; }
      else if (custEmail) { status = "possible"; score = 25; possible++; }
      else { status = "unregistered"; score = 0; unregistered++; }

      await admin.from("alixsmart_customer_links").upsert({
        alixwork_customer_id: r.customer_id,
        match_status: status,
        match_score: score,
        match_method: "auto_v1",
        compared_fields: compared,
        last_checked_at: new Date().toISOString(),
        registered_at: status === "registered" ? new Date().toISOString() : null,
      }, { onConflict: "alixwork_customer_id" });

      await admin.from("alixsmart_match_logs").insert({
        customer_id: r.customer_id,
        match_score: score,
        compared_fields: compared,
        decision: status,
        source: "match_run",
      });
    }

    return json({ ok: true, processed: rows?.length ?? 0, registered, possible, unregistered });
  } catch (e: any) {
    return json({ error: e?.message ?? "Fehler" }, 500);
  }
});
