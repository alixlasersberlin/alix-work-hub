import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, GitBranch } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import type { EcqmProcess } from "@/lib/ecqm/types";

const TYPES: EcqmProcess["type"][] = ["Kern", "Führung", "Unterstützung"];

export default function Processes() {
  const [items, setItems] = useState(() => ecqm.processes.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmProcess>>({ type: "Kern" });

  const save = () => {
    if (!draft.code || !draft.name) return;
    ecqm.processes.upsert({
      code: draft.code!, name: draft.name!, type: draft.type ?? "Kern",
      owner: draft.owner ?? "-", description: draft.description,
    });
    setItems(ecqm.processes.list()); setOpen(false); setDraft({ type: "Kern" });
  };
  const del = (id: string) => { ecqm.processes.softDelete(id); setItems(ecqm.processes.list()); };

  const groups = { "Führung": [], "Kern": [], "Unterstützung": [] } as Record<EcqmProcess["type"], typeof items>;
  items.forEach((p) => { groups[p.type].push(p); });

  return (
    <>
      <EcqmPageHeader title="Prozessmanagement" subtitle="Prozesslandkarte mit Führungs-, Kern- und Unterstützungsprozessen."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neu</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Prozess</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={draft.code ?? ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></div>
                <div>
                  <Label>Typ</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as EcqmProcess["type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Name</Label><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div className="col-span-2"><Label>Beschreibung</Label><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
                <div><Label>Verantwortlich</Label><Input value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></div>
              </div>
              <Button onClick={save}>Speichern</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {(TYPES as EcqmProcess["type"][]).map((type) => (
          <Card key={type}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-wide text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5" />{type}sprozesse
              </div>
              <div className="space-y-2">
                {groups[type].map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 rounded-md border border-border/60 p-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{p.code} · {p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.description ?? p.owner}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {groups[type].length === 0 && <p className="text-xs text-muted-foreground">Keine Prozesse.</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
