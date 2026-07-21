import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n || 0);

export default function RevenueAttribution() {
  const today = new Date().toISOString().slice(0, 10);
  const past = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(past);
  const [to, setTo] = useState(today);
  const [model, setModel] = useState<"first" | "last" | "linear">("linear");
  const [report, setReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderData, setOrderData] = useState<any>(null);

  const load = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ac-revenue-attribution", { body: { action: "report", from, to, model } });
      if (error) throw error;
      setReport(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setBusy(false); }
  };

  const lookupOrder = async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ac-revenue-attribution", { body: { action: "order_touchpoints", order_id: orderId } });
      if (error) throw error;
      setOrderData(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Revenue Attribution</h1>
        <Badge variant="outline">Phase 45</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Zeitraum &amp; Modell</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-end">
          <div><label className="text-xs text-muted-foreground">Von</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Bis</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Modell</label>
            <Select value={model} onValueChange={v => setModel(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">First-Touch</SelectItem>
                <SelectItem value="last">Last-Touch</SelectItem>
                <SelectItem value="linear">Linear (gleichverteilt)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={load} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Berechnen</>}</Button>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Aufträge</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{report.totals.orders}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Attribuierter Umsatz</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmt(report.totals.attributed_revenue)}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Ohne Touchpoints</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{fmt(report.totals.untracked_revenue)}</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Kanäle</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Kanal</TableHead><TableHead className="text-right">Aufträge (gew.)</TableHead><TableHead className="text-right">Umsatz</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.per_channel.map((c: any) => (
                    <TableRow key={c.channel}><TableCell className="capitalize">{c.channel}</TableCell><TableCell className="text-right">{c.orders.toFixed(2)}</TableCell><TableCell className="text-right">{fmt(c.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Top Quellen</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Quelle</TableHead><TableHead className="text-right">Aufträge (gew.)</TableHead><TableHead className="text-right">Umsatz</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.per_source.map((s: any) => (
                    <TableRow key={s.source}><TableCell>{s.source}</TableCell><TableCell className="text-right">{s.orders.toFixed(2)}</TableCell><TableCell className="text-right">{fmt(s.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Auftrags-Journey</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Auftrags-ID (UUID)" value={orderId} onChange={e => setOrderId(e.target.value)} />
            <Button onClick={lookupOrder} disabled={!orderId || busy}><Search className="h-4 w-4 mr-1" />Touchpoints laden</Button>
          </div>
          {orderData && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Auftrag <span className="font-mono">{orderData.order.order_number}</span> · {fmt(Number(orderData.order.total ?? 0))} · {orderData.touches.length} Touchpoints</div>
              <div className="border rounded divide-y">
                {orderData.touches.map((t: any, i: number) => (
                  <div key={i} className="p-2 flex gap-3 text-sm">
                    <span className="text-muted-foreground w-40 shrink-0">{new Date(t.at).toLocaleString("de-DE")}</span>
                    <Badge variant="outline" className="capitalize">{t.channel}</Badge>
                    {t.source && <span className="text-xs text-muted-foreground">{t.source}</span>}
                    <span className="truncate">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
