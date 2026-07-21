// ALIX CONNECT Phase 45 — Revenue Attribution
// End-to-End Touchpoint-Tracking von First-Touch bis Abschluss
// Actions:
//  - report { from?, to?, model?: 'first'|'last'|'linear' } -> aggregierte Attribution
//  - order_touchpoints { order_id } -> Timeline aller Touchpoints eines Auftrags
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

type Touch = { at: string; channel: string; source?: string | null; ref?: string | null; label?: string | null };

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

  const svc = createClient(url, service);
  const body = await req.json().catch(() => ({}));
  const action = body?.action ?? "report";

  const collectTouches = async (customer_id: string | null, email: string | null): Promise<Touch[]> => {
    const touches: Touch[] = [];
    if (customer_id) {
      const [leads, tickets, calls] = await Promise.all([
        svc.from("sales_leads").select("id, source, created_at").eq("customer_id", customer_id).limit(200),
        svc.from("tickets").select("id, channel, subject, created_at").eq("customer_id", customer_id).limit(200),
        svc.from("call_journal").select("id, direction, created_at").eq("customer_id", customer_id).limit(200).then(r => r).catch(() => ({ data: [] as any[] })),
      ]);
      for (const l of leads.data ?? []) touches.push({ at: l.created_at, channel: "lead", source: l.source, ref: l.id, label: "Lead erstellt" });
      for (const t of tickets.data ?? []) touches.push({ at: t.created_at, channel: t.channel ?? "ticket", ref: t.id, label: t.subject });
      for (const c of (calls as any).data ?? []) touches.push({ at: c.created_at, channel: "call", source: c.direction, ref: c.id, label: "Anruf" });
    }
    if (email) {
      const em = await svc.from("email_messages").select("id, subject, direction, created_at").ilike("from_address", email).limit(200).then(r => r).catch(() => ({ data: [] as any[] }));
      for (const m of (em as any).data ?? []) touches.push({ at: m.created_at, channel: "email", source: m.direction, ref: m.id, label: m.subject });
    }
    return touches.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  };

  if (action === "order_touchpoints") {
    const orderId = String(body?.order_id ?? "");
    if (!orderId) return json(400, { error: "order_id_required" });
    const { data: order } = await svc.from("orders").select("id, order_number, customer_id, customer_name, customer_email, total, created_at").eq("id", orderId).maybeSingle();
    if (!order) return json(404, { error: "order_not_found" });
    const touches = await collectTouches(order.customer_id, order.customer_email);
    return json(200, { order, touches });
  }

  // report
  const to = body?.to ? new Date(body.to) : new Date();
  const from = body?.from ? new Date(body.from) : new Date(to.getTime() - 90 * 86400_000);
  const model = (body?.model ?? "linear") as "first" | "last" | "linear";

  const { data: orders } = await svc
    .from("orders")
    .select("id, order_number, customer_id, customer_email, total, created_at")
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .not("total", "is", null)
    .limit(500);

  const perChannel: Record<string, { revenue: number; orders: number }> = {};
  const perSource: Record<string, { revenue: number; orders: number }> = {};
  let attributed = 0;
  let untracked = 0;

  for (const o of orders ?? []) {
    const rev = Number(o.total ?? 0);
    const touches = (await collectTouches(o.customer_id, o.customer_email)).filter(t => new Date(t.at) <= new Date(o.created_at));
    if (touches.length === 0) { untracked += rev; continue; }
    attributed += rev;
    let contribs: Array<{ channel: string; source?: string | null; weight: number }> = [];
    if (model === "first") contribs = [{ channel: touches[0].channel, source: touches[0].source, weight: 1 }];
    else if (model === "last") contribs = [{ channel: touches[touches.length - 1].channel, source: touches[touches.length - 1].source, weight: 1 }];
    else contribs = touches.map(t => ({ channel: t.channel, source: t.source, weight: 1 / touches.length }));
    for (const c of contribs) {
      perChannel[c.channel] ??= { revenue: 0, orders: 0 };
      perChannel[c.channel].revenue += rev * c.weight;
      perChannel[c.channel].orders += c.weight;
      const s = c.source || "—";
      perSource[s] ??= { revenue: 0, orders: 0 };
      perSource[s].revenue += rev * c.weight;
      perSource[s].orders += c.weight;
    }
  }

  return json(200, {
    generated_at: new Date().toISOString(),
    range: { from: from.toISOString(), to: to.toISOString() },
    model,
    totals: { orders: orders?.length ?? 0, attributed_revenue: attributed, untracked_revenue: untracked },
    per_channel: Object.entries(perChannel).map(([channel, v]) => ({ channel, revenue: Math.round(v.revenue * 100) / 100, orders: Math.round(v.orders * 100) / 100 })).sort((a, b) => b.revenue - a.revenue),
    per_source: Object.entries(perSource).map(([source, v]) => ({ source, revenue: Math.round(v.revenue * 100) / 100, orders: Math.round(v.orders * 100) / 100 })).sort((a, b) => b.revenue - a.revenue).slice(0, 25),
  });
});
