import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/infinity/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Download, Search, ExternalLink, Trash2, Mail, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: string;
  source_system: string;
  external_order_id: string;
  order_number: string | null;
  zoho_date: string | null;
  zoho_status: string | null;
  customer_name: string | null;
  total: number | null;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
  import_status: string;
  import_error: string | null;
  imported_at: string | null;
  resolved_at: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  zoho_eu_1: "🇩🇪 Alix Deutschland",
  zoho_eu_2: "🇦🇹 Alix Austria",
};

type ZohoHit = {
  salesorder_id: string;
  salesorder_number: string;
  date?: string;
  status?: string;
  customer_name?: string;
  total?: number;
  exists_local?: boolean;
};
type SearchGroup = { source: string; mode?: string; error?: string; results: ZohoHit[] };

export default function AuftraegeGesucht() {
  const { hasRole } = useAuth();
  const canImport = hasRole("Super Admin") || hasRole("Admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [running, setRunning] = useState<"scan" | "import" | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [source, setSource] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  // Zoho manual search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState<"auto" | "number" | "customer">("auto");
  const [searchSource, setSearchSource] = useState<"all" | "zoho_eu_1" | "zoho_eu_2">("all");
  const [searching, setSearching] = useState(false);
  const [searchGroups, setSearchGroups] = useState<SearchGroup[] | null>(null);
  const [importingHit, setImportingHit] = useState<string | null>(null);

  async function runZohoSearch() {
    const term = searchTerm.trim();
    if (term.length < 2) {
      toast({ title: "Bitte mindestens 2 Zeichen eingeben", variant: "destructive" });
      return;
    }
    setSearching(true);
    setSearchGroups(null);
    try {
      const { data, error } = await supabase.functions.invoke("zoho-orders-search", {
        body: {
          query: term,
          mode: searchMode,
          sources: searchSource === "all" ? ["zoho_eu_1", "zoho_eu_2"] : [searchSource],
        },
      });
      if (error) throw error;
      const groups = (data?.results ?? []) as SearchGroup[];
      setSearchGroups(groups);
      const total = groups.reduce((s, g) => s + (g.results?.length ?? 0), 0);
      toast({ title: `${total} Treffer in Zoho`, description: total === 0 ? "Keine passenden Aufträge gefunden." : undefined });
    } catch (e: any) {
      toast({ title: "Suche fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  async function importZohoHit(source_system: string, hit: ZohoHit) {
    if (!canImport) { toast({ title: "Nur Admin/Super Admin darf importieren", variant: "destructive" }); return; }
    setImportingHit(hit.salesorder_id);
    try {
      const { error } = await supabase.functions.invoke("sync-single-order", {
        body: { source_system, external_order_id: hit.salesorder_id },
      });
      if (error) throw error;
      toast({ title: "Import erfolgreich", description: hit.salesorder_number || hit.salesorder_id });
      // mark local
      setSearchGroups((prev) => prev?.map((g) => g.source === source_system
        ? { ...g, results: g.results.map((r) => r.salesorder_id === hit.salesorder_id ? { ...r, exists_local: true } : r) }
        : g) ?? null);
      await load();
    } catch (e: any) {
      toast({ title: "Import fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setImportingHit(null);
    }
  }

  async function load() {
    setLoading(true);
    let query = supabase
      .from("orders_missing")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(1000);
    if (status !== "all") query = query.eq("import_status", status);
    if (source !== "all") query = query.eq("source_system", source);
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast({ title: "Fehler beim Laden", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, source]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.order_number, r.customer_name, r.external_order_id, r.import_error]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [rows, q]);

  const counts = useMemo(() => {
    const c = { pending: 0, failed: 0, imported: 0, resolved: 0 };
    for (const r of rows) c[r.import_status as keyof typeof c] = (c[r.import_status as keyof typeof c] ?? 0) + 1;
    return c;
  }, [rows]);

  async function runReconcile(doImport: boolean) {
    if (doImport && !canImport) { toast({ title: "Nur Admin/Super Admin darf importieren", variant: "destructive" }); return; }
    setRunning(doImport ? "import" : "scan");
    try {
      const { data, error } = await supabase.functions.invoke("zoho-orders-reconcile", {
        body: { sources: ["zoho_eu_1", "zoho_eu_2"], import: doImport },
      });
      if (error) throw error;
      if (data?.background) {
        toast({
          title: doImport ? "Bulk-Import gestartet" : "Abgleich gestartet",
          description: "Läuft im Hintergrund – die Liste aktualisiert sich automatisch.",
        });
        // Poll every 10s for 5 minutes to reflect progress in the UI
        let ticks = 0;
        const iv = setInterval(async () => {
          ticks += 1;
          await load();
          if (ticks >= 30) clearInterval(iv);
        }, 10000);
      } else {
        const totalMissing = (data?.results ?? []).reduce((s: number, r: any) => s + (r.missing_count ?? 0), 0);
        const totalImported = (data?.results ?? []).reduce((s: number, r: any) => s + (r.imported ?? 0), 0);
        toast({
          title: doImport ? `${totalImported} importiert` : `${totalMissing} fehlende gefunden`,
          description: "Liste aktualisiert.",
        });
      }
      await load();
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRunning(null);
    }
  }

  async function importOne(r: Row) {
    if (!canImport) { toast({ title: "Nur Admin/Super Admin darf importieren", variant: "destructive" }); return; }
    setBusy(r.id);
    const parseRetryMs = (msg: string, fallback: number) => {
      const m = msg.match(/Retry after\s*~?\s*(\d+)\s*(ms|s)?/i);
      if (m) {
        const n = parseInt(m[1], 10);
        return m[2]?.toLowerCase() === "s" ? n * 1000 : n;
      }
      return fallback;
    };
    const maxRetries = 4;
    let attempt = 0;
    let lastMsg = "";
    try {
      while (attempt <= maxRetries) {
        let data: any = null;
        let error: any = null;
        try {
          const res = await supabase.functions.invoke("sync-single-order", {
            body: { source_system: r.source_system, external_order_id: r.external_order_id },
          });
          data = res.data; error = res.error;
        } catch (invokeErr: any) {
          error = { message: invokeErr?.message ?? String(invokeErr) };
        }
        const rawMsg = (error?.message || data?.message || data?.error || "") as string;
        const msg = typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg);
        const tokenRefreshRL = /token refresh/i.test(msg) && /too many requests|rate/i.test(msg);
        const rateLimited = tokenRefreshRL || /rate limit/i.test(msg) || /429/.test(msg) || /too many requests/i.test(msg);
        if (!error && !data?.error) {
          const now = new Date().toISOString();
          await supabase.from("orders_missing").update({
            import_status: "imported",
            imported_at: now,
            resolved_at: now,
            import_error: null,
          }).eq("id", r.id);
          await supabase.from("orders").update({ imported_via_reconcile_at: now })
            .eq("source_system", r.source_system)
            .eq("external_order_id", r.external_order_id);
          toast({ title: "Import erfolgreich", description: r.order_number ?? r.external_order_id });
          await load();
          return;
        }
        lastMsg = msg || "Unbekannter Fehler";
        if (!rateLimited || attempt === maxRetries) throw new Error(lastMsg);
        // Token-refresh rate limit needs much longer backoff (Zoho throttles the /token endpoint for ~1 min)
        const base = tokenRefreshRL ? 60000 : 15000;
        const waitMs = Math.min(parseRetryMs(lastMsg, base * (attempt + 1)), 120000);
        toast({ title: `Rate limit – warte ${Math.round(waitMs/1000)}s (Versuch ${attempt + 1}/${maxRetries})` });
        await new Promise((res) => setTimeout(res, waitMs));
        attempt += 1;
      }
      throw new Error(lastMsg || "Rate limit");

    } catch (e: any) {
      const msg = e?.message ?? String(e);
      await supabase.from("orders_missing").update({
        import_status: "failed",
        import_error: msg,
      }).eq("id", r.id);
      toast({ title: "Import fehlgeschlagen", description: msg, variant: "destructive" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function removeRow(r: Row) {
    if (!confirm(`Eintrag ${r.order_number ?? r.external_order_id} entfernen?`)) return;
    const { error } = await supabase.from("orders_missing").delete().eq("id", r.id);
    if (error) toast({ title: "Löschen fehlgeschlagen", description: error.message, variant: "destructive" });
    else load();
  }

  function statusBadge(s: string) {
    const map: Record<string, string> = {
      pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      failed: "bg-red-500/15 text-red-500 border-red-500/30",
      imported: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
      resolved: "bg-sky-500/15 text-sky-500 border-sky-500/30",
    };
    return <Badge variant="outline" className={map[s] ?? ""}>{s}</Badge>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Aufträge gesucht"
        subtitle="In Zoho gefundene, aber in AlixWork fehlende Aufträge. Einzelimport oder Massenimport möglich."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { k: "pending", label: "Offen" },
          { k: "failed", label: "Fehler" },
          { k: "imported", label: "Importiert" },
          { k: "resolved", label: "Erledigt" },
        ].map((c) => (
          <Card key={c.k} className="cursor-pointer" onClick={() => setStatus(c.k)}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="text-2xl font-semibold">{counts[c.k as keyof typeof counts] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zoho manuell suchen</CardTitle>
          <CardDescription>
            Gezielte Suche in beiden Zoho-Mandanten nach Auftragsnummer (z. B. <span className="font-mono">SO-3540</span>) oder Kundenname. Treffer können direkt importiert werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Auftragsnr. oder Kundenname…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runZohoSearch(); }}
              />
            </div>
            <Select value={searchMode} onValueChange={(v) => setSearchMode(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto erkennen</SelectItem>
                <SelectItem value="number">Auftragsnummer</SelectItem>
                <SelectItem value="customer">Kundenname</SelectItem>
              </SelectContent>
            </Select>
            <Select value={searchSource} onValueChange={(v) => setSearchSource(v as any)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Beide Mandanten</SelectItem>
                <SelectItem value="zoho_eu_1">🇩🇪 Alix Deutschland</SelectItem>
                <SelectItem value="zoho_eu_2">🇦🇹 Alix Austria</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runZohoSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              In Zoho suchen
            </Button>
          </div>

          {searchGroups && (
            <div className="space-y-4">
              {searchGroups.map((g) => (
                <div key={g.source} className="rounded-md border">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                    <div className="text-sm font-medium">{SOURCE_LABEL[g.source] ?? g.source}</div>
                    <div className="text-xs text-muted-foreground">
                      {g.error ? <span className="text-red-500">{g.error}</span> : `${g.results.length} Treffer`}
                    </div>
                  </div>
                  {g.results.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Auftragsnr.</TableHead>
                          <TableHead>Kunde</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Zoho-Status</TableHead>
                          <TableHead className="text-right">Betrag</TableHead>
                          <TableHead className="text-right">Aktion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {g.results.map((h) => (
                          <TableRow key={h.salesorder_id}>
                            <TableCell className="font-mono text-xs">
                              <div className="font-medium">{h.salesorder_number || "—"}</div>
                              <div className="text-muted-foreground">{h.salesorder_id}</div>
                            </TableCell>
                            <TableCell>{h.customer_name ?? "—"}</TableCell>
                            <TableCell>{h.date ?? "—"}</TableCell>
                            <TableCell>{h.status ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {typeof h.total === "number" ? h.total.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {h.exists_local ? (
                                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                                  bereits in AlixWork
                                </Badge>
                              ) : canImport ? (
                                <Button
                                  size="sm"
                                  onClick={() => importZohoHit(g.source, h)}
                                  disabled={importingHit === h.salesorder_id}
                                >
                                  {importingHit === h.salesorder_id
                                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    : <Download className="h-3 w-3 mr-1" />}
                                  Importieren
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">nur Admin</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Fehlende Aufträge</CardTitle>
            <CardDescription>Automatisch befüllt durch den Zoho-Abgleich.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => {
              try {
                const { error } = await supabase.functions.invoke("send-transactional-email", {
                  body: {
                    templateName: "orders-missing-alert",
                    recipientEmail: "rde@alix-lasers.com",
                    skipDefaultCopies: true,
                    idempotencyKey: `orders-missing-test-${Date.now()}`,
                    templateData: {
                      count: 2,
                      testMode: true,
                      portalUrl: "https://app.alixwork.de/auftraege/gesucht",
                      orders: [
                        { order_number: "SO-3540", customer_name: "Skin Master", zoho_date: "2024-12-04", source_system: "zoho_eu_1", zoho_status: "confirmed" },
                        { order_number: "SO-3658", customer_name: "Blueice", zoho_date: "2025-04-28", source_system: "zoho_eu_1", zoho_status: "confirmed" },
                      ],
                    },
                  },
                });
                if (error) throw error;
                toast({ title: "Test-Mail gesendet", description: "an rde@alix-lasers.com" });
              } catch (e: any) {
                toast({ title: "Test-Mail Fehler", description: e?.message ?? String(e), variant: "destructive" });
              }
            }}>
              <Mail className="h-4 w-4 mr-2" /> Test-Mail
            </Button>
            <Button variant="outline" onClick={() => runReconcile(false)} disabled={running !== null}>
              {running === "scan" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Jetzt prüfen
            </Button>
            {canImport && (
              <Button onClick={() => runReconcile(true)} disabled={running !== null}>
                {running === "import" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Alle fehlenden importieren
              </Button>
            )}
          </div>

        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 w-64" placeholder="Suche Nr./Kunde…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Offen</SelectItem>
                <SelectItem value="failed">Fehler</SelectItem>
                <SelectItem value="imported">Importiert</SelectItem>
                <SelectItem value="resolved">Erledigt</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                <SelectItem value="zoho_eu_1">🇩🇪 Alix Deutschland</SelectItem>
                <SelectItem value="zoho_eu_2">🇦🇹 Alix Austria</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Neu laden
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auftragsnr.</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Zuletzt gesehen</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Keine Einträge.</TableCell></TableRow>
                )}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">
                      <div className="font-medium">{r.order_number ?? "—"}</div>
                      <div className="text-muted-foreground">{r.external_order_id}</div>
                    </TableCell>
                    <TableCell>{SOURCE_LABEL[r.source_system] ?? r.source_system}</TableCell>
                    <TableCell>{r.customer_name ?? "—"}</TableCell>
                    <TableCell>{r.zoho_date ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {typeof r.total === "number" ? r.total.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—"}
                    </TableCell>
                    <TableCell>
                      {statusBadge(r.import_status)}
                      {r.import_error && (
                        <div className="text-xs text-red-500 mt-1 max-w-xs truncate" title={r.import_error}>{r.import_error}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.last_seen_at).toLocaleString("de-DE")}
                      <div>({r.seen_count}×)</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.import_status !== "imported" && r.import_status !== "resolved" && canImport && (
                          <Button size="sm" variant="outline" onClick={() => importOne(r)} disabled={busy === r.id}>
                            {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                            <span className="ml-1">Import</span>
                          </Button>
                        )}
                        {(r.import_status === "imported" || r.import_status === "resolved") && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/auftraege?q=${encodeURIComponent(r.order_number ?? r.external_order_id)}`}>
                              <ExternalLink className="h-3 w-3 mr-1" /> öffnen
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => removeRow(r)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
