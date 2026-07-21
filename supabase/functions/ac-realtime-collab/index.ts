// ALIX CONNECT Phase 43 — Realtime Collaboration context aggregator
// Actions: handover_context { customer_id?, order_id? } -> 360° kompaktes JSON
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json(401, { error: "unauthorized" });

  const { data: isAdmin } = await userClient.rpc("has_role", { check_role: "Admin" });
  const { data: isSuper } = await userClient.rpc("has_role", { check_role: "Super Admin" });
  if (!isAdmin && !isSuper) return json(403, { error: "forbidden" });

  const body = await req.json().catch(() => ({}));
  const action = body?.action ?? "handover_context";
  const svc = createClient(url, service);

  if (action === "handover_context") {
    const customerId = body?.customer_id ?? null;
    const orderId = body?.order_id ?? null;

    const [customer, orders, tickets, notes] = await Promise.all([
      customerId ? svc.from("customers").select("id, customer_name, email, phone, city, country").eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
      customerId ? svc.from("orders").select("id, order_number, status, created_at, total_amount, currency_code").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
      customerId ? svc.from("tickets").select("id, subject, status, priority, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
      orderId ? svc.from("orders").select("id, order_number, status, notes, total_amount").eq("id", orderId).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    return json(200, {
      generated_at: new Date().toISOString(),
      customer: (customer as any)?.data ?? null,
      recent_orders: (orders as any)?.data ?? [],
      recent_tickets: (tickets as any)?.data ?? [],
      focus_order: (notes as any)?.data ?? null,
    });
  }

  return json(400, { error: "unknown_action" });
});
