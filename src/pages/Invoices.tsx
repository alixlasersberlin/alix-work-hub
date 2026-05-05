import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, PageError, DataCard } from '@/components/PageShell';
import { FileText, RefreshCw, Search, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type Row = {
  id: string;
  invoice_number: string | null;
  reference_number: string | null;
  customer_name: string | null;
  city: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
};

type PageSize = 10 | 30 | 100 | 'all';

function statusVariant(s: string | null) {
  const v = (s ?? '').toLowerCase();
  if (v.includes('bezahlt') && !v.includes('teil')) return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (v.includes('teil')) return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  if (v.includes('über')) return 'bg-destructive/15 text-destructive border-destructive/30';
  if (v.includes('offen')) return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

function fmtMoney(n: number | null, c: string | null) {
  if (n == null) return '–';
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n); }
  catch { return `${n.toFixed(2)} ${c ?? ''}`; }
}

function fmtDate(d: string | null) {
  if (!d) return '–';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return d; }
}

export default function Invoices() {
  const { roles } = useAuth();
  const isAdmin = roles.includes('Admin') || roles.includes('Super Admin');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('zoho_invoices')
      .select('id, invoice_number, reference_number, customer_name, city, invoice_date, due_date, total, balance, currency, status, payment_status')
      .order('invoice_date', { ascending: false })
      .limit(5000);
    if (error) { setError(error.message); setRows([]); }
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let res = rows;
    if (statusFilter !== 'all') {
      res = res.filter((r) => (r.payment_status ?? '').toLowerCase() === statusFilter.toLowerCase());
    }
    if (q) {
      res = res.filter((r) =>
        [r.customer_name, r.city, r.reference_number, r.invoice_number]
          .some((v) => (v ?? '').toLowerCase().includes(q))
      );
    }
    return res;
  }, [rows, search, statusFilter]);

  const visible = useMemo(() => pageSize === 'all' ? filtered : filtered.slice(0, pageSize), [filtered, pageSize]);

  const handleMove = async (r: Row) => {
    if (!isAdmin) return;
    if (!confirm(`Rechnung ${r.invoice_number ?? ''} nach Ratenzahler verschieben?`)) return;
    try {
      const { data: full, error: fetchErr } = await supabase
        .from('zoho_invoices').select('*').eq('id', r.id).maybeSingle();
      if (fetchErr || !full) throw fetchErr ?? new Error('Datensatz nicht gefunden');
      const { id, created_at, updated_at, synced_at, ...rest } = full as any;
      const { error: insErr } = await supabase.from('zoho_recurring_invoices').upsert(
        { ...rest, synced_at: new Date().toISOString() },
        { onConflict: 'source_system,zoho_invoice_id' },
      );
      if (insErr) throw insErr;
      const { error: delErr } = await supabase.from('zoho_invoices').delete().eq('id', r.id);
      if (delErr) throw delErr;
      toast({ title: 'Verschoben', description: `Rechnung nach Ratenzahler verschoben.` });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e: any) {
      toast({ title: 'Verschieben fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress('Starte Import…');
    try {
      let page = 1;
      let totalImported = 0, totalUpdated = 0, totalFailed = 0, totalSkipped = 0;
      for (let i = 0; i < 100; i++) {
        const { data, error } = await supabase.functions.invoke('sync-zoho-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: '2025-01-01', page, max_pages: 1, per_page: 100, exclude_profile_name: 'SEPA Ratenzahler' },
        });
        if (error) throw error;
        if (data?.retryable) {
          toast({ title: 'Zoho API-Limit', description: `Bitte in ${data.retry_after_seconds ?? 90}s erneut versuchen`, variant: 'destructive' });
          break;
        }
        totalImported += data?.imported ?? 0;
        totalUpdated += data?.updated ?? 0;
        totalFailed += data?.failed ?? 0;
        totalSkipped += data?.skipped_sepa ?? 0;
        setProgress(`Seite ${page} • Neu: ${totalImported} • Aktualisiert: ${totalUpdated} • SEPA übersprungen: ${totalSkipped}`);
        if (!data?.has_more) break;
        page = (data?.last_page ?? page) + 1;
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast({
        title: 'Import abgeschlossen',
        description: `Neu: ${totalImported} • Aktualisiert: ${totalUpdated} • SEPA übersprungen: ${totalSkipped} • Fehler: ${totalFailed}`,
      });
      await fetchRows();
    } catch (e: any) {
      toast({ title: 'Import fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<FileText className="w-6 h-6 text-primary" />}
        title="Rechnungen"
        subtitle="Zoho Books Rechnungen ab 01.01.2025 (ohne SEPA Ratenzahler & periodische Rechnungen)"
        actions={
          isAdmin && (
            <Button onClick={handleImport} disabled={importing} className="gold-gradient text-primary-foreground">
              <RefreshCw className={`w-4 h-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
              {importing ? 'Import läuft…' : 'Aus Zoho importieren'}
            </Button>
          )
        }
      />

      <DataCard className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche: Name, Ort, Rechnungs-/Referenznr.…" className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="Bezahlt">Bezahlt</SelectItem>
                <SelectItem value="Offen">Unbezahlt / Offen</SelectItem>
                <SelectItem value="Überfällig">Überfällig</SelectItem>
                <SelectItem value="Teilweise bezahlt">Teilweise bezahlt</SelectItem>
                <SelectItem value="sent">Gesendet</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Anzeige:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'all' ? 'all' : (Number(v) as PageSize))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {filtered.length} Treffer{search ? ` für "${search}"` : ''} • angezeigt: {visible.length}
          {progress && <> • <span className="text-primary">{progress}</span></>}
        </div>
      </DataCard>

      {error && <PageError message={error} onRetry={fetchRows} />}

      {loading ? <PageLoading /> : (
        <DataCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Rechnung</th>
                  <th className="text-left px-4 py-3 font-medium">Referenz</th>
                  <th className="text-left px-4 py-3 font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium">Ort</th>
                  <th className="text-left px-4 py-3 font-medium">Datum</th>
                  <th className="text-left px-4 py-3 font-medium">Fällig</th>
                  <th className="text-right px-4 py-3 font-medium">Betrag</th>
                  <th className="text-right px-4 py-3 font-medium">Saldo</th>
                  <th className="text-left px-4 py-3 font-medium">Zahlungsstatus</th>
                  {isAdmin && <th className="text-right px-4 py-3 font-medium">Aktion</th>}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 10 : 9} className="px-4 py-12 text-center text-muted-foreground">
                    Keine Daten. Klicken Sie auf „Aus Zoho importieren", um zu starten.
                  </td></tr>
                ) : visible.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{r.invoice_number ?? '–'}</td>
                    <td className="px-4 py-3">{r.reference_number ?? '–'}</td>
                    <td className="px-4 py-3">{r.customer_name ?? '–'}</td>
                    <td className="px-4 py-3">{r.city ?? '–'}</td>
                    <td className="px-4 py-3">{fmtDate(r.invoice_date)}</td>
                    <td className="px-4 py-3">{fmtDate(r.due_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.total, r.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.balance, r.currency)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusVariant(r.payment_status)}>
                        {r.payment_status ?? '–'}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => handleMove(r)}>
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> VERSCHIEBE
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}
    </div>
  );
}
