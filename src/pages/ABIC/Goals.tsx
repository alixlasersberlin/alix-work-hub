import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { abicStore } from "@/lib/abic/store";
import type { AbicGoal } from "@/lib/abic/types";

export default function Goals() {
  const [items, setItems] = useState<AbicGoal[]>(() => abicStore.listGoals());
  const [draft, setDraft] = useState<Partial<AbicGoal>>({ period: "month" });

  const save = () => {
    if (!draft.label || draft.target === undefined) return;
    const g: AbicGoal = {
      id: crypto.randomUUID(),
      label: draft.label!,
      target: Number(draft.target),
      actual: Number(draft.actual ?? 0),
      unit: draft.unit,
      period: (draft.period ?? "month") as AbicGoal["period"],
    };
    abicStore.upsertGoal(g); setItems(abicStore.listGoals());
    setDraft({ period: "month" });
  };
  const remove = (id: string) => { abicStore.removeGoal(id); setItems(abicStore.listGoals()); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Zielverfolgung</h1>
        <p className="text-sm text-muted-foreground">Unternehmensziele definieren und Soll/Ist verfolgen.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Neues Ziel</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2"><Label>Bezeichnung</Label><Input value={draft.label ?? ""} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></div>
          <div><Label>Soll</Label><Input type="number" value={draft.target ?? ""} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })} /></div>
          <div><Label>Ist</Label><Input type="number" value={draft.actual ?? ""} onChange={(e) => setDraft({ ...draft, actual: Number(e.target.value) })} /></div>
          <div><Label>Einheit</Label><Input value={draft.unit ?? ""} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></div>
          <div>
            <Label>Periode</Label>
            <Select value={draft.period} onValueChange={(v) => setDraft({ ...draft, period: v as AbicGoal["period"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["day","week","month","quarter","year"] as const).map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6"><Button onClick={save}>Speichern</Button></div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((g) => {
          const pct = Math.min(100, (g.actual / Math.max(1, g.target)) * 100);
          const good = pct >= 100;
          return (
            <Card key={g.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{g.label}</div>
                    <div className="text-xs text-muted-foreground">{g.period}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-xl font-semibold tabular-nums">{g.actual.toLocaleString("de-DE")} <span className="text-xs text-muted-foreground">/ {g.target.toLocaleString("de-DE")} {g.unit}</span></div>
                  <div className={`flex items-center gap-1 text-xs ${good ? "text-emerald-500" : "text-amber-500"}`}>
                    {good ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {pct.toFixed(0)} %
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-500" style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Keine Ziele definiert.</p>}
      </div>
    </div>
  );
}
