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
import type { EcqmChange } from "@/lib/ecqm/types";

const SCOPES: EcqmChange["scope"][] = ["Software","Gerät","Prozess","Dokument","Lieferant","Produkt"];
const SEV = ["niedrig","mittel","hoch","kritisch"] as const;
const STATUS: EcqmChange["status"][] = ["beantragt","bewertet","freigegeben","abgelehnt","umgesetzt"];

export default function ChangeControl() {
  const [items, setItems] = useState(() => ecqm.changes.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmChange>>({ scope: "Software", impact: "mittel", risk: "mittel", status: "beantragt" });

  const save = () => {
    if (!draft.number || !draft.description) return;
    ecqm.changes.upsert({
      number: draft.number!, scope: draft.scope ?? "Software", description: draft.description!,
      impact: (draft.impact ?? "mittel") as EcqmChange["impact"], risk: (draft.risk ?? "mittel") as EcqmChange["risk"],
      status: (draft.status ?? "beantragt") as EcqmChange["status"],
    });
    setItems(ecqm.changes.list()); setOpen(false);
    setDraft({ scope: "Software", impact: "mittel", risk: "mittel", status: "beantragt" });
  };
  const del = (id: string) => { ecqm.changes.softDelete(id); setItems(ecqm.changes.list()); };

  return (
    <>
      <EcqmPageHeader title="Änderungsmanagement (Change Control)" subtitle="Änderungen an Software, Geräten, Prozessen, Dokumenten, Lieferanten und Produkten."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neuer Change</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Neuer Change</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nummer</Label><Input value={draft.number ?? ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></div>
                <div>
                  <Label>Bereich</Label>
                  <Select value={draft.scope} onValueChange={(v) => setDraft({ ...draft, scope: v as EcqmChange["scope"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SCOPES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                <div>
                  <Label>Auswirkung</Label>
                  <Select value={draft.impact} onValueChange={(v) => setDraft({ ...draft, impact: v as EcqmChange["impact"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEV.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risiko</Label>
                  <Select value={draft.risk} onValueChange={(v) => setDraft({ ...draft, risk: v as EcqmChange["risk"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEV.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EcqmChange["status"] })}>
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
        {items.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center flex-wrap gap-2">
                  <span className="text-sm font-semibold">{c.number}</span>
                  <Badge variant="outline">{c.scope}</Badge>
                  <Badge variant="secondary">{c.status}</Badge>
                  <Badge>Auswirkung: {c.impact}</Badge>
                  <Badge>Risiko: {c.risk}</Badge>
                </div>
                <div className="mt-1 text-sm">{c.description}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Keine Änderungen erfasst.</p>}
      </div>
    </>
  );
}
