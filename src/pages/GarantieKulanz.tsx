import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Clock, AlertOctagon, Gift, Truck, Euro, Plus, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

type Warranty = {
  id: string; serial_number: string; device_name: string | null; customer_name: string | null;
  warranty_start: string | null; warranty_end: string | null; warranty_type: string | null;
  warranty_status: string; manufacturer: string | null; warranty_terms: string | null;
};
type Decision = {
  id: string; serial_number: string | null; device_name: string | null; customer_name: string | null;
  source_type: string; repair_order_id: string | null; ticket_id: string | null;
  check_result: string | null; decision: string | null; decision_reason: string | null;
  cost_coverage_company: number | null; cost_coverage_customer: number | null;
  total_cost: number | null; decided_at: string | null; approved_at: string | null;
  created_at: string;
};
type Goodwill = {
  id: string; serial_number: string | null; customer_name: string | null; reason: string | null;
  cost_share_company: number | null; cost_share_customer: number | null;
  requires_approval: boolean; approval_status: string; approved_at: string | null;
  created_at: string;
};
type Loaner = {
  id: string; serial_number: string | null; model_name: string | null; customer_name: string | null;
  repair_order_id: string | null; issued_at: string | null; returned_at: string | null;
  status: string; condition_out: string | null; condition_in: string | null;
};
type CostItem = {
  id: string; warranty_decision_id: string; cost_type: string; description: string | null;
  total_amount: number | null; billing_target: string; cost_date: string | null;
};

const sb = supabase as any;

export default function GarantieKulanz() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [goodwill, setGoodwill] = useState<Goodwill[]>([]);
  const [loaners, setLoaners] = useState<Loaner[]>([]);
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDec, setShowDec] = useState(false);
  const [editing, setEditing] = useState<Partial<Decision> | null>(null);

  const load = async () => {
    setLoading(true);
    const [w, d, g, l, c] = await Promise.all([
      sb.from("warranty_records").select("*").order("warranty_end", { ascending: true }).limit(2000),
      sb.from("warranty_decisions").select("*").order("created_at", { ascending: false }).limit(1000),
      sb.from("goodwill_cases").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("loaner_device_assignments").select("*").order("issued_at", { ascending: false }).limit(500),
      sb.from("warranty_cost_items").select("*").order("cost_date", { ascending: false }).limit(2000),
    ]);
    [w, d, g, l, c].forEach((r) => r.error && toast.error(r.error.message));
    setWarranties(w.data ?? []); setDecisions(d.data ?? []);
    setGoodwill(g.data ?? []); setLoaners(l.data ?? []); setCosts(c.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const kpis = useMemo(() => {
    const monthlyWarranty = costs
      .filter((c) => c.cost_date && new Date(c.cost_date) >= monthStart && c.billing_target === "Firma")
      .reduce((s, c) => s + Number(c.total_amount || 0), 0);
    const yearlyWarranty = costs
      .filter((c) => c.cost_date && new Date(c.cost_date) >= yearStart && c.billing_target === "Firma")
      .reduce((s, c) => s + Number(c.total_amount || 0), 0);
    const monthlyGoodwill = goodwill
      .filter((g) => g.created_at && new Date(g.created_at) >= monthStart)
      .reduce((s, g) => s + Number(g.cost_share_company || 0), 0);
    const yearlyGoodwill = goodwill
      .filter((g) => g.created_at && new Date(g.created_at) >= yearStart)
      .reduce((s, g) => s + Number(g.cost_share_company || 0), 0);
    return {
      active: warranties.filter((w) => w.warranty_status === "Aktiv").length,
      soon: warranties.filter((w) => w.warranty_end && w.warranty_end >= today && w.warranty_end <= in90).length,
      expired: warranties.filter((w) => w.warranty_status === "Abgelaufen").length,
      openChecks: decisions.filter((d) => d.decision === "Offen" || d.check_result === "Offen").length,
      openGoodwill: goodwill.filter((g) => g.approval_status === "Offen").length,
      loanerOut: loaners.filter((l) => l.status === "ausgegeben").length,
      monthlyWarranty, yearlyWarranty, monthlyGoodwill, yearlyGoodwill,
      countWarranty: decisions.filter((d) => d.decision?.startsWith("Garantie")).length,
      countGoodwill: goodwill.length,
    };
  }, [warranties, decisions, goodwill, loaners, costs, today, in90]);

  const filteredW = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return warranties;
    return warranties.filter((w) =>
      [w.serial_number, w.device_name, w.customer_name, w.manufacturer].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [warranties, q]);

  const saveDecision = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    if (payload.decision && payload.decision !== "Offen" && !payload.decided_at) {
      payload.decided_at = new Date().toISOString();
      const u = await supabase.auth.getUser();
      payload.decided_by = u.data.user?.id;
    }
    const { error } = editing.id
      ? await sb.from("warranty_decisions").update(payload).eq("id", editing.id)
      : await sb.from("warranty_decisions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Entscheidung gespeichert");
    setShowDec(false); setEditing(null); load();
  };

  const approveGoodwill = async (id: string, approved: boolean) => {
    const u = await supabase.auth.getUser();
    const { error } = await sb.from("goodwill_cases").update({
      approval_status: approved ? "Genehmigt" : "Abgelehnt",
      approved_by: u.data.user?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(approved ? "Kulanz genehmigt" : "Kulanz abgelehnt");
    load();
  };

  const markReturned = async (id: string) => {
    const u = await supabase.auth.getUser();
    const { error } = await sb.from("loaner_device_assignments").update({
      status: "zurückgegeben", returned_at: new Date().toISOString(), returned_by: u.data.user?.id,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ersatzgerät als zurückgegeben markiert"); load();
  };

  const statusBadge = (s: string) => {
    const v: Record<string, string> = {
      Aktiv: "bg-green-500/15 text-green-500 border-green-500/30",
      "Läuft bald ab": "bg-amber-500/15 text-amber-500 border-amber-500/30",
      Abgelaufen: "bg-red-500/15 text-red-500 border-red-500/30",
    };
    return <Badge variant="outline" className={v[s] ?? ""}>{s}</Badge>;
  };
  const decisionBadge = (s: string | null) => {
    const v: Record<string, string> = {
      "Garantie genehmigt": "bg-green-500/15 text-green-500 border-green-500/30",
      "Garantie abgelehnt": "bg-red-500/15 text-red-500 border-red-500/30",
      "Kulanz genehmigt": "bg-amber-500/15 text-amber-500 border-amber-500/30",
      "Kulanz teilweise genehmigt": "bg-amber-500/15 text-amber-500 border-amber-500/30",
      Kostenpflichtig: "bg-slate-500/15 text-slate-300 border-slate-500/30",
      Offen: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    };
    return <Badge variant="outline" className={v[s ?? "Offen"] ?? ""}>{s ?? "Offen"}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> Garantie &amp; Kulanz
          </h1>
          <p className="text-muted-foreground mt-1">Garantieakte, Entscheidungen, Kulanzfälle, Ersatzgeräte und Kosten.</p>
        </div>
        <Button onClick={() => { setEditing({ source_type: "repair_order", check_result: "Offen", decision: "Offen" }); setShowDec(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Neue Garantieprüfung
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<ShieldCheck className="h-5 w-5 text-green-500" />} title="Aktive Garantien" value={kpis.active} />
        <Kpi icon={<Clock className="h-5 w-5 text-amber-500" />} title="Bald ablaufend (90 T.)" value={kpis.soon} />
        <Kpi icon={<AlertOctagon className="h-5 w-5 text-red-500" />} title="Abgelaufen" value={kpis.expired} />
        <Kpi icon={<ShieldCheck className="h-5 w-5 text-blue-400" />} title="Offene Prüfungen" value={kpis.openChecks} />
        <Kpi icon={<Gift className="h-5 w-5 text-amber-500" />} title="Offene Kulanzanträge" value={kpis.openGoodwill} />
        <Kpi icon={<Truck className="h-5 w-5 text-primary" />} title="Ersatzgeräte unterwegs" value={kpis.loanerOut} />
        <Kpi icon={<Euro className="h-5 w-5 text-green-500" />} title="Garantiekosten Monat" value={`${kpis.monthlyWarranty.toFixed(2)} €`} />
        <Kpi icon={<Euro className="h-5 w-5 text-amber-500" />} title="Kulanzkosten Monat" value={`${kpis.monthlyGoodwill.toFixed(2)} €`} />
      </div>

      <Tabs defaultValue="warranties">
        <TabsList>
          <TabsTrigger value="warranties">Garantien</TabsTrigger>
          <TabsTrigger value="decisions">Entscheidungen</TabsTrigger>
          <TabsTrigger value="goodwill">Kulanz</TabsTrigger>
          <TabsTrigger value="loaners">Ersatzgeräte</TabsTrigger>
          <TabsTrigger value="costs">Kosten</TabsTrigger>
        </TabsList>

        <TabsContent value="warranties" className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Suche Seriennummer / Gerät / Kunde / Hersteller…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
            <Button variant="outline" onClick={load}>Aktualisieren</Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Seriennummer</TableHead><TableHead>Gerät</TableHead><TableHead>Kunde</TableHead>
                <TableHead>Hersteller</TableHead><TableHead>Beginn</TableHead><TableHead>Ende</TableHead>
                <TableHead>Typ</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Lade…</TableCell></TableRow>}
                {!loading && filteredW.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Garantien.</TableCell></TableRow>}
                {filteredW.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.serial_number}</TableCell>
                    <TableCell>{w.device_name ?? "—"}</TableCell>
                    <TableCell>{w.customer_name ?? "—"}</TableCell>
                    <TableCell>{w.manufacturer ?? "—"}</TableCell>
                    <TableCell>{w.warranty_start ?? "—"}</TableCell>
                    <TableCell>{w.warranty_end ?? "—"}</TableCell>
                    <TableCell>{w.warranty_type ?? "—"}</TableCell>
                    <TableCell>{statusBadge(w.warranty_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="decisions">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead><TableHead>Seriennr.</TableHead><TableHead>Quelle</TableHead>
                <TableHead>Prüfung</TableHead><TableHead>Entscheidung</TableHead>
                <TableHead>Firma €</TableHead><TableHead>Kunde €</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {decisions.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Entscheidungen.</TableCell></TableRow>}
                {decisions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{new Date(d.created_at).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell className="font-mono text-xs">{d.serial_number ?? "—"}</TableCell>
                    <TableCell>{d.source_type}</TableCell>
                    <TableCell>{d.check_result ?? "—"}</TableCell>
                    <TableCell>{decisionBadge(d.decision)}</TableCell>
                    <TableCell>{Number(d.cost_coverage_company ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(d.cost_coverage_customer ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(d); setShowDec(true); }}>Bearbeiten</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="goodwill">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead><TableHead>Seriennr.</TableHead><TableHead>Kunde</TableHead>
                <TableHead>Grund</TableHead><TableHead>Firma €</TableHead><TableHead>Kunde €</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {goodwill.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Kulanzfälle.</TableCell></TableRow>}
                {goodwill.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{new Date(g.created_at).toLocaleDateString("de-DE")}</TableCell>
                    <TableCell className="font-mono text-xs">{g.serial_number ?? "—"}</TableCell>
                    <TableCell>{g.customer_name ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{g.reason ?? "—"}</TableCell>
                    <TableCell>{Number(g.cost_share_company ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(g.cost_share_customer ?? 0).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{g.approval_status}</Badge></TableCell>
                    <TableCell className="flex gap-1">
                      {g.approval_status === "Offen" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => approveGoodwill(g.id, true)}>
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => approveGoodwill(g.id, false)}>
                            <XCircle className="h-3 w-3 text-red-500" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="loaners">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Seriennr.</TableHead><TableHead>Modell</TableHead><TableHead>Kunde</TableHead>
                <TableHead>Ausgegeben</TableHead><TableHead>Zurück</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loaners.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Keine Ersatzgeräteausgaben.</TableCell></TableRow>}
                {loaners.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.serial_number ?? "—"}</TableCell>
                    <TableCell>{l.model_name ?? "—"}</TableCell>
                    <TableCell>{l.customer_name ?? "—"}</TableCell>
                    <TableCell>{l.issued_at ? new Date(l.issued_at).toLocaleDateString("de-DE") : "—"}</TableCell>
                    <TableCell>{l.returned_at ? new Date(l.returned_at).toLocaleDateString("de-DE") : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                    <TableCell>
                      {l.status === "ausgegeben" && (
                        <Button size="sm" variant="outline" onClick={() => markReturned(l.id)}>Rückgabe</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="costs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card><CardHeader><CardTitle className="text-base">Garantiekosten</CardTitle></CardHeader>
              <CardContent><p>Monat: <b>{kpis.monthlyWarranty.toFixed(2)} €</b></p><p>Jahr: <b>{kpis.yearlyWarranty.toFixed(2)} €</b></p><p>Anzahl Fälle: {kpis.countWarranty}</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-base">Kulanzkosten</CardTitle></CardHeader>
              <CardContent><p>Monat: <b>{kpis.monthlyGoodwill.toFixed(2)} €</b></p><p>Jahr: <b>{kpis.yearlyGoodwill.toFixed(2)} €</b></p><p>Anzahl Fälle: {kpis.countGoodwill}</p></CardContent></Card>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Datum</TableHead><TableHead>Typ</TableHead><TableHead>Beschreibung</TableHead>
                <TableHead>Betrag €</TableHead><TableHead>Träger</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {costs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Keine Kostenpositionen.</TableCell></TableRow>}
                {costs.slice(0, 200).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.cost_date ?? "—"}</TableCell>
                    <TableCell>{c.cost_type}</TableCell>
                    <TableCell className="max-w-md truncate">{c.description ?? "—"}</TableCell>
                    <TableCell>{Number(c.total_amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{c.billing_target}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDec} onOpenChange={(o) => { setShowDec(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Entscheidung bearbeiten" : "Neue Garantieprüfung"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Seriennummer</Label><Input value={editing.serial_number ?? ""} onChange={(e) => setEditing({ ...editing, serial_number: e.target.value })} /></div>
              <div><Label>Gerät</Label><Input value={editing.device_name ?? ""} onChange={(e) => setEditing({ ...editing, device_name: e.target.value })} /></div>
              <div><Label>Kunde</Label><Input value={editing.customer_name ?? ""} onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })} /></div>
              <div><Label>Quelle</Label>
                <Select value={editing.source_type ?? "repair_order"} onValueChange={(v) => setEditing({ ...editing, source_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ticket">Ticket</SelectItem>
                    <SelectItem value="repair_order">Reparaturauftrag</SelectItem>
                    <SelectItem value="maintenance">Wartung</SelectItem>
                    <SelectItem value="service_visit">Serviceeinsatz</SelectItem>
                    <SelectItem value="other">Sonstiges</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Reparatur-ID (optional)</Label><Input value={editing.repair_order_id ?? ""} onChange={(e) => setEditing({ ...editing, repair_order_id: e.target.value || null })} /></div>
              <div><Label>Ticket-ID (optional)</Label><Input value={editing.ticket_id ?? ""} onChange={(e) => setEditing({ ...editing, ticket_id: e.target.value || null })} /></div>
              <div><Label>Prüfergebnis</Label>
                <Select value={editing.check_result ?? "Offen"} onValueChange={(v) => setEditing({ ...editing, check_result: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Offen">Offen</SelectItem>
                    <SelectItem value="Garantie">Garantie</SelectItem>
                    <SelectItem value="Kulanz">Kulanz</SelectItem>
                    <SelectItem value="Kostenpflichtig">Kostenpflichtig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Entscheidung</Label>
                <Select value={editing.decision ?? "Offen"} onValueChange={(v) => setEditing({ ...editing, decision: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Offen">Offen</SelectItem>
                    <SelectItem value="Garantie genehmigt">Garantie genehmigt</SelectItem>
                    <SelectItem value="Garantie abgelehnt">Garantie abgelehnt</SelectItem>
                    <SelectItem value="Kulanz genehmigt">Kulanz genehmigt</SelectItem>
                    <SelectItem value="Kulanz teilweise genehmigt">Kulanz teilweise genehmigt</SelectItem>
                    <SelectItem value="Kostenpflichtig">Kostenpflichtig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Kostenanteil Firma €</Label><Input type="number" step="0.01" value={editing.cost_coverage_company ?? 0} onChange={(e) => setEditing({ ...editing, cost_coverage_company: Number(e.target.value) })} /></div>
              <div><Label>Kostenanteil Kunde €</Label><Input type="number" step="0.01" value={editing.cost_coverage_customer ?? 0} onChange={(e) => setEditing({ ...editing, cost_coverage_customer: Number(e.target.value) })} /></div>
              <div className="col-span-2"><Label>Begründung</Label><Textarea value={editing.decision_reason ?? ""} onChange={(e) => setEditing({ ...editing, decision_reason: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDec(false)}>Abbrechen</Button>
            <Button onClick={saveDecision}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon, title, value }: { icon: React.ReactNode; title: string; value: number | string }) {
  return (
    <Card><CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div><p className="text-sm text-muted-foreground">{title}</p><p className="text-2xl font-bold mt-1">{value}</p></div>
        {icon}
      </div>
    </CardContent></Card>
  );
}
