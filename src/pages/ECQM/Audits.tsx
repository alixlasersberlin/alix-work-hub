import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import type { EcqmAudit } from "@/lib/ecqm/types";

const TYPES: EcqmAudit["type"][] = ["Intern", "Lieferant", "Extern", "Behörde", "ISO", "MDR"];
const STATUS: EcqmAudit["status"][] = ["geplant", "laufend", "abgeschlossen"];

export default function Audits() {
  const [items, setItems] = useState(() => ecqm.audits.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmAudit>>({ type: "Intern", status: "geplant" });

  const save = () => {
    if (!draft.number || !draft.title || !draft.scheduledFor) return;
    ecqm.audits.upsert({
      number: draft.number!, title: draft.title!, type: draft.type ?? "Intern",
      scheduledFor: draft.scheduledFor!, auditor: draft.auditor ?? "-",
      status: (draft.status ?? "geplant") as EcqmAudit["status"],
    });
    setItems(ecqm.audits.list()); setOpen(false); setDraft({ type: "Intern", status: "geplant" });
  };
  const del = (id: string) => { ecqm.audits.softDelete(id); setItems(ecqm.audits.list()); };

  return (
    <>
      <EcqmPageHeader title="Auditmanagement" subtitle="Interne, Lieferanten-, Behörden- und Zertifizierungsaudits."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neues Audit</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues Audit</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nummer</Label><Input value={draft.number ?? ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></div>
                <div>
                  <Label>Typ</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as EcqmAudit["type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Titel</Label><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
                <div><Label>Termin</Label><Input type="date" value={draft.scheduledFor ?? ""} onChange={(e) => setDraft({ ...draft, scheduledFor: e.target.value })} /></div>
                <div><Label>Auditor</Label><Input value={draft.auditor ?? ""} onChange={(e) => setDraft({ ...draft, auditor: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EcqmAudit["status"] })}>
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

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((a) => {
          const overdue = a.status !== "abgeschlossen" && new Date(a.scheduledFor) < new Date();
          return (
            <Card key={a.id} className={overdue ? "border-rose-500/40" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{a.number} · {a.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">{a.type}</Badge>
                      <Badge variant="secondary">{a.status}</Badge>
                      {overdue && <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/40">überfällig</Badge>}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">Auditor: {a.auditor} · Termin: {a.scheduledFor}</div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => del(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Keine Audits.</p>}
      </div>
    </>
  );
}
