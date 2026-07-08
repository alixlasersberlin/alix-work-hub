import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const TARGETS = [
  { key: "users", label: "Benutzer" },
  { key: "companies", label: "Gesellschaften" },
  { key: "tenants", label: "Mandanten" },
  { key: "locations", label: "Standorte" },
  { key: "roles", label: "Rollen" },
  { key: "integrations", label: "Integrationen" },
  { key: "webhooks", label: "Webhooks" },
  { key: "api_keys", label: "API-Schlüssel" },
  { key: "backups", label: "Backups" },
  { key: "jobs", label: "Jobs" },
];

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const head = cols.join(";");
  const body = rows.map(r => cols.map(c => JSON.stringify(r[c] ?? "")).join(";")).join("\n");
  return head + "\n" + body;
}

export default function EaocExport() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Datenexport</h1>
        <p className="text-sm text-muted-foreground mt-1">CSV · JSON – Verwaltungsdaten aus dem EAOC-Modul</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TARGETS.map(t => {
          const rows = eaoc.list(t.key);
          return (
            <Card key={t.key} className="border-border/60 bg-card/40 backdrop-blur-xl">
              <CardHeader><CardTitle className="text-sm">{t.label} <span className="text-xs text-muted-foreground">· {rows.length}</span></CardTitle></CardHeader>
              <CardContent className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => download(`${t.key}.json`, JSON.stringify(rows, null, 2), "application/json")}><Download className="h-3.5 w-3.5 mr-1" />JSON</Button>
                <Button size="sm" variant="outline" onClick={() => download(`${t.key}.csv`, toCsv(rows), "text/csv")}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
