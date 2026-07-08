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
import { Trash2, Plus, Filter } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import type { EcqmDocument } from "@/lib/ecqm/types";

const STATUS = ["entwurf", "pruefung", "freigegeben", "archiviert", "abgelaufen"] as const;
const TYPES: EcqmDocument["type"][] = ["SOP","Arbeitsanweisung","Prozess","Formblatt","Checkliste","Qualitätsrichtlinie","Validierung","Prüfprotokoll","Risikoakte","Technische Doku","Herstellererklärung","MDR","ISO"];

export default function Documents({ onlySop = false }: { onlySop?: boolean }) {
  const [items, setItems] = useState(() => ecqm.documents.list());
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<EcqmDocument>>({ type: onlySop ? "SOP" : "SOP", status: "entwurf", version: "0.1" });

  const filtered = items
    .filter((d) => onlySop ? d.type === "SOP" : true)
    .filter((d) => !statusFilter || d.status === statusFilter)
    .filter((d) => !q || `${d.number} ${d.title} ${d.owner}`.toLowerCase().includes(q.toLowerCase()));

  const save = () => {
    if (!draft.title || !draft.number) return;
    ecqm.documents.upsert({
      number: draft.number!, title: draft.title!, type: draft.type ?? "SOP", version: draft.version ?? "0.1",
      status: (draft.status ?? "entwurf") as EcqmDocument["status"], owner: draft.owner ?? "QMB",
      approver: draft.approver, validFrom: draft.validFrom, validUntil: draft.validUntil, category: draft.category,
    });
    setItems(ecqm.documents.list()); setOpen(false); setDraft({ type: "SOP", status: "entwurf", version: "0.1" });
  };
  const del = (id: string) => { ecqm.documents.softDelete(id); setItems(ecqm.documents.list()); };

  return (
    <>
      <EcqmPageHeader
        title={onlySop ? "SOP Management" : "Dokumentenlenkung"}
        subtitle={onlySop ? "Standard Operating Procedures – Version, Freigabe, Historie." : "Versionierte Dokumente mit Freigabe, Gültigkeit und Lesebestätigung."}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Neu</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues Dokument</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nummer</Label><Input value={draft.number ?? ""} onChange={(e) => setDraft({ ...draft, number: e.target.value })} /></div>
                <div><Label>Version</Label><Input value={draft.version ?? ""} onChange={(e) => setDraft({ ...draft, version: e.target.value })} /></div>
                <div className="col-span-2"><Label>Titel</Label><Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
                <div>
                  <Label>Typ</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as EcqmDocument["type"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EcqmDocument["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label>Verantwortlicher</Label><Input value={draft.owner ?? ""} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></div>
                <div><Label>Freigeber</Label><Input value={draft.approver ?? ""} onChange={(e) => setDraft({ ...draft, approver: e.target.value })} /></div>
                <div><Label>Gültig ab</Label><Input type="date" value={draft.validFrom ?? ""} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })} /></div>
                <div><Label>Gültig bis</Label><Input type="date" value={draft.validUntil ?? ""} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} /></div>
              </div>
              <Button onClick={save}>Speichern</Button>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Suche…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle</SelectItem>
              {STATUS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/60">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="p-3">Nummer</th><th className="p-3">Titel</th><th className="p-3">Typ</th><th className="p-3">Version</th>
              <th className="p-3">Status</th><th className="p-3">Verantwortl.</th><th className="p-3">Gültig bis</th><th className="p-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-t border-border/40 hover:bg-accent/30">
                <td className="p-3 font-medium">{d.number}</td>
                <td className="p-3">{d.title}</td>
                <td className="p-3 text-muted-foreground">{d.type}</td>
                <td className="p-3 tabular-nums">{d.version}</td>
                <td className="p-3"><Badge variant={d.status === "freigegeben" ? "default" : "secondary"}>{d.status}</Badge></td>
                <td className="p-3 text-muted-foreground">{d.owner}</td>
                <td className="p-3 text-muted-foreground">{d.validUntil ?? "-"}</td>
                <td className="p-3"><Button variant="ghost" size="icon" onClick={() => del(d.id)}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Keine Dokumente.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
