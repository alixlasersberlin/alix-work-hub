import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { exportCsv } from "@/lib/abic/store";
import { listSectionKeys, getSection } from "@/lib/abic/mock";

export default function DataExplorer() {
  const sections = listSectionKeys();
  const [section, setSection] = useState<string>("executive");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = getSection(section);
    if (!s) return [];
    const chart = s.charts[0];
    const data = (chart?.data ?? []) as Array<Record<string, unknown>>;
    return data.filter((r) => {
      const t = String(r.t ?? "");
      if (from && t < from) return false;
      if (to && t > to) return false;
      if (q && !t.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [section, from, to, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Explorer</h1>
        <p className="text-sm text-muted-foreground">Eigene Auswertungen mit Filtern nach Zeitraum, Bereich und Suchbegriff. Export als CSV.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filter</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label>Bereich</Label>
            <Select value={section} onValueChange={setSection}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {sections.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Von</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>Bis</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="md:col-span-1"><Label>Suche</Label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kategorie / Label" /></div>
          <div className="flex items-end">
            <Button className="w-full" variant="outline" onClick={() => exportCsv(`explorer-${section}.csv`, rows)}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ergebnis · {rows.length} Datensätze</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Daten für die aktuelle Auswahl.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/60">
                    {Object.keys(rows[0]).map((k) => (<th key={k} className="py-2 pr-3">{k}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {Object.values(r).map((v, j) => (<td key={j} className="py-2 pr-3 tabular-nums">{String(v)}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
