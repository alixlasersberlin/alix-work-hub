import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { eig } from "@/lib/eig/store";

export default function Logs() {
  const [q, setQ] = useState("");
  const rows = eig.logs.list();
  const filtered = useMemo(() => rows.filter(r => !q.trim() || JSON.stringify(r).toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const dl = () => {
    const csv = "ts;level;source;message\n" + filtered.map(r => [r.ts, r.level, r.source, JSON.stringify(r.message)].join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "eig-logs.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Gateway-Logs · filterbar</p>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          <Button variant="outline" onClick={dl}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </div>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">{filtered.length} Einträge</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr><th className="text-left px-4 py-2">Zeit</th><th className="text-left px-4 py-2">Level</th><th className="text-left px-4 py-2">Quelle</th><th className="text-left px-4 py-2">Nachricht</th></tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(r.ts).toLocaleString()}</td>
                  <td className="px-4 py-2"><Badge variant={r.level === "error" ? "destructive" : r.level === "warn" ? "secondary" : "default"}>{r.level}</Badge></td>
                  <td className="px-4 py-2">{r.source}</td>
                  <td className="px-4 py-2">{r.message}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Keine Einträge</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
