import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Play } from "lucide-react";
import { abicStore } from "@/lib/abic/store";
import type { AbicReportDef } from "@/lib/abic/types";
import { toast } from "sonner";

export default function Reports() {
  const [items, setItems] = useState<AbicReportDef[]>(() => abicStore.listReports());
  const [draft, setDraft] = useState<Partial<AbicReportDef>>({ cadence: "weekly", format: "pdf" });

  const save = () => {
    if (!draft.name) return;
    const rep: AbicReportDef = {
      id: crypto.randomUUID(),
      name: draft.name!,
      description: draft.description,
      cadence: draft.cadence ?? "weekly",
      blocks: [{ type: "kpi", ref: "executive" }, { type: "chart", ref: "rev_trend" }],
      recipients: draft.recipients ?? [],
      format: draft.format ?? "pdf",
      createdAt: new Date().toISOString(),
    };
    abicStore.upsertReport(rep);
    setItems(abicStore.listReports());
    setDraft({ cadence: "weekly", format: "pdf" });
  };
  const remove = (id: string) => { abicStore.removeReport(id); setItems(abicStore.listReports()); };
  const run = (r: AbicReportDef) => {
    abicStore.audit({ action: "report", target: r.id, meta: { name: r.name } });
    toast.success(`Bericht „${r.name}" generiert (Vorschau)`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Automatische Berichte und Report Designer. Versand per E-Mail vorbereitet.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Neuer Bericht</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Input value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Turnus</Label>
                <Select value={draft.cadence} onValueChange={(v) => setDraft({ ...draft, cadence: v as AbicReportDef["cadence"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["daily","weekly","monthly","quarterly","yearly","adhoc"] as const).map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Format</Label>
                <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v as AbicReportDef["format"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["pdf","excel","csv"] as const).map((c) => (<SelectItem key={c} value={c}>{c.toUpperCase()}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={save} className="w-full">Speichern</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Berichte</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Berichte definiert.</p>
            ) : (
              <div className="space-y-2">
                {items.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.cadence} · {r.format.toUpperCase()}{r.description ? ` · ${r.description}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => run(r)}><Play className="h-4 w-4 mr-1" /> Generieren</Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
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
