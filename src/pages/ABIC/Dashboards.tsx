import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Trash2 } from "lucide-react";
import { abicStore } from "@/lib/abic/store";
import type { AbicDashboardDef } from "@/lib/abic/types";

export default function Dashboards() {
  const [items, setItems] = useState<AbicDashboardDef[]>(() => abicStore.listDashboards());
  const [name, setName] = useState("");

  const create = () => {
    if (!name) return;
    const d: AbicDashboardDef = {
      id: crypto.randomUUID(),
      name,
      widgets: [
        { id: "w1", type: "kpi", x: 0, y: 0, w: 3, h: 1, ref: "rev_month" },
        { id: "w2", type: "chart", x: 3, y: 0, w: 6, h: 2, ref: "rev_trend" },
      ],
      updatedAt: new Date().toISOString(),
    };
    abicStore.upsertDashboard(d);
    setItems(abicStore.listDashboards()); setName("");
  };
  const remove = (id: string) => { abicStore.removeDashboard(id); setItems(abicStore.listDashboards()); };
  const fav = (id: string) => {
    const d = items.find((x) => x.id === id); if (!d) return;
    abicStore.upsertDashboard({ ...d, favorite: !d.favorite, updatedAt: new Date().toISOString() });
    setItems(abicStore.listDashboards());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboards</h1>
        <p className="text-sm text-muted-foreground">Eigene Dashboards mit verschiebbaren Widgets bauen und favorisieren.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Neues Dashboard</CardTitle></CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="flex-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Vertriebsleitung" /></div>
          <Button onClick={create}>Erstellen</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((d) => (
          <Card key={d.id} className="relative">
            <CardHeader className="flex-row items-start justify-between pb-2">
              <div>
                <CardTitle className="text-base">{d.name}</CardTitle>
                <p className="text-xs text-muted-foreground">{d.widgets.length} Widgets · aktualisiert {new Date(d.updatedAt).toLocaleDateString("de-DE")}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => fav(d.id)}>
                  <Star className={d.favorite ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4"} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {d.widgets.map((w) => (
                  <div key={w.id} className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                    {w.type}: {w.ref}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Dashboards.</p>}
      </div>
    </div>
  );
}
