import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, svc);
    const { data: roleRow } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "Admin" });
    const { data: superRow } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "Super Admin" });
    if (!roleRow && !superRow) return json({ error: "forbidden" }, 403);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Math.min(180, Math.max(14, Number(body?.lookback_days ?? 90)));
    const horizon = Math.min(90, Math.max(7, Number(body?.horizon_days ?? 30)));

    const from = new Date(Date.now() - days * 86400_000).toISOString();
    const { data: orders, error } = await admin
      .from("orders")
      .select("id, total, created_at, source_system")
      .gte("created_at", from)
      .limit(10000);
    if (error) return json({ error: error.message }, 500);

    // Daily aggregation
    const byDay = new Map<string, number>();
    const bySource = new Map<string, number>();
    for (const o of orders ?? []) {
      const d = String(o.created_at).slice(0, 10);
      const v = Number(o.total ?? 0) || 0;
      byDay.set(d, (byDay.get(d) ?? 0) + v);
      const src = o.source_system ?? "unknown";
      bySource.set(src, (bySource.get(src) ?? 0) + v);
    }
    // Fill missing days
    const series: { date: string; revenue: number }[] = [];
    const start = new Date(Date.now() - days * 86400_000);
    for (let i = 0; i <= days; i++) {
      const d = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
      series.push({ date: d, revenue: byDay.get(d) ?? 0 });
    }

    // Linear regression y = a + b*x
    const n = series.length;
    const xs = series.map((_, i) => i);
    const ys = series.map((s) => s.revenue);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    const b = den === 0 ? 0 : num / den;
    const a = my - b * mx;

    // Forecast + residual band (±1 stddev)
    const residuals = ys.map((y, i) => y - (a + b * i));
    const stdDev = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2));
    const forecast: { date: string; revenue: number; low: number; high: number }[] = [];
    for (let i = 1; i <= horizon; i++) {
      const idx = n + i;
      const y = Math.max(0, a + b * idx);
      const d = new Date(Date.now() + i * 86400_000).toISOString().slice(0, 10);
      forecast.push({ date: d, revenue: Math.round(y), low: Math.max(0, Math.round(y - stdDev)), high: Math.round(y + stdDev) });
    }

    const totalPast = ys.reduce((s, y) => s + y, 0);
    const totalForecast = forecast.reduce((s, f) => s + f.revenue, 0);
    const avgDaily = totalPast / n;
    const trendPct = avgDaily > 0 ? (b / avgDaily) * 100 : 0;

    return json({
      lookback_days: days,
      horizon_days: horizon,
      totals: {
        past_revenue: Math.round(totalPast),
        forecast_revenue: Math.round(totalForecast),
        avg_daily: Math.round(avgDaily),
        trend_pct_per_day: Number(trendPct.toFixed(3)),
        stddev: Math.round(stdDev),
        orders: orders?.length ?? 0,
      },
      per_source: Array.from(bySource.entries())
        .map(([source, revenue]) => ({ source, revenue: Math.round(revenue) }))
        .sort((x, y) => y.revenue - x.revenue),
      series,
      forecast,
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "unexpected" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
