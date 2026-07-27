import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logAuditAccess } from "./audit-access";

export default function AuditTimeline() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logAuditAccess("timeline");
    (async () => {
      const { data } = await supabase
        .from("audit_actions")
        .select("id, ts, user_id, module, action, object_type, object_id, path, duration_ms")
        .order("ts", { ascending: false })
        .limit(500);
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return JSON.stringify(r).toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Activity Timeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Sekundengenaue Aktionen — letzte 500</p>
        </div>
        <Input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">{filtered.length} Einträge</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-2">Zeit</th>
                <th className="text-left px-4 py-2">Benutzer</th>
                <th className="text-left px-4 py-2">Modul</th>
                <th className="text-left px-4 py-2">Aktion</th>
                <th className="text-left px-4 py-2">Objekt</th>
                <th className="text-left px-4 py-2">Pfad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(r.ts).toLocaleString("de-DE")}</td>
                  <td className="px-4 py-2 text-xs truncate max-w-[120px]">{r.user_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2">{r.module}</td>
                  <td className="px-4 py-2">{r.action}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.object_type ? `${r.object_type}:${r.object_id ?? ""}` : "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-[240px]">{r.path ?? "—"}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Keine Einträge</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
