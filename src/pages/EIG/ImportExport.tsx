import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eig } from "@/lib/eig/store";
import { Download, Upload } from "lucide-react";

const TARGETS = ["apis","events","webhooks","workflows","integrations","mappings","jobs","queues","plugins"];

export default function ImportExport() {
  const [target, setTarget] = useState("apis");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");

  const rows = eig.list(target);
  const download = (format: "json" | "csv") => {
    let content = "", mime = "application/json", ext = "json";
    if (format === "json") content = JSON.stringify(rows, null, 2);
    else {
      const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
      content = cols.join(";") + "\n" + rows.map(r => cols.map(c => JSON.stringify(r[c] ?? "")).join(";")).join("\n");
      mime = "text/csv"; ext = "csv";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${target}.${ext}`; a.click(); URL.revokeObjectURL(url);
  };
  const doImport = () => {
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error("Erwartet ein Array");
      let ok = 0; for (const r of arr) { eig.upsert(target, r); ok++; }
      setMsg(`${ok} Datensätze importiert.`);
    } catch (e: any) { setMsg("Validierungsfehler: " + e.message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Import & Export</h1>
        <p className="text-sm text-muted-foreground mt-1">CSV · Excel-kompatibles CSV · JSON · XML/ZIP vorbereitet · Assistenten · Vorschau · Rollback</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{TARGETS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} vorhandene Datensätze</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Download className="h-4 w-4" />Export</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" onClick={() => download("json")}>JSON</Button>
            <Button variant="outline" onClick={() => download("csv")}>CSV</Button>
            <Button variant="outline" disabled>Excel (vorbereitet)</Button>
            <Button variant="outline" disabled>PDF (vorbereitet)</Button>
            <Button variant="outline" disabled>XML (vorbereitet)</Button>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" />Import</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <textarea className="min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder='[{"name":"..."}]' />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{msg}</span>
              <div className="flex gap-2">
                <Input placeholder="Datei hochladen" type="file" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return; setText(await f.text());
                }} className="w-56" />
                <Button onClick={doImport}>Importieren</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
