import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import type { EcqmTrainingRecord } from "@/lib/ecqm/types";

const STATUS: EcqmTrainingRecord["status"][] = ["offen", "absolviert", "abgelaufen"];

export default function Trainings() {
  const [items, setItems] = useState(() => ecqm.trainings.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmTrainingRecord>>({ mandatory: true, status: "offen" });

  const save = () => {
    if (!draft.employee || !draft.training) return;
    ecqm.trainings.upsert({
      employee: draft.employee!, training: draft.training!,
      completedAt: draft.completedAt, expiresAt: draft.expiresAt,
      mandatory: !!draft.mandatory, status: (draft.status ?? "offen") as EcqmTrainingRecord["status"],
    });
    setItems(ecqm.trainings.list()); setOpen(false);
    setDraft({ mandatory: true, status: "offen" });
  };
  const del = (id: string) => { ecqm.trainings.softDelete(id); setItems(ecqm.trainings.list()); };

  return (
    <>
      <EcqmPageHeader title="Schulungsnachweise" subtitle="Pflichtschulungen, Auffrischungen, Ablaufdaten, Lesebestätigungen."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nachweis</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Schulungsnachweis</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Mitarbeiter</Label><Input value={draft.employee ?? ""} onChange={(e) => setDraft({ ...draft, employee: e.target.value })} /></div>
                <div><Label>Schulung</Label><Input value={draft.training ?? ""} onChange={(e) => setDraft({ ...draft, training: e.target.value })} /></div>
                <div><Label>Absolviert am</Label><Input type="date" value={draft.completedAt ?? ""} onChange={(e) => setDraft({ ...draft, completedAt: e.target.value })} /></div>
                <div><Label>Ablauf</Label><Input type="date" value={draft.expiresAt ?? ""} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} /></div>
                <div><Label>Pflicht</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={String(!!draft.mandatory)} onChange={(e) => setDraft({ ...draft, mandatory: e.target.value === "true" })}>
                    <option value="true">Ja</option><option value="false">Nein</option>
                  </select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EcqmTrainingRecord["status"] })}>
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

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/60">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="p-3">Mitarbeiter</th><th className="p-3">Schulung</th>
              <th className="p-3">Pflicht</th><th className="p-3">Absolviert</th><th className="p-3">Ablauf</th>
              <th className="p-3">Status</th><th className="p-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t border-border/40 hover:bg-accent/30">
                <td className="p-3">{t.employee}</td>
                <td className="p-3">{t.training}</td>
                <td className="p-3">{t.mandatory ? <Badge>Pflicht</Badge> : <Badge variant="outline">opt.</Badge>}</td>
                <td className="p-3 text-muted-foreground">{t.completedAt ?? "-"}</td>
                <td className="p-3 text-muted-foreground">{t.expiresAt ?? "-"}</td>
                <td className="p-3"><Badge variant={t.status === "absolviert" ? "default" : "secondary"}>{t.status}</Badge></td>
                <td className="p-3"><Button variant="ghost" size="icon" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Keine Nachweise.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
