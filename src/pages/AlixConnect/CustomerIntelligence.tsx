import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Brain, Loader2, TrendingUp, Target, Tags } from "lucide-react";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null };

export default function CustomerIntelligence() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const query = supabase.from("ac_contacts").select("id, name, email, phone").order("updated_at", { ascending: false }).limit(50);
      const { data } = q ? await query.ilike("name", `%${q}%`) : await query;
      setContacts(data ?? []);
    })();
  }, [q]);

  const analyze = async (c: Contact) => {
    setActive(c);
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-customer-intel", { body: { contact_id: c.id } });
      if (error) throw error;
      setResult(data);
      const { data: hist } = await supabase.from("ac_predictions")
        .select("created_at, score, metadata").eq("contact_id", c.id).eq("prediction_type", "customer_intelligence")
        .order("created_at", { ascending: false }).limit(10);
      setHistory(hist ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Fehler");
    } finally { setLoading(false); }
  };

  const riskLabel = (r: number) => r >= 0.7 ? "kritisch" : r >= 0.4 ? "mittel" : "gering";
  const riskVariant = (r: number) => r >= 0.7 ? "destructive" : r >= 0.4 ? "default" : "secondary";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Customer Intelligence Hub</h1>
        <Badge variant="outline">Phase 33</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Predictive Churn, CLV-Score, Next-Best-Offer, Cross-Sell und Segment-Auto-Tagging pro Kontakt.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Kontakte</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-[65vh] overflow-y-auto -mx-6">
              {contacts.map((c) => (
                <button key={c.id} onClick={() => analyze(c)}
                  className={`w-full text-left px-6 py-2 border-b border-border/50 hover:bg-muted/50 ${active?.id === c.id ? "bg-muted" : ""}`}>
                  <div className="text-sm font-medium truncate">{c.name || c.email || "(unbenannt)"}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.email || c.phone}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Analyse {active ? `— ${active.name || active.email}` : ""}</CardTitle>
              {active && <Button size="sm" onClick={() => analyze(active)} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Neu berechnen"}</Button>}
            </CardHeader>
            <CardContent>
              {!active && <div className="text-sm text-muted-foreground">Kontakt links wählen…</div>}
              {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI berechnet…</div>}
              {result && !loading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Churn-Risk</div>
                    <div className="text-2xl font-semibold">{Math.round((result.churn_risk ?? 0) * 100)}%</div>
                    <Badge variant={riskVariant(result.churn_risk ?? 0) as any} className="mt-1">{riskLabel(result.churn_risk ?? 0)}</Badge>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground">CLV-Score</div>
                    <div className="text-2xl font-semibold">{result.clv_score ?? 0}<span className="text-sm text-muted-foreground">/100</span></div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Segment</div>
                    <div className="text-lg font-medium mt-1">{result.segment || "—"}</div>
                  </div>
                  {result.next_best_offer && (
                    <div className="md:col-span-3 rounded border p-3 bg-primary/5">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase"><Target className="h-3 w-3" /> Next Best Offer</div>
                      <div className="text-sm mt-1">{result.next_best_offer}</div>
                    </div>
                  )}
                  {Array.isArray(result.cross_sell) && result.cross_sell.length > 0 && (
                    <div className="md:col-span-3 rounded border p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase mb-1"><TrendingUp className="h-3 w-3" /> Cross-Sell</div>
                      <ul className="list-disc list-inside text-sm">{result.cross_sell.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                    </div>
                  )}
                  {Array.isArray(result.auto_tags) && result.auto_tags.length > 0 && (
                    <div className="md:col-span-3 rounded border p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase mb-1"><Tags className="h-3 w-3" /> Auto-Tags</div>
                      <div className="flex flex-wrap gap-1">{result.auto_tags.map((t: string, i: number) => <Badge key={i} variant="secondary">{t}</Badge>)}</div>
                    </div>
                  )}
                  {result.reasoning && <div className="md:col-span-3 text-xs text-muted-foreground italic">{result.reasoning}</div>}
                </div>
              )}
            </CardContent>
          </Card>
          {history.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Historie</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1 text-xs">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border/30 py-1">
                      <span>{new Date(h.created_at).toLocaleString("de-DE")}</span>
                      <span>Churn {Math.round((h.score ?? 0) * 100)}% · CLV {h.metadata?.clv_score ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
