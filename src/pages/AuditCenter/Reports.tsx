import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Download, Shield, Trash2, Printer } from "lucide-react";
import { toast } from "sonner";
import { logAuditAccess } from "./audit-access";

function csv(rows: any[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditReports() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ actions: 0, sessions: 0, changes: 0, access: 0 });

  useEffect(() => {
    logAuditAccess("reports");
  }, []);

  const load = async () => {
    const range = { fromTs: `${from}T00:00:00Z`, toTs: `${to}T23:59:59Z` };
    const [a, s, c, ac] = await Promise.all([
      supabase.from("audit_actions").select("id", { count: "exact", head: true }).gte("ts", range.fromTs).lte("ts", range.toTs),
      supabase.from("audit_sessions").select("id", { count: "exact", head: true }).gte("started_at", range.fromTs).lte("started_at", range.toTs),
      supabase.from("audit_changes").select("id", { count: "exact", head: true }).gte("ts", range.fromTs).lte("ts", range.toTs),
      supabase.from("audit_access_log").select("id", { count: "exact", head: true }).gte("ts", range.fromTs).lte("ts", range.toTs),
    ]);
    setCounts({ actions: a.count ?? 0, sessions: s.count ?? 0, changes: c.count ?? 0, access: ac.count ?? 0 });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const exportTable = async (table: string, tsCol: string, filename: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from(table as any)
        .select("*")
        .gte(tsCol, `${from}T00:00:00Z`)
        .lte(tsCol, `${to}T23:59:59Z`)
        .order(tsCol, { ascending: false })
        .limit(10000);
      if (error) throw error;
      download(`${filename}_${from}_${to}.csv`, csv(data ?? []));
      toast.success(`${data?.length ?? 0} Zeilen exportiert`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    if (!confirm("Alle Audit-Daten älter als 24 Monate unwiderruflich löschen?")) return;
    setBusy(true);
    try {
      const cutoff = new Date(Date.now() - 730 * 86400000).toISOString();
      const results = await Promise.all([
        supabase.from("audit_actions").delete().lt("ts", cutoff),
        supabase.from("audit_changes").delete().lt("ts", cutoff),
        supabase.from("audit_access_log").delete().lt("ts", cutoff),
        supabase.from("audit_sessions").delete().lt("started_at", cutoff),
      ]);
      const errors = results.map((r) => r.error).filter(Boolean);
      if (errors.length) throw errors[0];
      toast.success("DSGVO-Bereinigung durchgeführt");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const kpis = useMemo(
    () => [
      { label: "Aktionen", value: counts.actions, table: "audit_actions", ts: "ts" },
      { label: "Sessions", value: counts.sessions, table: "audit_sessions", ts: "started_at" },
      { label: "Feld-Änderungen", value: counts.changes, table: "audit_changes", ts: "ts" },
      { label: "Zugriffe Audit Center", value: counts.access, table: "audit_access_log", ts: "ts" },
    ],
    [counts],
  );

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
          Compliance Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          DSGVO-konforme Exporte · WORM-Audit-Trail · 24 Monate Aufbewahrung
        </p>
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Zeitraum wählen
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4 max-w-md">
          <div>
            <Label className="text-xs">Von</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Bis</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardContent className="p-4 space-y-3">
              <div>
                <div className="text-2xl font-semibold">{k.value.toLocaleString("de-DE")}</div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || !k.value}
                onClick={() => exportTable(k.table, k.ts, k.table)}
                className="w-full"
              >
                <Download className="h-3 w-3 mr-1" /> CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Printer className="h-4 w-4" /> PDF-Compliance-Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Druckfertiger PDF-Bericht mit Firmenkopf, Zeitraum, KPIs und Signaturfeld.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const w = window.open("", "_blank");
              if (!w) return;
              w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>AlixWork Compliance Report ${from} – ${to}</title>
                <style>
                  body{font-family:Inter,system-ui,sans-serif;color:#111;padding:40px;max-width:800px;margin:auto;}
                  h1{color:#111;border-bottom:2px solid #d4af37;padding-bottom:8px;}
                  .kpi{display:inline-block;width:22%;padding:16px;margin:1%;border:1px solid #ddd;border-radius:8px;text-align:center;}
                  .kpi .v{font-size:28px;font-weight:600;color:#d4af37;}
                  .kpi .l{font-size:11px;text-transform:uppercase;color:#666;}
                  .meta{color:#666;font-size:12px;margin-bottom:24px;}
                  .sig{margin-top:80px;border-top:1px solid #333;padding-top:8px;width:300px;font-size:12px;}
                  @media print { .noprint{display:none;} }
                </style></head><body>
                <h1>AlixWork · Audit &amp; Compliance Report</h1>
                <div class="meta">Zeitraum: <b>${from}</b> bis <b>${to}</b> · Erstellt: ${new Date().toLocaleString("de-DE")}</div>
                ${kpis.map((k) => `<div class="kpi"><div class="v">${k.value.toLocaleString("de-DE")}</div><div class="l">${k.label}</div></div>`).join("")}
                <h2 style="margin-top:40px;font-size:14px;">DSGVO-Konformität</h2>
                <p style="font-size:12px;">Alle Audit-Einträge werden WORM-geschützt gespeichert und automatisch nach 24 Monaten gelöscht (Retention-Cron täglich 03:30 UTC).</p>
                <div class="sig">Datum, Unterschrift Super Admin</div>
                <button class="noprint" onclick="window.print()" style="margin-top:24px;padding:8px 16px;background:#d4af37;color:#111;border:none;border-radius:4px;cursor:pointer;">Drucken / Als PDF speichern</button>
                </body></html>`);
              w.document.close();
            }}
          >
            <Printer className="h-3 w-3 mr-1" /> PDF-Report öffnen
          </Button>
        </CardContent>
      </Card>


      <Card className="border-red-500/30 bg-red-500/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-red-300">
            <Shield className="h-4 w-4" /> DSGVO-Aufbewahrung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Löscht alle Audit-Einträge älter als <b>24 Monate</b> unwiderruflich. Vor dem Purge unbedingt Exporte erstellen.
          </p>
          <Button variant="destructive" size="sm" disabled={busy} onClick={purge}>
            <Trash2 className="h-3 w-3 mr-1" /> Retention-Purge ausführen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
