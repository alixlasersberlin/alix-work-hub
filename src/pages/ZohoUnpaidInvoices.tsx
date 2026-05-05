import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import PageShell from "@/components/PageShell";

type Row = {
  id: string;
  invoice_id: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  status: string | null;
  currency_code: string | null;
  synced_at: string | null;
};

const fmtMoney = (v: number | null, cur?: string | null) =>
  v == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(Number(v));

const fmtDate = (s: string | null) =>
  !s ? "—" : new Date(s).toLocaleDateString("de-DE");

export default function ZohoUnpaidInvoices() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("zoho_unpaid_invoices")
      .select("*")
      .order("due_date", { ascending: true })
      .limit(1000);
    if (error) setError(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-zoho-unpaid-invoices", { body: {} });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      toast.success(`Sync abgeschlossen: ${d.imported} neu, ${d.updated} aktualisiert${d.failed ? `, ${d.failed} Fehler` : ""}`);
      await load();
    } catch (e: any) {
      const msg = e?.message ?? "Unbekannter Fehler beim Sync";
      setError(msg);
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) =>
      [r.invoice_number, r.customer_name].some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totalOpen = filtered.reduce((sum, r) => sum + Number(r.balance ?? 0), 0);

  return (
    <PageShell title="Unbezahlte Rechnungen (Zoho)" description="Direkter Abgleich aus Zoho Books – Status: unpaid">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Übersicht</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length} Rechnungen · Offen gesamt: <strong>{fmtMoney(totalOpen)}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Suche Rechnungs-Nr. oder Kunde…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72"
            />
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Jetzt synchronisieren
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 mb-4 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive" />
              <div className="text-destructive">{error}</div>
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rechnungsnr.</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Fälligkeit</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Offen</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Lade…
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Keine Daten. Klicke „Jetzt synchronisieren" um Daten aus Zoho zu laden.
                  </TableCell></TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.invoice_number ?? "—"}</TableCell>
                      <TableCell>{r.customer_name ?? "—"}</TableCell>
                      <TableCell>{fmtDate(r.invoice_date)}</TableCell>
                      <TableCell>{fmtDate(r.due_date)}</TableCell>
                      <TableCell className="text-right">{fmtMoney(r.total, r.currency_code)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtMoney(r.balance, r.currency_code)}</TableCell>
                      <TableCell><Badge variant="outline">{r.status ?? "—"}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
