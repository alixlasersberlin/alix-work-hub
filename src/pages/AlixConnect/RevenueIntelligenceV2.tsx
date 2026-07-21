import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { TrendingUp, Loader2, AlertTriangle, Zap, GraduationCap, Quote } from "lucide-react";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null };

export default function RevenueIntelligenceV2() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const query = supabase.from("ac_contacts").select("id, full_name, email, phone").order("updated_at", { ascending: false }).limit(50);
      const { data } = q ? await query.ilike("full_name", `%${q}%`) : await query;
      setContacts(((data ?? []) as any[]).map((c) => ({ id: c.id, name: c.full_name, email: c.email, phone: c.phone })));
    })();
  }, [q]);

  const analyze = async (c: Contact) => {
    setActive(c); setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-revenue-intel-v2", { body: { contact_id: c.id } });
      if (error) throw error;
      setResult(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Revenue Intelligence 2.0</h1>
        <Badge variant="outline">Phase 34</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Deal-Scoring aus Konversationen, Forecast-Stufe, Coaching-Insights und Win/Loss-Analyse mit Konversations-Zitaten.</p>

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Deal-Analyse {active ? `— ${active.name || active.email}` : ""}</CardTitle>
            {active && <Button size="sm" onClick={() => analyze(active)} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Neu berechnen"}</Button>}
          </CardHeader>
          <CardContent>
            {!active && <div className="text-sm text-muted-foreground">Kontakt links wählen…</div>}
            {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI analysiert…</div>}
            {result && !loading && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Deal-Score</div>
                    <div className="text-2xl font-semibold">{result.deal_score ?? 0}<span className="text-sm text-muted-foreground">/100</span></div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Win-Wahrscheinlichkeit</div>
                    <div className="text-2xl font-semibold">{Math.round((result.win_probability ?? 0) * 100)}%</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Forecast-Stufe</div>
                    <div className="text-lg font-medium mt-1 capitalize">{result.forecast_stage || "—"}</div>
                  </div>
                </div>

                {Array.isArray(result.buying_signals) && result.buying_signals.length > 0 && (
                  <section className="rounded border p-3">
                    <div className="text-xs uppercase text-emerald-500 mb-1 flex items-center gap-1"><Zap className="h-3 w-3" /> Buying Signals</div>
                    <ul className="list-disc list-inside text-sm">{result.buying_signals.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </section>
                )}
                {Array.isArray(result.risk_factors) && result.risk_factors.length > 0 && (
                  <section className="rounded border p-3">
                    <div className="text-xs uppercase text-destructive mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Risiken</div>
                    <ul className="list-disc list-inside text-sm">{result.risk_factors.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </section>
                )}
                {Array.isArray(result.coaching_tips) && result.coaching_tips.length > 0 && (
                  <section className="rounded border p-3">
                    <div className="text-xs uppercase text-primary mb-1 flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Coaching Tipps</div>
                    <ul className="list-disc list-inside text-sm">{result.coaching_tips.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </section>
                )}
                {Array.isArray(result.win_loss_quotes) && result.win_loss_quotes.length > 0 && (
                  <section className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1"><Quote className="h-3 w-3" /> Win/Loss Zitate</div>
                    <ul className="space-y-1 text-sm italic">{result.win_loss_quotes.map((s: string, i: number) => <li key={i}>« {s} »</li>)}</ul>
                  </section>
                )}
                {result.recommended_next_action && (
                  <div className="rounded border p-3 bg-primary/5">
                    <div className="text-xs uppercase text-muted-foreground">Nächste Aktion</div>
                    <div className="text-sm mt-1">{result.recommended_next_action}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
