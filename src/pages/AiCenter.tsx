import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Activity, AlertTriangle, BarChart3, Bot, Boxes, Cog, Cpu, Loader2,
  Map as MapIcon, Sparkles, Ticket, Truck, ShieldCheck, Wrench, Send, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

async function callAi(messages: ChatMsg[], opts?: { response_format?: any; model?: string }) {
  const { data, error } = await supabase.functions.invoke("ai-center-chat", {
    body: { messages, ...opts },
  });
  if (error) throw new Error(error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).content as string;
}

function tone(score: number) {
  if (score >= 80) return { label: "Kritisch", cls: "border-destructive/40 bg-destructive/5 text-destructive" };
  if (score >= 60) return { label: "Hoch", cls: "border-orange-500/40 bg-orange-500/5 text-orange-600" };
  if (score >= 30) return { label: "Mittel", cls: "border-yellow-500/40 bg-yellow-500/5 text-yellow-700" };
  return { label: "Niedrig", cls: "border-emerald-500/40 bg-emerald-500/5 text-emerald-600" };
}

export default function AiCenter() {
  const { hasAnyRole, isAdmin } = useAuth();
  const showFinance = isAdmin || hasAnyRole(["Geschäftsführung", "Finance"]);
  const showService = isAdmin || hasAnyRole(["Geschäftsführung", "Serviceleitung", "Service", "Technik"]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Center
        </h1>
        <p className="text-sm text-muted-foreground">
          KI-gestützte Auswertungen aus bestehenden Daten – unterstützend, ohne automatische Entscheidungen.
        </p>
      </div>

      <Tabs defaultValue="copilot">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="copilot"><Bot className="h-4 w-4 mr-1" />Service Copilot</TabsTrigger>
          <TabsTrigger value="risks"><AlertTriangle className="h-4 w-4 mr-1" />Geräte-Risiken</TabsTrigger>
          <TabsTrigger value="maintenance"><Cog className="h-4 w-4 mr-1" />Wartungsprognosen</TabsTrigger>
          <TabsTrigger value="parts"><Boxes className="h-4 w-4 mr-1" />Ersatzteilprognosen</TabsTrigger>
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-1" />Ticket Intelligence</TabsTrigger>
          <TabsTrigger value="warranty"><ShieldCheck className="h-4 w-4 mr-1" />Garantie Intel</TabsTrigger>
          <TabsTrigger value="routes"><Truck className="h-4 w-4 mr-1" />Tourenoptimierung</TabsTrigger>
          {showFinance && <TabsTrigger value="mgmt"><BarChart3 className="h-4 w-4 mr-1" />Management AI</TabsTrigger>}
        </TabsList>

        <TabsContent value="copilot" className="mt-4"><Copilot /></TabsContent>
        <TabsContent value="risks" className="mt-4"><RiskTab /></TabsContent>
        <TabsContent value="maintenance" className="mt-4"><MaintenanceTab /></TabsContent>
        <TabsContent value="parts" className="mt-4"><PartsTab /></TabsContent>
        <TabsContent value="tickets" className="mt-4"><TicketTab /></TabsContent>
        <TabsContent value="warranty" className="mt-4"><WarrantyTab /></TabsContent>
        <TabsContent value="routes" className="mt-4"><RouteTab /></TabsContent>
        {showFinance && <TabsContent value="mgmt" className="mt-4"><ManagementTab /></TabsContent>}
      </Tabs>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Info className="h-3 w-3" /> Alle Empfehlungen sind beratend. Datenquellen werden je Karte ausgewiesen.
      </p>
    </div>
  );
}

/* ---------------- Copilot ---------------- */

function Copilot() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hallo! Ich bin der AlixWork Service Copilot. Frag mich z.B.:\n- Welche Geräte haben das höchste Risiko?\n- Welche Wartungen sind kritisch?\n- Welche Ersatzteile werden knapp?\n- Welche Kunden verursachen die meisten Servicefälle?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function buildContext(): Promise<string> {
    // Gather compact data summary for the model. Counts only — RLS-safe.
    const today = new Date().toISOString().slice(0, 10);
    const next30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const [risks, dueM, overdueM, openTickets, openRepairs, criticalItems, openParts, activeWarr, loaners] = await Promise.all([
      supabase.from("device_health_scores").select("serial_number,device_name,customer_name,health_status,health_score,repair_count,ticket_count,spare_part_count").order("health_score", { ascending: false }).limit(20),
      supabase.from("device_maintenance").select("serial_number,device_name,customer_name,next_maintenance_date").gte("next_maintenance_date", today).lte("next_maintenance_date", next30).limit(50),
      supabase.from("device_maintenance").select("serial_number,device_name,customer_name,next_maintenance_date").lt("next_maintenance_date", today).neq("maintenance_status", "Abgeschlossen").limit(50),
      supabase.from("tickets").select("id,title,status,customer_name,serial_number").in("status", ["Neu", "Offen", "open", "new", "In Bearbeitung"]).limit(50),
      supabase.from("repair_orders").select("repair_number,customer_name,device_model,repair_status").in("repair_status", ["Werkstatt", "In Werkstatt", "In Reparatur"]).limit(50),
      supabase.from("zoho_items").select("item_name,sku,stock_on_hand,reorder_level,min_stock").eq("is_spare_part", true).limit(100),
      supabase.from("spare_part_orders").select("order_number,status,supplier_name").in("status", ["offen", "open", "ordered", "bestellt"]).limit(50),
      supabase.from("warranty_records").select("serial_number,device_name,customer_name,warranty_end").eq("warranty_status", "Aktiv").limit(50),
      supabase.from("loaner_device_assignments").select("serial_number,customer_name,issued_at").is("returned_at", null).limit(50),
    ]);

    const critical = (criticalItems.data ?? []).filter((r: any) =>
      Number(r.stock_on_hand || 0) <= Math.max(Number(r.reorder_level || 0), Number(r.min_stock || 0))
    );

    return JSON.stringify({
      generated_at: new Date().toISOString(),
      top_risk_devices: risks.data ?? [],
      maintenance_due_30d: dueM.data ?? [],
      maintenance_overdue: overdueM.data ?? [],
      open_tickets: openTickets.data ?? [],
      open_repairs: openRepairs.data ?? [],
      critical_stock: critical,
      open_parts_orders: openParts.data ?? [],
      active_warranties: activeWarr.data ?? [],
      loaner_devices_out: loaners.data ?? [],
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");

    try {
      const context = await buildContext();
      const system: ChatMsg = {
        role: "system",
        content:
          "Du bist der AlixWork Service Copilot. Antworte ausschließlich auf Basis der bereitgestellten Daten (JSON unten). " +
          "Wenn etwas nicht in den Daten steht, sage das ehrlich. Gib jede Empfehlung mit Begründung, Datenquelle und (sofern vorhanden) Score und Vertrauensniveau (niedrig/mittel/hoch) an. " +
          "Treffe niemals automatische Entscheidungen – formuliere alles als Vorschlag. Antworte auf Deutsch, präzise, mit Aufzählungen.\n\nDATEN:\n" +
          context,
      };
      const reply = await callAi([system, ...next]);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim AI-Aufruf");
      setMessages(next);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> Service Copilot</CardTitle>
        <CardDescription>Chat auf Basis aktueller Daten (Geräte, Tickets, Wartungen, Lager, Garantie).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="h-[420px] rounded border p-3 bg-muted/20">
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap " +
                  (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-background border")
                }>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg px-3 py-2 text-sm border bg-background flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> denkt nach …
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Frage stellen … (Shift+Enter für Zeilenumbruch)"
            className="min-h-[60px]"
            disabled={loading}
          />
          <Button onClick={send} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Tabs that pull existing data + optional AI summary ---------------- */

function useAiSummary() {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  async function run(prompt: string, system?: string) {
    setLoading(true);
    try {
      const reply = await callAi([
        { role: "system", content: system ?? "Du bist AlixWork AI. Antworte auf Deutsch, kurz, mit Aufzählungen und Begründungen." },
        { role: "user", content: prompt },
      ]);
      setText(reply);
    } catch (e: any) {
      toast.error(e.message ?? "AI-Fehler");
    } finally { setLoading(false); }
  }
  return { text, loading, run, reset: () => setText("") };
}

function ExplainBox({ source, confidence }: { source: string; confidence?: "niedrig" | "mittel" | "hoch" }) {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
      <Badge variant="outline">Quelle: {source}</Badge>
      {confidence && <Badge variant="outline">Vertrauen: {confidence}</Badge>}
      <Badge variant="outline">keine Auto-Entscheidung</Badge>
    </div>
  );
}

function RiskTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ai = useAiSummary();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("device_health_scores")
        .select("serial_number,device_name,customer_name,health_status,health_score,repair_count,ticket_count,complaint_count,spare_part_count,warranty_cases")
        .order("health_score", { ascending: false })
        .limit(50);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const top10 = rows.slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Geräte mit höchstem Risiko</CardTitle>
          <CardDescription>device_health_scores · sortiert nach Score</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? <Loader2 className="animate-spin" /> : top10.map((r) => {
            const score = Math.min(100, Number(r.health_score || 0) * 8);
            const t = tone(score);
            return (
              <div key={r.serial_number} className={`rounded border p-3 ${t.cls.split(" ").slice(0, 2).join(" ")}`}>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-medium">{r.device_name || "Gerät"} <span className="text-xs text-muted-foreground">· SN {r.serial_number}</span></div>
                    <div className="text-xs text-muted-foreground">Kunde: {r.customer_name || "—"}</div>
                    <div className="text-xs mt-1">
                      Reparaturen {r.repair_count} · Tickets {r.ticket_count} · Ersatzteile {r.spare_part_count} · Garantie {r.warranty_cases}
                    </div>
                  </div>
                  <Badge className={t.cls}>{t.label} · {score.toFixed(0)}</Badge>
                </div>
                <Progress value={score} className="h-1 mt-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI-Empfehlung</CardTitle>
          <CardDescription>Beratend – keine Auto-Aktion.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" disabled={ai.loading || top10.length === 0} onClick={() => ai.run(
            "Bewerte die folgenden Geräte und nenne pro Gerät: Risiko (niedrig/mittel/hoch/kritisch), Begründung, empfohlene Maßnahme.\n" + JSON.stringify(top10)
          )}>
            {ai.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Cpu className="h-3 w-3 mr-1" />} Analysieren
          </Button>
          {ai.text && <pre className="whitespace-pre-wrap text-sm mt-3">{ai.text}</pre>}
          <ExplainBox source="device_health_scores + AI" confidence="mittel" />
        </CardContent>
      </Card>
    </div>
  );
}

function MaintenanceTab() {
  const [due, setDue] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ai = useAiSummary();

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const next30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const [a, b] = await Promise.all([
        supabase.from("device_maintenance").select("serial_number,device_name,customer_name,next_maintenance_date").gte("next_maintenance_date", today).lte("next_maintenance_date", next30).order("next_maintenance_date").limit(50),
        supabase.from("device_maintenance").select("serial_number,device_name,customer_name,next_maintenance_date").lt("next_maintenance_date", today).neq("maintenance_status", "Abgeschlossen").order("next_maintenance_date").limit(50),
      ]);
      setDue(a.data ?? []); setOverdue(b.data ?? []); setLoading(false);
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle className="text-base">Fällig (30 Tage)</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={due} fmt={(r) => `${r.device_name ?? r.serial_number} – ${r.customer_name ?? "—"} (${r.next_maintenance_date})`} />}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base text-destructive">Überfällig</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={overdue} fmt={(r) => `${r.device_name ?? r.serial_number} – ${r.customer_name ?? "—"} (${r.next_maintenance_date})`} />}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Prognose</CardTitle></CardHeader>
        <CardContent>
          <Button size="sm" disabled={ai.loading} onClick={() => ai.run(
            "Analysiere die Wartungsfälligkeiten. Welche Geräte sollten vorgezogen werden? Welche Techniker-Routen wären sinnvoll? Welche Ersatzteile sollten vorgehalten werden?\n"
            + JSON.stringify({ due, overdue })
          )}>
            {ai.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Cpu className="h-3 w-3 mr-1" />} Vorschläge generieren
          </Button>
          {ai.text && <pre className="whitespace-pre-wrap text-sm mt-3">{ai.text}</pre>}
          <ExplainBox source="device_maintenance + AI" confidence="mittel" />
        </CardContent>
      </Card>
    </div>
  );
}

function PartsTab() {
  const [critical, setCritical] = useState<any[]>([]);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ai = useAiSummary();

  useEffect(() => {
    (async () => {
      const [items, cons] = await Promise.all([
        supabase.from("zoho_items").select("item_name,sku,stock_on_hand,reorder_level,min_stock,stock_on_order").eq("is_spare_part", true).limit(500),
        supabase.from("spare_part_consumption").select("item_name,quantity,consumed_at").gte("consumed_at", new Date(Date.now() - 90 * 86400000).toISOString()).limit(500),
      ]);
      const crit = (items.data ?? []).filter((r: any) =>
        Number(r.stock_on_hand || 0) <= Math.max(Number(r.reorder_level || 0), Number(r.min_stock || 0))
      ).slice(0, 30);
      const agg = new Map<string, number>();
      for (const c of cons.data ?? []) agg.set(c.item_name ?? "", (agg.get(c.item_name ?? "") || 0) + Number(c.quantity || 0));
      const top = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, qty]) => ({ name, qty }));
      setCritical(crit); setConsumption(top); setLoading(false);
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle className="text-base">Kritische Bestände</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={critical} fmt={(r) => `${r.item_name ?? r.sku} – Bestand ${r.stock_on_hand ?? 0} / Meldebestand ${r.reorder_level ?? r.min_stock ?? 0}`} />}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Top-Verbrauch (90 T.)</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={consumption} fmt={(r) => `${r.name} – ${r.qty} Stk.`} />}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Bestellempfehlung</CardTitle></CardHeader>
        <CardContent>
          <Button size="sm" disabled={ai.loading} onClick={() => ai.run(
            "Schlage Nachbestellungen, neue Mindestbestände und Lieferantenrisiken vor. Begründe jeden Vorschlag.\n"
            + JSON.stringify({ critical, consumption })
          )}>
            {ai.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Cpu className="h-3 w-3 mr-1" />} Empfehlungen
          </Button>
          {ai.text && <pre className="whitespace-pre-wrap text-sm mt-3">{ai.text}</pre>}
          <ExplainBox source="zoho_items + spare_part_consumption + AI" confidence="mittel" />
        </CardContent>
      </Card>
    </div>
  );
}

function TicketTab() {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const ai = useAiSummary();

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 180 * 86400000).toISOString();
      const { data } = await supabase.from("tickets").select("status,serial_number,customer_name,auto_category,created_at,closed_at").gte("created_at", since).limit(2000);
      const arr = data ?? [];
      const byCat = aggregate(arr, (t) => t.auto_category ?? "Sonstiges");
      const bySerial = aggregate(arr.filter((t) => t.serial_number), (t) => t.serial_number);
      const byCust = aggregate(arr, (t) => t.customer_name ?? "—");
      setStats({ total: arr.length, byCat, topSerials: top(bySerial, 10), topCust: top(byCust, 10) });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle className="text-base">Häufige Fehlerbilder</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={top(stats.byCat || {}, 10)} fmt={(r) => `${r.key} – ${r.value}`} />}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Problemgeräte / Problemkunden</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : (
            <div className="space-y-3">
              <div><div className="text-xs font-semibold mb-1">Top SN</div><List items={stats.topSerials} fmt={(r) => `SN ${r.key} – ${r.value}`} /></div>
              <div><div className="text-xs font-semibold mb-1">Top Kunden</div><List items={stats.topCust} fmt={(r) => `${r.key} – ${r.value}`} /></div>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Insights</CardTitle></CardHeader>
        <CardContent>
          <Button size="sm" disabled={ai.loading} onClick={() => ai.run(
            "Identifiziere Wiederholungsfehler, Eskalationsmuster und auffällige Kunden/Geräte. Welche Maßnahmen?\n" + JSON.stringify(stats)
          )}>
            {ai.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Cpu className="h-3 w-3 mr-1" />} Analysieren
          </Button>
          {ai.text && <pre className="whitespace-pre-wrap text-sm mt-3">{ai.text}</pre>}
          <ExplainBox source="tickets + AI" confidence="mittel" />
        </CardContent>
      </Card>
    </div>
  );
}

function WarrantyTab() {
  const [rows, setRows] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const ai = useAiSummary();

  useEffect(() => {
    (async () => {
      const [decisions, goodwill] = await Promise.all([
        supabase.from("warranty_decisions").select("device_name,decision,decision_reason,created_at,serial_number").order("created_at", { ascending: false }).limit(200),
        supabase.from("goodwill_cases").select("device_name,reason,status,company_share,customer_share,created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      const decArr = decisions.data ?? [];
      const byModel = aggregate(decArr, (r) => r.device_name ?? "—");
      setRows({ decisions: decArr.slice(0, 30), goodwill: goodwill.data ?? [], byModel: top(byModel, 10) });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card><CardHeader><CardTitle className="text-base">Auffällige Modelle</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={rows.byModel} fmt={(r) => `${r.key} – ${r.value}`} />}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle className="text-base">Aktuelle Kulanzfälle</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={(rows.goodwill || []).slice(0, 10)} fmt={(r) => `${r.device_name ?? "—"} · ${r.status} · Anteil Kunde ${Number(r.customer_share || 0).toFixed(0)}€`} />}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Auswertung</CardTitle></CardHeader>
        <CardContent>
          <Button size="sm" disabled={ai.loading} onClick={() => ai.run(
            "Erkenne auffällige Serien, erhöhte Ausfallraten und Kulanzrisiken. Gib Empfehlung pro Befund.\n" + JSON.stringify(rows)
          )}>
            {ai.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Cpu className="h-3 w-3 mr-1" />} Analysieren
          </Button>
          {ai.text && <pre className="whitespace-pre-wrap text-sm mt-3">{ai.text}</pre>}
          <ExplainBox source="warranty_decisions + goodwill_cases + AI" confidence="niedrig" />
        </CardContent>
      </Card>
    </div>
  );
}

function RouteTab() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const ai = useAiSummary();

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const next7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("route_plans")
        .select("id,plan_date,planning_status,driver,stops_count,duration_minutes,address")
        .gte("plan_date", today).lte("plan_date", next7)
        .order("plan_date").limit(100);
      setPlans(data ?? []); setLoading(false);
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapIcon className="h-4 w-4" /> Geplante Touren (7 Tage)</CardTitle></CardHeader>
        <CardContent>{loading ? <Loader2 className="animate-spin" /> : <List items={plans} fmt={(r) => `${r.plan_date} · ${r.driver ?? "—"} · ${r.planning_status ?? "—"} · ${r.stops_count ?? 0} Stops`} />}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Optimierungs-Vorschläge</CardTitle></CardHeader>
        <CardContent>
          <Button size="sm" disabled={ai.loading} onClick={() => ai.run(
            "Schlage Verbesserungen vor: bessere Reihenfolge, Technikerwechsel, Zusammenlegung von Einsätzen, Skill-Verteilung. Begründe jeden Vorschlag.\n" + JSON.stringify(plans)
          )}>
            {ai.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Cpu className="h-3 w-3 mr-1" />} Vorschläge
          </Button>
          {ai.text && <pre className="whitespace-pre-wrap text-sm mt-3">{ai.text}</pre>}
          <ExplainBox source="route_plans + AI" confidence="niedrig" />
        </CardContent>
      </Card>
    </div>
  );
}

function ManagementTab() {
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const ai = useAiSummary();

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 365 * 86400000).toISOString();
      const [orders, invoices, repairs, maint, warr] = await Promise.all([
        supabase.from("orders").select("created_at,total_amount").gte("created_at", since).limit(2000),
        supabase.from("invoices").select("created_at,total").gte("created_at", since).limit(2000),
        supabase.from("repair_orders").select("created_at,repair_status").gte("created_at", since).limit(2000),
        supabase.from("device_maintenance").select("last_maintenance_date,maintenance_status").gte("last_maintenance_date", since.slice(0, 10)).limit(2000),
        supabase.from("warranty_decisions").select("created_at,decision").gte("created_at", since).limit(2000),
      ]);
      const monthly = monthlyAggregate(invoices.data ?? [], "created_at", "total");
      const orderM = monthlyAggregate(orders.data ?? [], "created_at", "total_amount");
      setData({ revenue: monthly, orders: orderM, repairs: (repairs.data ?? []).length, maint: (maint.data ?? []).length, warranty: (warr.data ?? []).length });
      setLoading(false);
    })();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Trends (12 Monate)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="animate-spin" /> : (
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Umsatz Jahr" value={`${Object.values(data.revenue || {}).reduce((s: number, v: any) => s + Number(v || 0), 0).toFixed(0)} €`} />
              <Stat label="Aufträge Jahr" value={`${Object.values(data.orders || {}).reduce((s: number, v: any) => s + Number(v || 0), 0).toFixed(0)} €`} />
              <Stat label="Reparaturen 12 M." value={String(data.repairs ?? 0)} />
              <Stat label="Wartungen 12 M." value={String(data.maint ?? 0)} />
              <Stat label="Garantie-Entsch." value={String(data.warranty ?? 0)} />
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> Prognose & Empfehlungen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" disabled={ai.loading} onClick={() => ai.run("Erstelle eine 30-Tage-Prognose für Umsatz, Servicekosten und Reparaturquote.\n" + JSON.stringify(data))}>30 Tage</Button>
            <Button size="sm" disabled={ai.loading} onClick={() => ai.run("Erstelle eine 90-Tage-Prognose mit Hauptrisiken und Chancen.\n" + JSON.stringify(data))}>90 Tage</Button>
            <Button size="sm" disabled={ai.loading} onClick={() => ai.run("Erstelle eine 12-Monats-Prognose mit Trendkommentar.\n" + JSON.stringify(data))}>12 Monate</Button>
          </div>
          {ai.loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {ai.text && <pre className="whitespace-pre-wrap text-sm">{ai.text}</pre>}
          <ExplainBox source="invoices + orders + repair_orders + AI" confidence="niedrig" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function List({ items, fmt }: { items: any[]; fmt: (r: any) => string }) {
  if (!items?.length) return <div className="text-sm text-muted-foreground">Keine Daten.</div>;
  return (
    <ul className="text-sm space-y-1">
      {items.map((r, i) => <li key={i} className="border-b last:border-0 py-1">{fmt(r)}</li>)}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function aggregate<T>(arr: T[], key: (r: T) => string) {
  const m: Record<string, number> = {};
  for (const r of arr) { const k = key(r) || "—"; m[k] = (m[k] || 0) + 1; }
  return m;
}

function top(m: Record<string, number>, n: number) {
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, value]) => ({ key, value }));
}

function monthlyAggregate(rows: any[], dateKey: string, valueKey: string) {
  const m: Record<string, number> = {};
  for (const r of rows) {
    const d = (r[dateKey] ?? "").slice(0, 7);
    if (!d) continue;
    m[d] = (m[d] || 0) + Number(r[valueKey] || 0);
  }
  return m;
}
