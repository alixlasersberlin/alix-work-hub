import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/infinity/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type SourceKey = "zoho_eu_1" | "zoho_eu_2";
const SOURCES: { key: SourceKey; label: string; flag: string }[] = [
  { key: "zoho_eu_1", label: "Alix Deutschland", flag: "🇩🇪" },
  { key: "zoho_eu_2", label: "Alix Austria", flag: "🇦🇹" },
];

interface SourceResult {
  source: SourceKey;
  zoho_total?: number;
  local_total?: number;
  missing_count?: number;
  missing?: Array<{ salesorder_id: string; salesorder_number: string; date?: string; status?: string; customer_name?: string; total?: number }>;
  imported?: number;
  failed?: number;
  import_errors?: Array<{ id: string; number: string; message: string }>;
  truncated?: boolean;
  error?: string;
}

type EntityKey = "orders" | "offers";
const ENTITIES: { key: EntityKey; label: string; fn: string }[] = [
  { key: "orders", label: "Aufträge (Salesorders)", fn: "zoho-orders-reconcile" },
  { key: "offers", label: "Angebote (Estimates)", fn: "zoho-offers-reconcile" },
];

export default function ZohoAbgleich() {
  const [loading, setLoading] = useState<"check" | "import" | null>(null);
  const [selected, setSelected] = useState<Record<SourceKey, boolean>>({ zoho_eu_1: true, zoho_eu_2: true });
  const [entitySel, setEntitySel] = useState<Record<EntityKey, boolean>>({ orders: true, offers: false });
  const [results, setResults] = useState<Array<SourceResult & { entity: EntityKey }> | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  async function run(doImport: boolean) {
    const sources = SOURCES.filter((s) => selected[s.key]).map((s) => s.key);
    const entities = ENTITIES.filter((e) => entitySel[e.key]);
    if (sources.length === 0) {
      toast({ title: "Keine Quelle gewählt", variant: "destructive" });
      return;
    }
    if (entities.length === 0) {
      toast({ title: "Kein Import-Typ gewählt", variant: "destructive" });
      return;
    }
    setLoading(doImport ? "import" : "check");
    setResults(null);
    setDurationMs(null);
    try {
      const responses = await Promise.all(entities.map(async (ent) => {
        const { data, error } = await supabase.functions.invoke(ent.fn, { body: { sources, import: doImport } });
        if (error) throw error;
        return { ent, data };
      }));
      const merged: Array<SourceResult & { entity: EntityKey }> = [];
      let totalMs = 0;
      for (const { ent, data } of responses) {
        totalMs = Math.max(totalMs, data?.duration_ms ?? 0);
        for (const r of (data?.results ?? []) as SourceResult[]) {
          merged.push({ ...r, entity: ent.key });
        }
      }
      setResults(merged);
      setDurationMs(totalMs);
      const totalMissing = merged.reduce((s, r) => s + (r.missing_count ?? 0), 0);
      const totalImported = merged.reduce((s, r) => s + (r.imported ?? 0), 0);
      toast({
        title: doImport ? `${totalImported} Datensätze importiert` : `${totalMissing} fehlende Datensätze`,
        description: doImport ? "Import abgeschlossen." : "Prüfung abgeschlossen.",
      });
    } catch (e: any) {
      toast({ title: "Fehler", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Zoho ⇄ AlixWork Abgleich"
        subtitle="Prüft Aufträge und Angebote in Zoho (Deutschland & Österreich) und importiert fehlende in AlixWork."
      />

      <Card>
        <CardHeader>
          <CardTitle>Quellen & Import-Typ wählen</CardTitle>
          <CardDescription>Beide Mandanten aktiv, Aufträge standardmäßig. Angebote optional zuschalten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2 text-muted-foreground">Mandanten</div>
            <div className="flex flex-wrap gap-3">
              {SOURCES.map((s) => (
                <label key={s.key} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected[s.key]}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                  />
                  <span>{s.flag} {s.label}</span>
                  <Badge variant="outline" className="ml-2">{s.key}</Badge>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2 text-muted-foreground">Import-Typ</div>
            <div className="flex flex-wrap gap-3">
              {ENTITIES.map((e) => (
                <label key={e.key} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entitySel[e.key]}
                    onChange={(ev) => setEntitySel((prev) => ({ ...prev, [e.key]: ev.target.checked }))}
                  />
                  <span>{e.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={() => run(false)} disabled={loading !== null} variant="outline">
              {loading === "check" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Nur prüfen (Diff)
            </Button>
            <Button onClick={() => run(true)} disabled={loading !== null}>
              {loading === "import" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Fehlende importieren
            </Button>
            {durationMs !== null && (
              <span className="text-sm text-muted-foreground self-center">Dauer: {(durationMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        </CardContent>
      </Card>

      {results?.map((r) => {
        const src = SOURCES.find((s) => s.key === r.source);
        const ent = ENTITIES.find((e) => e.key === r.entity);
        return (
          <Card key={`${r.entity}-${r.source}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {src?.flag} {src?.label}
                <Badge variant="secondary" className="ml-1">{ent?.label}</Badge>
                {r.error ? (
                  <Badge variant="destructive" className="ml-2"><AlertTriangle className="h-3 w-3 mr-1" />Fehler</Badge>
                ) : (r.missing_count ?? 0) === 0 ? (
                  <Badge className="ml-2 bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />Vollständig</Badge>
                ) : (
                  <Badge variant="outline" className="ml-2">{r.missing_count} fehlen</Badge>
                )}
                {r.truncated && <Badge variant="outline" className="ml-2">gekürzt (Timeout)</Badge>}
              </CardTitle>
              <CardDescription>
                {r.error ? r.error : (
                  <>
                    Zoho: <b>{r.zoho_total}</b> · Lokal: <b>{r.local_total}</b> · Fehlend: <b>{r.missing_count}</b>
                    {typeof r.imported === "number" && r.imported > 0 && <> · Importiert: <b className="text-emerald-600">{r.imported}</b></>}
                    {typeof r.failed === "number" && r.failed > 0 && <> · Fehlgeschlagen: <b className="text-destructive">{r.failed}</b></>}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            {!!r.missing?.length && (
              <CardContent>
                <div className="max-h-96 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{r.entity === "offers" ? "Angebotsnummer" : "Auftragsnummer"}</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Kunde</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Betrag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.missing.map((m) => (
                        <TableRow key={m.salesorder_id}>
                          <TableCell className="font-mono text-xs">{m.salesorder_number}</TableCell>
                          <TableCell>{m.date ?? "-"}</TableCell>
                          <TableCell>{m.customer_name ?? "-"}</TableCell>
                          <TableCell><Badge variant="outline">{m.status ?? "-"}</Badge></TableCell>
                          <TableCell className="text-right">{m.total?.toLocaleString("de-DE", { style: "currency", currency: "EUR" }) ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
            {!!r.import_errors?.length && (
              <CardContent>
                <div className="text-sm font-semibold mb-2 text-destructive">Import-Fehler ({r.import_errors.length})</div>
                <div className="max-h-64 overflow-auto rounded-md border p-3 space-y-1 text-xs font-mono">
                  {r.import_errors.map((e, i) => (
                    <div key={i}>• {e.number} ({e.id}): {e.message}</div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
