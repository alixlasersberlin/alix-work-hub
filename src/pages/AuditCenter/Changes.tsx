import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { logAuditAccess } from "./audit-access";

function preview(v: unknown) {
  if (v === null || v === undefined) return "—";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 80) + "…" : s;
}

export default function AuditChanges() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logAuditAccess("changes");
    (async () => {
      const { data } = await supabase
        .from("audit_changes")
        .select("id, ts, user_id, table_name, record_id, field_name, operation, old_value, new_value, meta")
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
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
            Änderungs-Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            WORM-Protokoll aller Feldänderungen · vorher/nachher · letzte 500
          </p>
        </div>
        <Input placeholder="Filter (Tabelle, Feld, User, ID…)" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">{filtered.length} Einträge</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-2">Zeit</th>
                <th className="text-left px-4 py-2">Benutzer</th>
                <th className="text-left px-4 py-2">Tabelle / Datensatz</th>
                <th className="text-left px-4 py-2">Feld</th>
                <th className="text-left px-4 py-2">Op</th>
                <th className="text-left px-4 py-2">Vorher</th>
                <th className="text-left px-4 py-2">Nachher</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const meta = (r.meta ?? {}) as any;
                return (
                  <tr key={r.id} className="border-b border-border/30 align-top">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(r.ts).toLocaleString("de-DE")}</td>
                    <td className="px-4 py-2">
                      <div>{meta.user_email ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.user_id?.slice(0, 8) ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div>{r.table_name}</div>
                      <div className="text-xs text-muted-foreground">{r.record_id?.slice(0, 16) ?? "—"}</div>
                      {meta.module && <div className="text-[10px] text-muted-foreground/60">Modul: {meta.module}</div>}
                    </td>
                    <td className="px-4 py-2"><Badge variant="secondary">{r.field_name}</Badge></td>
                    <td className="px-4 py-2 text-xs">{r.operation}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-[240px] break-words">{preview(r.old_value)}</td>
                    <td className="px-4 py-2 text-xs max-w-[240px] break-words">{preview(r.new_value)}</td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Keine Einträge</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
