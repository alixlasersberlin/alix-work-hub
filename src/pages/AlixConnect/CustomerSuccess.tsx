import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { HeartPulse, Loader2 } from "lucide-react";

export default function CustomerSuccess() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ customers: [], totals: {}, stages: {} });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: res, error } = await supabase.functions.invoke("ac-customer-success", { body: { action: "overview" } });
        if (error) throw error;
        setData(res);
      } catch (e: any) { toast.error(e.message ?? "Fehler"); }
      finally { setLoading(false); }
    })();
  }, []);

  const healthColor = (h: string) => h === "risk" ? "destructive" : h === "watch" ? "outline" : "secondary";

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Customer Success Automation</h1>
        <Badge variant="outline">Phase 41</Badge>
        {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Kunden</div><div className="text-2xl font-semibold">{data.totals?.count ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gesund</div><div className="text-2xl font-semibold text-emerald-500">{data.totals?.healthy ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Watch</div><div className="text-2xl font-semibold text-amber-500">{data.totals?.watch ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Churn-Risiko</div><div className="text-2xl font-semibold text-red-500">{data.totals?.risk ?? 0}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["onboarding", "activation", "adopted", "expansion"] as const).map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground capitalize">{s}</div>
              <div className="text-xl font-semibold">{data.stages?.[s] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top Churn-Risiken</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(data.customers ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <span>Stage: {c.stage}</span>
                    <span>· {c.orders_90d} Bestellungen/90T</span>
                    <span>· {c.tickets_90d} Tickets/90T</span>
                    {c.last_order && <span>· Letzte Bestellung: {new Date(c.last_order).toLocaleDateString("de-DE")}</span>}
                  </div>
                </div>
                <Badge variant={healthColor(c.health)} className="text-[10px]">{c.health}</Badge>
                <div className="text-xs font-mono w-10 text-right">{c.churn_score}</div>
              </div>
            ))}
            {(data.customers ?? []).length === 0 && <div className="p-6 text-sm text-muted-foreground">Keine Kunden.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
