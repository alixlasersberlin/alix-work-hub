import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Handshake, Loader2 } from "lucide-react";

export default function PartnerPortal() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ partners: [], totals: {} });
  const [rate, setRate] = useState(0.1);
  const [commission, setCommission] = useState<Record<string, any>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("ac-partner-portal", { body: { action: "overview" } });
      if (error) throw error;
      setData(res);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const estimate = async (id: string) => {
    const { data: res, error } = await supabase.functions.invoke("ac-partner-portal", { body: { action: "commission_estimate", partner_id: id, rate } });
    if (error) return toast.error(error.message);
    setCommission((c) => ({ ...c, [id]: res }));
  };

  const badge = (h: string) => h === "strong" ? "default" : h === "ok" ? "secondary" : "outline";

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Handshake className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Partner &amp; Reseller Portal</h1>
        <Badge variant="outline">Phase 37</Badge>
        {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Partner</div><div className="text-2xl font-semibold">{data.totals?.count ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Aktiv</div><div className="text-2xl font-semibold">{data.totals?.active ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Events 90T</div><div className="text-2xl font-semibold">{data.totals?.events_90d ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Kommissions-Rate</div><Input type="number" step="0.01" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Partner-Übersicht</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(data.partners ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name ?? p.id}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                    <Badge variant={badge(p.health)} className="text-[10px]">{p.health}</Badge>
                    {p.tier && <span>Tier: {p.tier}</span>}
                    <span>{p.events_90d} Events / 90T</span>
                    {p.last_activity && <span>· {new Date(p.last_activity).toLocaleDateString("de-DE")}</span>}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => estimate(p.id)}>Kommission</Button>
                {commission[p.id] && (
                  <div className="text-xs text-right">
                    <div>Rev: {commission[p.id].revenue?.toFixed?.(2) ?? 0} €</div>
                    <div className="font-medium text-primary">Comm: {commission[p.id].commission?.toFixed?.(2) ?? 0} €</div>
                  </div>
                )}
              </div>
            ))}
            {(data.partners ?? []).length === 0 && <div className="p-6 text-sm text-muted-foreground">Keine Partner.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
