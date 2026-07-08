import { useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TARGETS = ["users","companies","tenants","locations","departments","roles"];

export default function EaocImport() {
  const [section, setSection] = useState("users");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");

  const doImport = () => {
    try {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("Erwartet ein Array");
      let ok = 0;
      for (const r of rows) { eaoc.upsert(section, r); ok++; }
      setMsg(`${ok} Datensätze importiert.`);
    } catch (e: any) {
      setMsg("Validierungsfehler: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Import</h1>
        <p className="text-sm text-muted-foreground mt-1">JSON-Import mit Validierung vor dem Speichern.</p>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl max-w-3xl">
        <CardHeader><CardTitle className="text-sm">Neuer Import</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{TARGETS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <textarea className="min-h-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder='[{"name":"Neuer Benutzer","email":"neu@alix"}]' />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{msg}</span>
            <Button onClick={doImport}>Importieren</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
