import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import type { EcqmRisk } from "@/lib/ecqm/types";

const STATUS: EcqmRisk["status"][] = ["offen", "in Behandlung", "akzeptiert", "abgeschlossen"];

export default function Risks() {
  const [items, setItems] = useState(() => ecqm.risks.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmRisk>>({ probability: 3, impact: 3, status: "offen" });

  const save = () => {
    if (!draft.number || !draft.description || !draft.category) return;
    ecqm.risks.upsert({
      number: draft.number!, category: draft.category!, description: draft.description!,
      probability: Number(draft.probability ?? 3) as EcqmRisk["probability"],
      impact: Number(draft.impact ?? 3) as EcqmRisk["impact"],
      actions: draft.actions, owner: draft.owner ?? "QMB",
      status: (draft.status ?? "offen") as EcqmRisk["status"],
    });
    setItems(ecqm.risks.list()); setOpen(false); setDraft({ probability: 3, impact: 3, status: "offen" });
  };
  const del = (id: string) => { ecqm.risks.softDelete(id); setItems(ecqm.risks.list()); };

  // 5x5 matrix
  const matrix = Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) =>
      items.filter((x) => x.probability === (5 - r) && x.impact === (c + 1)),
    ),
  );
  const cellClass = (p: number, i: number) => {
    const score = p * i;
    if (score >= 15) return "bg-rose-500/20 border-rose-500/40";
    if (score >= 8) return "bg-amber-500/20 border-amber-500/40";
    return "bg-emerald-500/10 border-emerald-500/30";
  };

  return (
    <>
      <EcqmPageHeader title="Risikomanagement" subtitle="Risikoregister mit 5×5-Matrix (Wahrscheinlichkeit × Auswirkung)."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neues Risiko</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Neues Risiko</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nummer</Label><Input value={draft.number ?? ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></div>
                <div><Label>Kategorie</Label><Input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
                <div className="col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                <div><Label>Wahrscheinlichkeit (1-5)</Label><Input type="number" min={1} max={5} value={draft.probability ?? 3} onChange={(e) => setDraft({ ...draft, probability: Number(e.target.value) as EcqmRisk["probability"] })} /></div>
                <div><Label>Auswirkung (1-5)</Label><Input type="number" min={1} max={5} value={draft.impact ?? 3} onChange={(e) => setDraft({ ...draft, impact: Number(e.target.value) as EcqmRisk["impact"] })} /></div>
                <div className="col-span-2"><Label>Maßnahmen</Label><Textarea rows={2} value={draft.actions ?? ""} onChange={(e) => setDraft({ ...draft, actions: e.target.value })} /></div>
                <div><Label>Verantwortlich</Label><Input value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EcqmRisk["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={save}>Speichern</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Risikomatrix</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-[24px_repeat(5,1fr)] gap-1 text-[10px]">
              <div />
              {[1,2,3,4,5].map((c) => (<div key={c} className="text-center text-muted-foreground">A{c}</div>))}
              {matrix.map((row, ri) => (
                <>
                  <div key={`p${ri}`} className="text-muted-foreground text-right pr-1 self-center">P{5-ri}</div>
                  {row.map((cell, ci) => (
                    <div key={`${ri}-${ci}`} className={`h-14 rounded border ${cellClass(5-ri, ci+1)} p-1 text-[10px] overflow-hidden`}>
                      {cell.map((x) => (<div key={x.id} className="truncate" title={x.description}>{x.number}</div>))}
                    </div>
                  ))}
                </>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {items.map((r) => {
            const score = r.probability * r.impact;
            const tone = score >= 15 ? "text-rose-500" : score >= 8 ? "text-amber-500" : "text-emerald-500";
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{r.number} · {r.category}</div>
                    <div className="text-sm">{r.description}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Verantwortlich: {r.owner} · Status: {r.status}</div>
                  </div>
                  <div className={`text-right ${tone}`}>
                    <div className="text-xs">P{r.probability} × A{r.impact}</div>
                    <div className="text-2xl font-semibold">{score}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            );
          })}
          {items.length === 0 && <p className="text-sm text-muted-foreground">Keine Risiken.</p>}
        </div>
      </div>
    </>
  );
}
