import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import type { EcqmCapa } from "@/lib/ecqm/types";

const TRIGGERS: EcqmCapa["trigger"][] = ["Audit", "Reklamation", "Interner Fehler", "Risiko", "Sonstiges"];
const STATUS: EcqmCapa["status"][] = ["offen", "in Arbeit", "wirksam geprüft", "geschlossen"];

export default function Capa() {
  const [items, setItems] = useState(() => ecqm.capas.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmCapa>>({ trigger: "Audit", status: "offen" });

  const save = () => {
    if (!draft.number || !draft.description) return;
    ecqm.capas.upsert({
      number: draft.number!, trigger: draft.trigger ?? "Audit", description: draft.description!,
      rootCause: draft.rootCause, immediate: draft.immediate, corrective: draft.corrective, preventive: draft.preventive,
      owner: draft.owner ?? "QMB", due: draft.due, status: (draft.status ?? "offen") as EcqmCapa["status"],
    });
    setItems(ecqm.capas.list()); setOpen(false); setDraft({ trigger: "Audit", status: "offen" });
  };
  const del = (id: string) => { ecqm.capas.softDelete(id); setItems(ecqm.capas.list()); };

  return (
    <>
      <EcqmPageHeader title="CAPA Management" subtitle="Korrektur- und Vorbeugungsmaßnahmen inkl. Wirksamkeitsprüfung."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neue CAPA</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Neue CAPA</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nummer</Label><Input value={draft.number ?? ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></div>
                <div>
                  <Label>Auslöser</Label>
                  <Select value={draft.trigger} onValueChange={(v) => setDraft({ ...draft, trigger: v as EcqmCapa["trigger"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRIGGERS.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                <div className="col-span-2"><Label>Root Cause</Label><Textarea rows={2} value={draft.rootCause ?? ""} onChange={(e) => setDraft({ ...draft, rootCause: e.target.value })} /></div>
                <div><Label>Sofortmaßnahme</Label><Input value={draft.immediate ?? ""} onChange={(e) => setDraft({ ...draft, immediate: e.target.value })} /></div>
                <div><Label>Korrekturmaßnahme</Label><Input value={draft.corrective ?? ""} onChange={(e) => setDraft({ ...draft, corrective: e.target.value })} /></div>
                <div><Label>Vorbeugung</Label><Input value={draft.preventive ?? ""} onChange={(e) => setDraft({ ...draft, preventive: e.target.value })} /></div>
                <div><Label>Verantwortlich</Label><Input value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></div>
                <div><Label>Frist</Label><Input type="date" value={draft.due ?? ""} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EcqmCapa["status"] })}>
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

      <div className="grid gap-3">
        {items.map((c) => {
          const overdue = c.due && new Date(c.due) < new Date() && c.status !== "geschlossen";
          return (
            <Card key={c.id} className={overdue ? "border-rose-500/40" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{c.number}</span>
                      <Badge variant="outline">{c.trigger}</Badge>
                      <Badge variant={c.status === "geschlossen" ? "default" : "secondary"}>{c.status}</Badge>
                      {overdue && <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/40">überfällig</Badge>}
                    </div>
                    <div className="mt-1 text-sm">{c.description}</div>
                    {c.rootCause && <div className="mt-1 text-xs text-muted-foreground">Ursache: {c.rootCause}</div>}
                    <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                      <span>Verantwortlich: {c.owner}</span>
                      <span>Frist: {c.due ?? "-"}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Keine CAPAs.</p>}
      </div>
    </>
  );
}
