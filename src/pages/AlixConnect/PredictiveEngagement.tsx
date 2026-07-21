import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Brain, Loader2, Clock, AlertTriangle, Rocket } from "lucide-react";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null };

export default function PredictiveEngagement() {
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
      const { data, error } = await supabase.functions.invoke("ac-predictive-engagement", { body: { contact_id: c.id } });
      if (error) throw error;
      setResult(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Predictive Engagement Engine</h1>
        <Badge variant="outline">Phase 35</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Best-Time-to-Contact, Response-Wahrscheinlichkeit und Churn-Risiko pro Kontakt — inkl. proaktivem Outreach-Vorschlag.</p>

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
            <CardTitle className="text-base">Prognose {active ? `— ${active.name || active.email}` : ""}</CardTitle>
            {active && <Button size="sm" onClick={() => analyze(active)} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Neu berechnen"}</Button>}
          </CardHeader>
          <CardContent>
            {!active && <div className="text-sm text-muted-foreground">Kontakt links wählen…</div>}
            {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> AI analysiert…</div>}
            {result && !loading && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Best Time</div>
                    <div className="text-lg font-medium mt-1">{result.best_time_to_contact?.weekday} · {result.best_time_to_contact?.hour_range}</div>
                    <div className="text-xs text-muted-foreground">{result.best_time_to_contact?.timezone}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Response-Wahrscheinlichkeit</div>
                    <div className="text-2xl font-semibold">{Math.round((result.response_probability ?? 0) * 100)}%</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Churn-Risiko</div>
                    <div className="text-2xl font-semibold">{Math.round((result.churn_risk ?? 0) * 100)}%</div>
                    <Badge variant={result.risk_level === "high" ? "destructive" : result.risk_level === "medium" ? "secondary" : "outline"} className="mt-1">{result.risk_level}</Badge>
                  </div>
                </div>

                {Array.isArray(result.recommended_channels) && result.recommended_channels.length > 0 && (
                  <section className="rounded border p-3">
                    <div className="text-xs uppercase text-muted-foreground mb-1">Empfohlene Kanäle</div>
                    <div className="flex flex-wrap gap-1">{result.recommended_channels.map((s: string, i: number) => <Badge key={i} variant="outline">{s}</Badge>)}</div>
                  </section>
                )}

                {result.proactive_outreach && (
                  <section className="rounded border p-3 bg-primary/5">
                    <div className="text-xs uppercase text-primary flex items-center gap-1 mb-1"><Rocket className="h-3 w-3" /> Proactive Outreach</div>
                    <div className="text-sm"><b>Trigger:</b> {result.proactive_outreach.trigger}</div>
                    <div className="text-sm mt-1"><b>Nachricht:</b> {result.proactive_outreach.message_hint}</div>
                  </section>
                )}

                {result.reasoning && (
                  <div className="text-xs text-muted-foreground italic">{result.reasoning}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
