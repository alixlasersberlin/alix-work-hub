import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { abicStore } from "@/lib/abic/store";
import type { AbicKpiDef } from "@/lib/abic/types";

export default function KpiDesigner() {
  const [items, setItems] = useState<AbicKpiDef[]>(() => abicStore.listKpis());
  const [draft, setDraft] = useState<Partial<AbicKpiDef>>({ category: "Vertrieb" });

  const save = () => {
    if (!draft.name || !draft.formula) return;
    const kpi: AbicKpiDef = {
      id: crypto.randomUUID(),
      name: draft.name!,
      formula: draft.formula!,
      unit: draft.unit,
      category: draft.category ?? "Allgemein",
      createdAt: new Date().toISOString(),
    };
    abicStore.upsertKpi(kpi);
    setItems(abicStore.listKpis());
    setDraft({ category: "Vertrieb" });
  };
  const remove = (id: string) => { abicStore.removeKpi(id); setItems(abicStore.listKpis()); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">KPI Designer</h1>
        <p className="text-sm text-muted-foreground">Eigene Kennzahlen definieren. Beispiele: Umsatz pro Mitarbeiter, Servicequote, No-Show-Rate.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Neue KPI</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="z. B. Umsatz pro Mitarbeiter" /></div>
            <div><Label>Formel / Beschreibung</Label><Textarea value={draft.formula ?? ""} onChange={(e) => setDraft({ ...draft, formula: e.target.value })} placeholder="Umsatz(Monat) / aktive Mitarbeiter" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Einheit</Label><Input value={draft.unit ?? ""} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="€ / %" /></div>
              <div><Label>Kategorie</Label><Input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
            </div>
            <Button onClick={save} className="w-full">Speichern</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Definierte KPIs</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine KPIs definiert.</p>
            ) : (
              <div className="space-y-2">
                {items.map((k) => (
                  <div key={k.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                    <div>
                      <div className="text-sm font-medium">{k.name} <span className="text-xs text-muted-foreground">· {k.category}</span></div>
                      <div className="text-xs text-muted-foreground">{k.formula}{k.unit ? ` · ${k.unit}` : ""}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(k.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
