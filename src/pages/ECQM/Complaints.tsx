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
import type { EcqmComplaint } from "@/lib/ecqm/types";

const SOURCES: EcqmComplaint["source"][] = ["Kunde", "Intern", "Lieferant", "Produkt", "Service", "Schulung"];
const STATUS: EcqmComplaint["status"][] = ["offen", "in Bearbeitung", "geschlossen"];
const SEV = ["niedrig","mittel","hoch","kritisch"] as const;

export default function Complaints() {
  const [items, setItems] = useState(() => ecqm.complaints.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmComplaint>>({ source: "Kunde", status: "offen", severity: "mittel" });

  const save = () => {
    if (!draft.number || !draft.description) return;
    ecqm.complaints.upsert({
      number: draft.number!, source: draft.source ?? "Kunde", description: draft.description!,
      customerRef: draft.customerRef, deviceRef: draft.deviceRef, serviceRef: draft.serviceRef, batch: draft.batch,
      status: (draft.status ?? "offen") as EcqmComplaint["status"],
      severity: (draft.severity ?? "mittel") as EcqmComplaint["severity"],
    });
    setItems(ecqm.complaints.list()); setOpen(false);
    setDraft({ source: "Kunde", status: "offen", severity: "mittel" });
  };
  const del = (id: string) => { ecqm.complaints.softDelete(id); setItems(ecqm.complaints.list()); };

  return (
    <>
      <EcqmPageHeader title="Reklamationen" subtitle="Kunden-, Lieferanten- und interne Reklamationen mit Rückverfolgung."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neue Reklamation</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Neue Reklamation</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nummer</Label><Input value={draft.number ?? ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></div>
                <div>
                  <Label>Quelle</Label>
                  <Select value={draft.source} onValueChange={(v) => setDraft({ ...draft, source: v as EcqmComplaint["source"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                <div><Label>Kunde</Label><Input value={draft.customerRef ?? ""} onChange={(e) => setDraft({ ...draft, customerRef: e.target.value })} /></div>
                <div><Label>Gerät / SN</Label><Input value={draft.deviceRef ?? ""} onChange={(e) => setDraft({ ...draft, deviceRef: e.target.value })} /></div>
                <div><Label>Service-Ref</Label><Input value={draft.serviceRef ?? ""} onChange={(e) => setDraft({ ...draft, serviceRef: e.target.value })} /></div>
                <div><Label>Charge</Label><Input value={draft.batch ?? ""} onChange={(e) => setDraft({ ...draft, batch: e.target.value })} /></div>
                <div>
                  <Label>Schwere</Label>
                  <Select value={draft.severity} onValueChange={(v) => setDraft({ ...draft, severity: v as EcqmComplaint["severity"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEV.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EcqmComplaint["status"] })}>
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
              <th className="p-3">Nummer</th><th className="p-3">Quelle</th><th className="p-3">Beschreibung</th>
              <th className="p-3">Kunde</th><th className="p-3">Gerät</th><th className="p-3">Schwere</th>
              <th className="p-3">Status</th><th className="p-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-border/40 hover:bg-accent/30">
                <td className="p-3 font-medium">{c.number}</td>
                <td className="p-3"><Badge variant="outline">{c.source}</Badge></td>
                <td className="p-3">{c.description}</td>
                <td className="p-3 text-muted-foreground">{c.customerRef ?? "-"}</td>
                <td className="p-3 text-muted-foreground">{c.deviceRef ?? "-"}</td>
                <td className="p-3"><Badge>{c.severity}</Badge></td>
                <td className="p-3"><Badge variant={c.status === "geschlossen" ? "default" : "secondary"}>{c.status}</Badge></td>
                <td className="p-3"><Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Keine Reklamationen.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
