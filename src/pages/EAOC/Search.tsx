import { useMemo, useState } from "react";
import { eaoc } from "@/lib/eaoc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const SECTIONS = ["companies","tenants","locations","departments","teams","users","roles","permissions","api_keys","webhooks","integrations","licenses","backups","jobs"];

export default function EaocSearch() {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out: { section: string; row: any }[] = [];
    for (const sec of SECTIONS) {
      for (const r of eaoc.list(sec)) {
        if (JSON.stringify(r).toLowerCase().includes(s)) out.push({ section: sec, row: r });
      }
    }
    return out.slice(0, 200);
  }, [q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Enterprise Suche</h1>
        <p className="text-sm text-muted-foreground mt-1">Sucht mandantenweit über Verwaltungsobjekte.</p>
      </div>
      <Input autoFocus placeholder="z. B. Berlin, Zoom, Sales…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">{results.length} Treffer</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr><th className="text-left px-4 py-2">Bereich</th><th className="text-left px-4 py-2">Titel</th><th className="text-left px-4 py-2">Details</th></tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground">{r.section}</td>
                  <td className="px-4 py-2">{r.row.name ?? r.row.module ?? r.row.channel ?? r.row.id}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-xl">{JSON.stringify(r.row).slice(0, 160)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
