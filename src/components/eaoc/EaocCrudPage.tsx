import { useMemo, useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import type { EaocRecord } from "@/lib/eaoc/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Download } from "lucide-react";

export interface CrudField { key: string; label: string; type?: "text" | "number" | "email" | "textarea" | "checkbox"; placeholder?: string; }

interface Props {
  title: string;
  subtitle?: string;
  section: string;
  fields: CrudField[];
  columns?: string[];
}

export default function EaocCrudPage({ title, subtitle, section, fields, columns }: Props) {
  const [rows, setRows] = useState<EaocRecord[]>(() => eaoc.list(section));
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>({});

  const cols = columns ?? fields.slice(0, 5).map(f => f.key);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(s));
  }, [rows, q]);

  const refresh = () => setRows(eaoc.list(section));

  const onSave = () => {
    eaoc.upsert(section, draft);
    setOpen(false); setDraft({}); refresh();
  };
  const onDelete = (id: string) => { eaoc.remove(section, id); refresh(); };
  const onEdit = (r: EaocRecord) => { setDraft(r); setOpen(true); };
  const onNew = () => { setDraft({}); setOpen(true); };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${section}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button variant="outline" onClick={onExport}><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button onClick={onNew}><Plus className="h-4 w-4 mr-1" />Neu</Button>
        </div>
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">{filtered.length} Einträge</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                {cols.map(c => <th key={c} className="text-left px-4 py-2 font-medium">{fields.find(f => f.key === c)?.label ?? c}</th>)}
                <th className="text-right px-4 py-2 font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-accent/20">
                  {cols.map(c => (
                    <td key={c} className="px-4 py-2 align-top">
                      {typeof r[c] === "boolean" ? <Badge variant={r[c] ? "default" : "secondary"}>{r[c] ? "ja" : "nein"}</Badge> : <span className="text-foreground/90">{String(r[c] ?? "")}</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={cols.length + 1} className="px-4 py-8 text-center text-muted-foreground text-sm">Keine Einträge</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Bearbeiten" : "Neuer Eintrag"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            {fields.map(f => (
              <div key={f.key} className="grid gap-1">
                <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
                {f.type === "checkbox" ? (
                  <input id={f.key} type="checkbox" checked={!!draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked })} />
                ) : f.type === "textarea" ? (
                  <textarea id={f.key} className="min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                ) : (
                  <Input id={f.key} type={f.type ?? "text"} placeholder={f.placeholder} value={draft[f.key] ?? ""} onChange={(e) => setDraft({ ...draft, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={onSave}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
