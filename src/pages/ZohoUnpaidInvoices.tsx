import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertCircle, CalendarIcon, X, ChevronRight, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/PageShell";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

type SortKey = "age" | "customer" | "total";
type SortDir = "asc" | "desc";

const fmtMoney = (v: number | null, cur?: string | null) =>
  v == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(Number(v));

const fmtDate = (s: string | null) =>
  !s ? "—" : new Date(s).toLocaleDateString("de-DE");

const ageDays = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s).getTime();
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86_400_000);
};

export default function ZohoUnpaidInvoices() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<string>("__all__");
  const [sortKey, setSortKey] = useState<SortKey>("age");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [dateField, setDateField] = useState<"invoice_date" | "due_date">("due_date");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [groupByCustomer, setGroupByCustomer] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("zoho_unpaid_invoices")
      .select("*")
      .order("due_date", { ascending: true })
      .limit(2000);
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

  const customers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.customer_name && set.add(r.customer_name));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime() : null;
    const to = dateTo ? new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59).getTime() : null;

    let list = rows.filter((r) => {
      if (q && ![r.invoice_number, r.customer_name].some((v) => (v ?? "").toLowerCase().includes(q))) return false;
      if (customer !== "__all__" && r.customer_name !== customer) return false;
      if (from || to) {
        const v = r[dateField];
        if (!v) return false;
        const t = new Date(v).getTime();
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === "customer") {
        return (a.customer_name ?? "").localeCompare(b.customer_name ?? "", "de") * dir;
      }
      if (sortKey === "total") {
        return (Number(a.total ?? 0) - Number(b.total ?? 0)) * dir;
      }
      // age = days since invoice_date (older = higher)
      const aa = ageDays(a.invoice_date) ?? -1;
      const bb = ageDays(b.invoice_date) ?? -1;
      return (aa - bb) * dir;
    });
    return list;
  }, [rows, search, customer, sortKey, sortDir, dateField, dateFrom, dateTo]);

  const totalOpen = filtered.reduce((sum, r) => sum + Number(r.balance ?? 0), 0);
  const totalSum = filtered.reduce((sum, r) => sum + Number(r.total ?? 0), 0);

  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); };

  return (
    <div className="container mx-auto p-6">
      <PageHeader title="Unbezahlte Rechnungen (Zoho)" subtitle="Direkter Abgleich aus Zoho Books – Status: unpaid" />
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Übersicht</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {filtered.length} Rechnungen · Gesamt: <strong>{fmtMoney(totalSum)}</strong> · Offen: <strong>{fmtMoney(totalOpen)}</strong>
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
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-2 border-t">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Kunde</label>
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Alle Kunden" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="__all__">Alle Kunden ({customers.length})</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Sortieren nach</label>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="age">Alter</SelectItem>
                  <SelectItem value="customer">Kunde</SelectItem>
                  <SelectItem value="total">Gesamtsumme</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Richtung</label>
              <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Absteigend</SelectItem>
                  <SelectItem value="asc">Aufsteigend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Datumsfeld</label>
              <Select value={dateField} onValueChange={(v) => setDateField(v as any)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">Fälligkeitsdatum</SelectItem>
                  <SelectItem value="invoice_date">Rechnungsdatum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Von</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd.MM.yyyy", { locale: de }) : "Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Bis</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-40 justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd.MM.yyyy", { locale: de }) : "Datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            {(dateFrom || dateTo || customer !== "__all__") && (
              <Button variant="ghost" size="sm" onClick={() => { clearDates(); setCustomer("__all__"); }}>
                <X className="h-4 w-4 mr-1" /> Filter zurücksetzen
              </Button>
            )}
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
                  <TableHead className="text-right">Alter (Tage)</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead className="text-right">Offen</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Lade…
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Keine Daten. Klicke „Jetzt synchronisieren" um Daten aus Zoho zu laden.
                  </TableCell></TableRow>
                ) : (
                  filtered.map((r) => {
                    const age = ageDays(r.invoice_date);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.invoice_number ?? "—"}</TableCell>
                        <TableCell>{r.customer_name ?? "—"}</TableCell>
                        <TableCell>{fmtDate(r.invoice_date)}</TableCell>
                        <TableCell>{fmtDate(r.due_date)}</TableCell>
                        <TableCell className="text-right">{age == null ? "—" : age}</TableCell>
                        <TableCell className="text-right">{fmtMoney(r.total, r.currency_code)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtMoney(r.balance, r.currency_code)}</TableCell>
                        <TableCell><Badge variant="outline">{r.status ?? "—"}</Badge></TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
