import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Brain, RefreshCw, Trash2, Play } from "lucide-react";

type Rule = {
  id: string;
  pattern: string;
  field: string | null;
  target_type: string;
  target_id: string | null;
  target_category_id: string | null;
  weight_bonus: number;
  hit_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const typeLabel = (t: string) =>
  t === "order" ? "Auftrag" : t === "customer" ? "Kunde" : t === "device" ? "Gerät" : t;

export default function AlixDocsLearnRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [lastSummary, setLastSummary] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("alixdocs_matching_rules")
      .select("*")
      .order("hit_count", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRules((data as Rule[]) ?? []);
    setLoading(false);

    const byType: Record<string, string[]> = {};
    (data ?? []).forEach((r: any) => {
      if (!r.target_id) return;
      byType[r.target_type] = byType[r.target_type] ?? [];
      byType[r.target_type].push(r.target_id);
    });
    const lab: Record<string, string> = {};
    if (byType.order?.length) {
      const { data: os } = await supabase
        .from("orders").select("id, order_number, customer_name")
        .in("id", byType.order.slice(0, 200));
      (os ?? []).forEach((o: any) => (lab[o.id] = `${o.order_number} · ${o.customer_name ?? ""}`));
    }
    if (byType.customer?.length) {
      const { data: cs } = await supabase
        .from("customers").select("id, name, customer_no")
        .in("id", byType.customer.slice(0, 200));
      (cs ?? []).forEach((c: any) => (lab[c.id] = `${c.customer_no ?? ""} · ${c.name ?? ""}`));
    }
    if (byType.device?.length) {
      const { data: ds } = await supabase
        .from("lager_devices").select("id, serial_number, model")
        .in("id", byType.device.slice(0, 200));
      (ds ?? []).forEach((d: any) => (lab[d.id] = `${d.serial_number ?? ""} · ${d.model ?? ""}`));
    }
    setLabels(lab);
  };

  useEffect(() => { load(); }, []);

  const runLearning = async (dry = false) => {
    setRunning(true);
    setLastSummary(null);
    try {
      const { data, error } = await supabase.functions.invoke("alixdocs-learn-rules", {
        body: { since_days: 90, dry_run: dry },
      });
      if (error) throw error;
      setLastSummary(data?.summary);
      toast.success(dry ? "Vorschau erzeugt" : "Lernlauf abgeschlossen");
      if (!dry) await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Fehler");
    } finally {
      setRunning(false);
    }
  };

  const toggle = async (r: Rule) => {
    const { error } = await supabase
      .from("alixdocs_matching_rules")
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active: !r.is_active } : x)));
  };

  const remove = async (r: Rule) => {
    if (!confirm(`Regel „${r.pattern}" wirklich löschen?`)) return;
    const { error } = await supabase.from("alixdocs_matching_rules").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    setRules((prev) => prev.filter((x) => x.id !== r.id));
  };

  const updateBonus = async (r: Rule, v: number) => {
    const { error } = await supabase
      .from("alixdocs_matching_rules")
      .update({ weight_bonus: v, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, weight_bonus: v } : x)));
  };

  const filtered = rules.filter((r) => {
    if (!showInactive && !r.is_active) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      r.pattern.toLowerCase().includes(q) ||
      typeLabel(r.target_type).toLowerCase().includes(q) ||
      (labels[r.target_id ?? ""] ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" /> AlixDocs Lern-Regeln
          </h1>
          <p className="text-sm text-muted-foreground">
            Etappe 4 — die KI leitet aus Deinen Zuordnungs-Entscheidungen Regeln ab und
            verstärkt zukünftige Auto-Zuordnungen.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runLearning(true)} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Vorschau (Dry-Run)
          </Button>
          <Button onClick={() => runLearning(false)} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            Lernlauf starten
          </Button>
          <Button variant="ghost" size="icon" onClick={load} title="Neu laden">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {lastSummary && (
        <Card>
          <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div><div className="text-muted-foreground">Feedback</div><div className="text-xl font-semibold">{lastSummary.feedback_count}</div></div>
            <div><div className="text-muted-foreground">Kombinationen</div><div className="text-xl font-semibold">{lastSummary.combinations}</div></div>
            <div><div className="text-muted-foreground">Neu</div><div className="text-xl font-semibold text-emerald-500">+{lastSummary.new_rules}</div></div>
            <div><div className="text-muted-foreground">Aktualisiert</div><div className="text-xl font-semibold text-amber-500">{lastSummary.updated_rules}</div></div>
            <div><div className="text-muted-foreground">Deaktiviert</div><div className="text-xl font-semibold text-rose-500">{lastSummary.deactivated_rules}</div></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle>Gelernte Regeln ({filtered.length})</CardTitle>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Suche Muster / Ziel…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-64"
            />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              Inaktive zeigen
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Noch keine Regeln vorhanden. Starte den Lernlauf, sobald Feedback in Smart Review vorliegt.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Muster</TableHead>
                    <TableHead>Feld</TableHead>
                    <TableHead>Ziel-Typ</TableHead>
                    <TableHead>Ziel</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Treffer</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className={!r.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-mono">{r.pattern}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.field ?? "filename"}</Badge>
                      </TableCell>
                      <TableCell>{typeLabel(r.target_type)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {labels[r.target_id ?? ""] ?? r.target_id ?? "–"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={r.weight_bonus}
                          onChange={(e) => updateBonus(r, Number(e.target.value))}
                          className="w-20 h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">{r.hit_count}</TableCell>
                      <TableCell>
                        <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
