import { useMemo, useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function Audit() {
  const [q, setQ] = useState("");
  const rows = eaoc.audit.list();
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(s));
  }, [q, rows]);

  const exportCsv = () => {
    const header = "id;ts;user;ip;action;section;entityId";
    const body = filtered.map(r => [r.id, r.ts, r.user, r.ip, r.action, r.section, r.entityId ?? ""].join(";")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "eaoc-audit.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Audit</h1>
          <p className="text-sm text-muted-foreground mt-1">Nicht manipulierbares Protokoll aller Administrator-Aktionen.</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">{filtered.length} Einträge</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-2">Zeit</th>
                <th className="text-left px-4 py-2">Benutzer</th>
                <th className="text-left px-4 py-2">IP</th>
                <th className="text-left px-4 py-2">Aktion</th>
                <th className="text-left px-4 py-2">Bereich</th>
                <th className="text-left px-4 py-2">Entität</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(r.ts).toLocaleString()}</td>
                  <td className="px-4 py-2">{r.user}</td>
                  <td className="px-4 py-2">{r.ip}</td>
                  <td className="px-4 py-2">{r.action}</td>
                  <td className="px-4 py-2">{r.section}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.entityId ?? "-"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Keine Einträge</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
