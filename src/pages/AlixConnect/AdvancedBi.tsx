import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BarChart3, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";

export default function AdvancedBi() {
  const [loading, setLoading] = useState(false);
  const [cohorts, setCohorts] = useState<any>({ cohorts: [] });
  const [kpi, setKpi] = useState<any>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [a, b] = await Promise.all([
          supabase.functions.invoke("ac-advanced-bi", { body: { action: "cohorts" } }),
          supabase.functions.invoke("ac-advanced-bi", { body: { action: "kpi_summary" } }),
        ]);
        if (a.error) throw a.error;
        if (b.error) throw b.error;
        setCohorts(a.data);
        setKpi(b.data);
      } catch (e: any) { toast.error(e.message ?? "Fehler"); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Advanced Analytics &amp; BI</h1>
        <Badge variant="outline">Phase 42</Badge>
        {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Umsatz 30T</div><div className="text-2xl font-semibold">{Number(kpi.revenue_30d ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Aufträge 30T</div><div className="text-2xl font-semibold">{kpi.orders_30d ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Offene Tickets</div><div className="text-2xl font-semibold text-amber-500">{kpi.tickets_open ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Kunden gesamt</div><div className="text-2xl font-semibold">{kpi.customers_total ?? 0}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ø LTV (12M)</div><div className="text-2xl font-semibold">{Number(cohorts.ltv_avg ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Neukunden (12M)</div><div className="text-2xl font-semibold">{cohorts.customers_total ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gesamt-Umsatz (12M)</div><div className="text-2xl font-semibold">{Number(cohorts.revenue_total ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Kohorten – Neukunden pro Monat</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cohorts.cohorts ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="customers" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">LTV-Entwicklung pro Kohorte</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cohorts.cohorts ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="ltv" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
