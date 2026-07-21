import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Truck, Loader2 } from "lucide-react";

export default function FieldDispatch() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>({ appointments: [], totals: {} });
  const [src, setSrc] = useState({ lat: 52.52, lng: 13.405 });
  const [dst, setDst] = useState({ lat: 48.137, lng: 11.575 });
  const [eta, setEta] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("ac-field-dispatch", { body: { action: "overview" } });
      if (error) throw error;
      setData(res);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const computeEta = async () => {
    try {
      const { data: res, error } = await supabase.functions.invoke("ac-field-dispatch", { body: { action: "eta", src_lat: src.lat, src_lng: src.lng, dst_lat: dst.lat, dst_lng: dst.lng } });
      if (error) throw error;
      setEta(res);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
  };

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Field Service &amp; Dispatch 2.0</h1>
        <Badge variant="outline">Phase 39</Badge>
        {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Woche</div><div className="text-2xl font-semibold">{data.totals?.week ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Geplant</div><div className="text-2xl font-semibold">{data.totals?.scheduled ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">In Arbeit</div><div className="text-2xl font-semibold text-amber-500">{data.totals?.in_progress ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Fertig</div><div className="text-2xl font-semibold text-emerald-500">{data.totals?.done ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Storno</div><div className="text-2xl font-semibold text-muted-foreground">{data.totals?.cancelled ?? 0}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Einsätze (7 Tage)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {(data.appointments ?? []).slice(0, 30).map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title ?? "(ohne Titel)"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.starts_at).toLocaleString("de-DE")} · {a.status ?? "scheduled"}
                  </div>
                </div>
                <Badge variant={a.status === "done" ? "secondary" : "outline"} className="text-[10px]">{a.status ?? "scheduled"}</Badge>
              </div>
            ))}
            {(data.appointments ?? []).length === 0 && <div className="p-6 text-sm text-muted-foreground">Keine Einsätze geplant.</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ETA-Rechner</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input type="number" step="0.001" value={src.lat} onChange={(e) => setSrc({ ...src, lat: Number(e.target.value) })} placeholder="Von Lat" />
            <Input type="number" step="0.001" value={src.lng} onChange={(e) => setSrc({ ...src, lng: Number(e.target.value) })} placeholder="Von Lng" />
            <Input type="number" step="0.001" value={dst.lat} onChange={(e) => setDst({ ...dst, lat: Number(e.target.value) })} placeholder="Ziel Lat" />
            <Input type="number" step="0.001" value={dst.lng} onChange={(e) => setDst({ ...dst, lng: Number(e.target.value) })} placeholder="Ziel Lng" />
          </div>
          <Button size="sm" onClick={computeEta}>ETA berechnen</Button>
          {eta && (
            <div className="text-sm space-y-1">
              <div>Distanz: <span className="font-medium">{eta.km} km</span></div>
              <div>ETA: <span className="font-medium">{eta.eta_minutes} min</span> · {new Date(eta.eta_iso).toLocaleTimeString("de-DE")}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
