import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Webhook, Loader2, ExternalLink } from "lucide-react";

export default function Marketplace2() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ apps: [], webhooks: [], stats: {} });
  const [url, setUrl] = useState("");
  const [event, setEvent] = useState("ticket.created");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("ac-marketplace", { body: { action: "overview" } });
      if (error) throw error;
      setData(res);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("ac-marketplace", { body: { action: "test_webhook", url, event } });
      if (error) throw error;
      setTestResult(res);
      if (res.ok) toast.success(`OK · ${res.status} · ${res.ms}ms`);
      else toast.error(`Fehler · ${res.status ?? res.error}`);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setTesting(false); }
  };

  const statusVariant = (s: string) => s === "ready" ? "default" : s === "beta" ? "secondary" : "outline";

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Webhook className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Marketplace &amp; Public API</h1>
        <Badge variant="outline">Phase 38</Badge>
        {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Apps gesamt</div><div className="text-2xl font-semibold">{data.stats?.total ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ready</div><div className="text-2xl font-semibold text-emerald-500">{data.stats?.ready ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Beta</div><div className="text-2xl font-semibold text-amber-500">{data.stats?.beta ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Geplant</div><div className="text-2xl font-semibold text-muted-foreground">{data.stats?.planned ?? 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">App-Katalog</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data.apps ?? []).map((a: any) => (
            <div key={a.id} className="rounded-lg border border-border/60 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{a.name}</div>
                <Badge variant={statusVariant(a.status)} className="text-[10px]">{a.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{a.description}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.category}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ExternalLink className="h-4 w-4" />Webhook-Tester</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="https://your.endpoint/webhook" value={url} onChange={(e) => setUrl(e.target.value)} className="md:col-span-2" />
            <select className="rounded-md border border-input bg-background px-3 text-sm" value={event} onChange={(e) => setEvent(e.target.value)}>
              {(data.webhooks ?? []).map((w: any) => <option key={w.event} value={w.event}>{w.event}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={test} disabled={!url || testing}>{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testen"}</Button>
          {testResult && <pre className="text-xs bg-muted rounded p-2 overflow-auto">{JSON.stringify(testResult, null, 2)}</pre>}
          <div className="text-xs text-muted-foreground">Verfügbare Events: {(data.webhooks ?? []).map((w: any) => w.event).join(", ")}</div>
        </CardContent>
      </Card>
    </div>
  );
}
