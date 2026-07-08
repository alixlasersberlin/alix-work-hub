import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Star, Trash2 } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import type { EcqmSupplier } from "@/lib/ecqm/types";

export default function Suppliers() {
  const [items, setItems] = useState(() => ecqm.suppliers.list());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmSupplier>>({ rating: 3, approved: true, performance: 80, complaints: 0 });

  const save = () => {
    if (!draft.name) return;
    ecqm.suppliers.upsert({
      name: draft.name!, rating: (draft.rating ?? 3) as EcqmSupplier["rating"], approved: !!draft.approved,
      isoCert: draft.isoCert, contracts: [], lastAudit: draft.lastAudit,
      performance: Number(draft.performance ?? 0), complaints: Number(draft.complaints ?? 0),
    });
    setItems(ecqm.suppliers.list()); setOpen(false);
    setDraft({ rating: 3, approved: true, performance: 80, complaints: 0 });
  };
  const del = (id: string) => { ecqm.suppliers.softDelete(id); setItems(ecqm.suppliers.list()); };

  return (
    <>
      <EcqmPageHeader title="Lieferantenmanagement" subtitle="Bewertung, Freigabestatus, ISO-Nachweise, Performance."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neu</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Lieferant</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name</Label><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
                <div><Label>Bewertung (1-5)</Label><Input type="number" min={1} max={5} value={draft.rating ?? 3} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) as EcqmSupplier["rating"] })} /></div>
                <div><Label>Freigegeben</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={String(!!draft.approved)} onChange={(e) => setDraft({ ...draft, approved: e.target.value === "true" })}>
                    <option value="true">Ja</option><option value="false">Nein</option>
                  </select>
                </div>
                <div><Label>ISO-Zertifikat</Label><Input value={draft.isoCert ?? ""} onChange={(e) => setDraft({ ...draft, isoCert: e.target.value })} /></div>
                <div><Label>Letztes Audit</Label><Input type="date" value={draft.lastAudit ?? ""} onChange={(e) => setDraft({ ...draft, lastAudit: e.target.value })} /></div>
                <div><Label>Performance (0-100)</Label><Input type="number" min={0} max={100} value={draft.performance ?? 0} onChange={(e) => setDraft({ ...draft, performance: Number(e.target.value) })} /></div>
                <div><Label>Reklamationen</Label><Input type="number" min={0} value={draft.complaints ?? 0} onChange={(e) => setDraft({ ...draft, complaints: Number(e.target.value) })} /></div>
              </div>
              <Button onClick={save}>Speichern</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < s.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
                      ))}
                    </div>
                    <Badge variant={s.approved ? "default" : "secondary"}>{s.approved ? "freigegeben" : "gesperrt"}</Badge>
                    {s.isoCert && <Badge variant="outline">{s.isoCert}</Badge>}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div><div className="text-foreground tabular-nums">{s.performance ?? 0}%</div>Performance</div>
                    <div><div className="text-foreground tabular-nums">{s.complaints ?? 0}</div>Reklamationen</div>
                    <div><div className="text-foreground tabular-nums">{s.lastAudit ?? "-"}</div>Letztes Audit</div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Keine Lieferanten.</p>}
      </div>
    </>
  );
}
