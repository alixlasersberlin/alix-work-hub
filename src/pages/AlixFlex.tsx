import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, PageError, DataCard } from '@/components/PageShell';
import { Zap, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type Row = {
  id: string;
  source_system: string | null;
  recurrence_name: string | null;
  reference_number: string | null;
  status: string | null;
  customer_name: string | null;
  company_name: string | null;
  recurrence_frequency: string | null;
  repeat_every: number | null;
  start_date: string | null;
  next_invoice_date: string | null;
  last_sent_date: string | null;
  total: number | null;
  currency: string | null;
  device_name: string | null;
};

type PageSize = 10 | 20 | 50 | 100 | 'all';

function statusVariant(s: string | null) {
  const v = (s ?? '').toLowerCase();
  if (v === 'active') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (v === 'stopped') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  if (v === 'expired') return 'bg-destructive/15 text-destructive border-destructive/30';
  return 'bg-muted text-muted-foreground border-border';
}

function sourceLabel(s: string | null) {
  if (s === 'zoho_eu_1') return '🇩🇪 DE';
  if (s === 'zoho_eu_2') return '🇦🇹 AT';
  return s ?? '–';
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

export default function AlixFlex() {
  const { roles } = useAuth();
  const isAdmin = roles.includes('Admin') || roles.includes('Super Admin');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [importing, setImporting] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('zoho_recurring_profiles')
      .select('id, source_system, recurrence_name, reference_number, status, customer_name, company_name, recurrence_frequency, repeat_every, start_date, next_invoice_date, last_sent_date, total, currency, device_name')
      .order('next_invoice_date', { ascending: true, nullsFirst: false })
      .limit(5000);
    if (error) { setError(error.message); setRows([]); }
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let res = rows;
    if (statusFilter !== 'all') res = res.filter((r) => (r.status ?? '').toLowerCase() === statusFilter);
    if (sourceFilter !== 'all') res = res.filter((r) => r.source_system === sourceFilter);
    if (q) {
      res = res.filter((r) =>
        [r.recurrence_name, r.reference_number, r.customer_name, r.company_name, r.device_name]
          .some((v) => (v ?? '').toLowerCase().includes(q))
      );
    }
    return res;
  }, [rows, search, statusFilter, sourceFilter]);

  const visible = useMemo(() => pageSize === 'all' ? filtered : filtered.slice(0, pageSize), [filtered, pageSize]);

  const runImport = async (source: 'zoho_eu_1' | 'zoho_eu_2') => {
    let page = 1;
    let totals = { imported: 0, updated: 0, failed: 0 };
    for (let i = 0; i < 50; i++) {
      const { data, error } = await supabase.functions.invoke('sync-zoho-recurring-profiles', {
        body: { source_system: source, page, max_pages: 5, per_page: 100 },
      });
      if (error) throw error;
      totals.imported += data?.imported ?? 0;
      totals.updated += data?.updated ?? 0;
      totals.failed += data?.failed ?? 0;
      if (!data?.has_more) break;
      page = (data?.last_page ?? page) + 1;
    }
    return totals;
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const de = await runImport('zoho_eu_1');
      const at = await runImport('zoho_eu_2');
      toast({
        title: 'Import abgeschlossen',
        description: `DE: ${de.imported}+/${de.updated}~ • AT: ${at.imported}+/${at.updated}~ • Fehler: ${de.failed + at.failed}`,
      });
      await fetchRows();
    } catch (e: any) {
      toast({ title: 'Import fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<Zap className="w-6 h-6 text-primary" />}
        title="ALIX FLEX"
        subtitle="Periodische Rechnungs-Stammdaten (Recurring Profile) aus Zoho Books"
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
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche: Profil, Kunde, Firma, Gerät, Referenz…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="stopped">Gestoppt</SelectItem>
              <SelectItem value="expired">Abgelaufen</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Quelle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Quellen</SelectItem>
              <SelectItem value="zoho_eu_1">🇩🇪 Alix Deutschland</SelectItem>
              <SelectItem value="zoho_eu_2">🇦🇹 Alix Austria</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'all' ? 'all' : (Number(v) as PageSize))}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {filtered.length} Profile • angezeigt: {visible.length}
        </div>
      </DataCard>

      {error && <PageError message={error} onRetry={fetchRows} />}

      {loading ? (
        <PageLoading />
      ) : (
        <DataCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">Quelle</th>
                  <th className="text-left px-3 py-3 font-medium">Profil</th>
                  <th className="text-left px-3 py-3 font-medium">Referenz</th>
                  <th className="text-left px-3 py-3 font-medium">Kunde</th>
                  <th className="text-left px-3 py-3 font-medium">Gerät</th>
                  <th className="text-left px-3 py-3 font-medium">Frequenz</th>
                  <th className="text-left px-3 py-3 font-medium">Start</th>
                  <th className="text-left px-3 py-3 font-medium">Nächste</th>
                  <th className="text-right px-3 py-3 font-medium">Betrag</th>
                  <th className="text-left px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      Keine Profile vorhanden. Klick auf „Aus Zoho importieren", um die Stammdaten zu laden.
                    </td>
                  </tr>
                ) : (
                  visible.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-3 whitespace-nowrap">{sourceLabel(r.source_system)}</td>
                      <td className="px-3 py-3 font-medium">{r.recurrence_name ?? '–'}</td>
                      <td className="px-3 py-3">{r.reference_number ?? '–'}</td>
                      <td className="px-3 py-3">{r.company_name || r.customer_name || '–'}</td>
                      <td className="px-3 py-3 max-w-[260px] truncate" title={r.device_name ?? ''}>{r.device_name ?? '–'}</td>
                      <td className="px-3 py-3">
                        {r.recurrence_frequency ?? '–'}{r.repeat_every ? ` × ${r.repeat_every}` : ''}
                      </td>
                      <td className="px-3 py-3">{fmtDate(r.start_date)}</td>
                      <td className="px-3 py-3">{fmtDate(r.next_invoice_date)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(r.total, r.currency)}</td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={statusVariant(r.status)}>{r.status ?? '–'}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}
    </div>
  );
}
