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
  entity?: "salesorder" | "estimate";
};
type SearchGroup = { source: string; entity?: "salesorder" | "estimate"; mode?: string; error?: string; results: ZohoHit[] };

type SyncSingleOrderResult = {
  ok: boolean;
  data: any;
  message: string;
  rateLimited: boolean;
  tokenRefreshRateLimited: boolean;
  retryAfterMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRetryMs(msg: string, fallback: number) {
  const m = msg.match(/Retry after\s*~?\s*(\d+)\s*(ms|s)?/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return m[2]?.toLowerCase() === "s" ? n * 1000 : n;
  }
  return fallback;
}

function isRateLimitedMessage(msg: string, status?: number) {
  return status === 429 || /rate limit|too many requests|token-limit|token refresh|Access Denied/i.test(msg);
}

async function getFunctionErrorDetails(error: any) {
  let message = error?.message ?? "Edge Function Fehler";
  let status: number | undefined = error?.context?.status;
  let retryAfterMs: number | undefined;

  const context = error?.context;
  if (context && typeof context.text === "function") {
    try {
      const text = await (typeof context.clone === "function" ? context.clone().text() : context.text());
      if (text) {
        try {
          const parsed = JSON.parse(text);
          message = parsed?.message || parsed?.error || text;
          status = parsed?.status ?? status;
          retryAfterMs = parsed?.retry_after_seconds ? Number(parsed.retry_after_seconds) * 1000 : undefined;
        } catch {
          message = text;
        }
      }
    } catch {
      // Keep Supabase's generic message if the response body was already consumed.
    }
  }

  return { message, status, retryAfterMs };
}

async function invokeSyncSingleOrder(source_system: string, external_order_id: string): Promise<SyncSingleOrderResult> {
  try {
    const { data, error } = await supabase.functions.invoke("sync-single-order", {
      body: { source_system, external_order_id },
    });

    if (error) {
      const details = await getFunctionErrorDetails(error);
      const message = details.message || error.message || "Import fehlgeschlagen";
      return {
        ok: false,
        data: null,
        message,
        rateLimited: isRateLimitedMessage(message, details.status),
        tokenRefreshRateLimited: /token|zoho token|Access Denied/i.test(message),
        retryAfterMs: details.retryAfterMs,
      };
    }

    if (data?.error) {
      const message = data?.message || data?.error || "Import fehlgeschlagen";
      return {
        ok: false,
        data,
        message,
        rateLimited: isRateLimitedMessage(message, data?.status),
        tokenRefreshRateLimited: /token|zoho token|Access Denied/i.test(message),
        retryAfterMs: data?.retry_after_seconds ? Number(data.retry_after_seconds) * 1000 : undefined,
      };
    }

    return { ok: true, data, message: "", rateLimited: false, tokenRefreshRateLimited: false };
  } catch (e: any) {
    const message = e?.message ?? String(e);
    return {
      ok: false,
      data: null,
      message,
      rateLimited: isRateLimitedMessage(message),
      tokenRefreshRateLimited: /token|zoho token|Access Denied/i.test(message),
    };
  }
}

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
  const [searchEntity, setSearchEntity] = useState<"salesorder" | "estimate" | "both">("salesorder");
  const [searching, setSearching] = useState(false);
  const [searchGroups, setSearchGroups] = useState<SearchGroup[] | null>(null);
  const [importingHit, setImportingHit] = useState<string | null>(null);

  // Fehlende Angebote (in-memory Ergebnis von zoho-offers-reconcile scan)
  const [offersMissing, setOffersMissing] = useState<Array<ZohoHit & { source_system: string }>>([]);
  const [offersScanning, setOffersScanning] = useState(false);
  const [offersSelected, setOffersSelected] = useState<Set<string>>(new Set()); // key = source|estimate_id
  const [offersBusy, setOffersBusy] = useState<string | null>(null);
  const [offersBulkRunning, setOffersBulkRunning] = useState(false);

  async function runZohoSearch() {
    const term = searchTerm.trim();
    if (term.length < 2) {
      toast({ title: "Bitte mindestens 2 Zeichen eingeben", variant: "destructive" });
      return;
    }
    setSearching(true);
    setSearchGroups(null);
    try {
      const entities = searchEntity === "both" ? ["salesorder", "estimate"] : [searchEntity];
      const { data, error } = await supabase.functions.invoke("zoho-orders-search", {
        body: {
          query: term,
          mode: searchMode,
          sources: searchSource === "all" ? ["zoho_eu_1", "zoho_eu_2"] : [searchSource],
          entities,
        },
      });
      if (error) throw error;
      const groups = (data?.results ?? []) as SearchGroup[];
      setSearchGroups(groups);
      const total = groups.reduce((s, g) => s + (g.results?.length ?? 0), 0);
      toast({ title: `${total} Treffer in Zoho`, description: total === 0 ? "Keine passenden Einträge gefunden." : undefined });
    } catch (e: any) {
      toast({ title: "Suche fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  async function importZohoHit(source_system: string, hit: ZohoHit, entity: "salesorder" | "estimate" = "salesorder") {
    if (!canImport) { toast({ title: "Nur Admin/Super Admin darf importieren", variant: "destructive" }); return; }
    setImportingHit(hit.salesorder_id);
    if (entity === "estimate") {
      try {
        const { data, error } = await supabase.functions.invoke("zoho-offers-reconcile", {
          body: { source: source_system, estimate_ids: [hit.salesorder_id] },
        });
        if (error) throw error;
        const res = data?.result;
        if (res?.imported > 0) {
          toast({ title: "Angebot importiert", description: hit.salesorder_number || hit.salesorder_id });
          setSearchGroups((prev) => prev?.map((g) => g.source === source_system && g.entity === "estimate"
            ? { ...g, results: g.results.map((r) => r.salesorder_id === hit.salesorder_id ? { ...r, exists_local: true } : r) }
            : g) ?? null);
        } else {
          const msg = res?.errors?.[0]?.message ?? "Import fehlgeschlagen";
          toast({ title: "Import fehlgeschlagen", description: msg, variant: "destructive" });
        }
      } catch (e: any) {
        toast({ title: "Import fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
      } finally {
        setImportingHit(null);
      }
      return;
    }
    const result = await invokeSyncSingleOrder(source_system, hit.salesorder_id);
    if (!result.ok) {
      toast({ title: result.rateLimited ? "Zoho Rate Limit" : "Import fehlgeschlagen", description: result.message, variant: "destructive" });
      setImportingHit(null);
      return;
    }
    toast({ title: "Import erfolgreich", description: hit.salesorder_number || hit.salesorder_id });
    setSearchGroups((prev) => prev?.map((g) => g.source === source_system && (g.entity ?? "salesorder") === "salesorder"
      ? { ...g, results: g.results.map((r) => r.salesorder_id === hit.salesorder_id ? { ...r, exists_local: true } : r) }
      : g) ?? null);
    await load();
    setImportingHit(null);
  }

  // ==== Fehlende Angebote (Estimates) ====
  async function scanMissingOffers() {
    setOffersScanning(true);
    setOffersMissing([]);
    setOffersSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke("zoho-offers-reconcile", {
        body: { sources: ["zoho_eu_1", "zoho_eu_2"], import: false },
      });
      if (error) throw error;
      const flat: Array<ZohoHit & { source_system: string }> = [];
      for (const r of (data?.results ?? [])) {
        for (const m of (r.missing ?? [])) {
          flat.push({ ...m, entity: "estimate", source_system: r.source });
        }
      }
      setOffersMissing(flat);
      toast({ title: `${flat.length} fehlende Angebote gefunden` });
    } catch (e: any) {
      toast({ title: "Angebots-Abgleich fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setOffersScanning(false);
    }
  }

  async function importOneOffer(row: ZohoHit & { source_system: string }) {
    if (!canImport) return;
    const key = `${row.source_system}|${row.salesorder_id}`;
    setOffersBusy(key);
    try {
      const { data, error } = await supabase.functions.invoke("zoho-offers-reconcile", {
        body: { source: row.source_system, estimate_ids: [row.salesorder_id] },
      });
      if (error) throw error;
      if (data?.result?.imported > 0) {
        toast({ title: "Angebot importiert", description: row.salesorder_number });
        setOffersMissing((prev) => prev.filter((r) => !(r.source_system === row.source_system && r.salesorder_id === row.salesorder_id)));
      } else {
        toast({ title: "Import fehlgeschlagen", description: data?.result?.errors?.[0]?.message ?? "Unbekannter Fehler", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Import fehlgeschlagen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setOffersBusy(null);
    }
  }

  async function importSelectedOffers() {
    if (!canImport) return;
    const targets = offersMissing.filter((r) => offersSelected.has(`${r.source_system}|${r.salesorder_id}`));
    if (targets.length === 0) { toast({ title: "Keine Angebote ausgewählt" }); return; }
    if (!confirm(`${targets.length} Angebot(e) importieren?`)) return;
    setOffersBulkRunning(true);
    try {
      const bySource = new Map<string, string[]>();
      for (const t of targets) {
        const arr = bySource.get(t.source_system) ?? [];
        arr.push(t.salesorder_id);
        bySource.set(t.source_system, arr);
      }
      let ok = 0, fail = 0;
      for (const [src, ids] of bySource.entries()) {
        // chunk to keep runtime bounded
        for (let i = 0; i < ids.length; i += 25) {
          const chunk = ids.slice(i, i + 25);
          const { data, error } = await supabase.functions.invoke("zoho-offers-reconcile", {
            body: { source: src, estimate_ids: chunk },
          });
          if (error) { fail += chunk.length; continue; }
          ok += data?.result?.imported ?? 0;
          fail += data?.result?.failed ?? 0;
        }
      }
      const importedKeys = new Set<string>();
      // Optimistically remove selected (best effort; failures stay reported in toast)
      offersSelected.forEach((k) => importedKeys.add(k));
      setOffersMissing((prev) => prev.filter((r) => !importedKeys.has(`${r.source_system}|${r.salesorder_id}`)));
      setOffersSelected(new Set());
      toast({ title: `Angebots-Import fertig: ${ok} ok, ${fail} Fehler` });
    } finally {
      setOffersBulkRunning(false);
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
    const maxRetries = 4;
    let attempt = 0;
    let lastMsg = "";
    try {
      while (attempt <= maxRetries) {
        const result = await invokeSyncSingleOrder(r.source_system, r.external_order_id);
        if (result.ok) {
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
        lastMsg = result.message || "Unbekannter Fehler";
        if (!result.rateLimited || attempt === maxRetries) break;
        // Token-refresh rate limit needs much longer backoff (Zoho throttles the /token endpoint for ~1 min)
        const base = result.tokenRefreshRateLimited ? 60000 : 15000;
        const waitMs = Math.min(result.retryAfterMs ?? parseRetryMs(lastMsg, base * (attempt + 1)), 120000);
        toast({ title: `Rate limit – warte ${Math.round(waitMs/1000)}s (Versuch ${attempt + 1}/${maxRetries})` });
        await sleep(waitMs);
        attempt += 1;
      }
      const msg = lastMsg || "Import fehlgeschlagen";
      await supabase.from("orders_missing").update({
        import_status: "failed",
        import_error: msg,
      }).eq("id", r.id);
      toast({ title: "Import fehlgeschlagen", description: msg, variant: "destructive" });
      await load();
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast({ title: "Import fehlgeschlagen", description: msg, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function importSelected() {
    if (!canImport) { toast({ title: "Nur Admin/Super Admin darf importieren", variant: "destructive" }); return; }
    const targets = rows.filter((r) => selected.has(r.id) && r.import_status !== "imported" && r.import_status !== "resolved");
    if (targets.length === 0) { toast({ title: "Keine importierbaren Einträge ausgewählt" }); return; }
    if (!confirm(`${targets.length} Auftrag/Aufträge importieren?`)) return;

    setRunning("import");
    setBulkProgress({ done: 0, total: targets.length });
    let ok = 0, fail = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const r = targets[i];
        setBusy(r.id);
        let attempt = 0; let success = false; let lastMsg = "";
        while (attempt <= 3 && !success) {
          const result = await invokeSyncSingleOrder(r.source_system, r.external_order_id);
          if (result.ok) {
            const now = new Date().toISOString();
            await supabase.from("orders_missing").update({
              import_status: "imported", imported_at: now, resolved_at: now, import_error: null,
            }).eq("id", r.id);
            await supabase.from("orders").update({ imported_via_reconcile_at: now })
              .eq("source_system", r.source_system).eq("external_order_id", r.external_order_id);
            success = true; ok += 1;
            break;
          }
          lastMsg = result.message || "Unbekannter Fehler";
          if (!result.rateLimited || attempt === 3) break;
          const base = result.tokenRefreshRateLimited ? 60000 : 15000;
          const waitMs = Math.min(result.retryAfterMs ?? parseRetryMs(lastMsg, base * (attempt + 1)), 120000);
          toast({ title: `Rate limit – warte ${Math.round(waitMs/1000)}s (Import ${i + 1}/${targets.length})` });
          await sleep(waitMs);
          attempt += 1;
        }
        if (!success) {
          fail += 1;
          await supabase.from("orders_missing").update({ import_status: "failed", import_error: lastMsg }).eq("id", r.id);
        }
        setBulkProgress({ done: i + 1, total: targets.length });
        // Pacing between orders to respect Zoho rate limits
        if (i < targets.length - 1) await sleep(1500);
      }
      setSelected(new Set());
      toast({ title: `Import fertig: ${ok} ok, ${fail} Fehler` });
      await load();
    } catch (e: any) {
      toast({ title: "Import abgebrochen", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setBusy(null);
      setBulkProgress(null);
      setRunning(null);
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
            {canImport && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    const selectable = filtered.filter((r) => r.import_status !== "imported" && r.import_status !== "resolved");
                    const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
                    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)));
                  }}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  {(() => {
                    const selectable = filtered.filter((r) => r.import_status !== "imported" && r.import_status !== "resolved");
                    return selectable.length > 0 && selectable.every((r) => selected.has(r.id)) ? "Auswahl leeren" : "Alle sichtbaren";
                  })()}
                </Button>
                <Button
                  onClick={importSelected}
                  disabled={running !== null || selected.size === 0}
                >
                  {running === "import" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {bulkProgress
                    ? `Import ${bulkProgress.done}/${bulkProgress.total}…`
                    : `Auswahl importieren (${selected.size})`}
                </Button>
              </>
            )}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canImport && <TableHead className="w-10"></TableHead>}
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
                  <TableRow><TableCell colSpan={canImport ? 9 : 8} className="text-center text-muted-foreground py-8">Keine Einträge.</TableCell></TableRow>
                )}
                {filtered.map((r) => {
                  const selectable = r.import_status !== "imported" && r.import_status !== "resolved";
                  return (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                    {canImport && (
                      <TableCell>
                        {selectable && (
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={(v) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(r.id); else next.delete(r.id);
                                return next;
                              });
                            }}
                          />
                        )}
                      </TableCell>
                    )}
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
