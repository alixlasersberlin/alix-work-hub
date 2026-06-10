import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader, PageLoading, PageError, DataCard } from '@/components/PageShell';
import { FileText, RefreshCw, ArrowRightLeft, ChevronDown, ChevronRight, Users, Wallet, AlertTriangle, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';

type Row = {
  id: string;
  source: 'invoice' | 'recurring';
  invoice_number: string | null;
  reference_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  city: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
  last_payment_date: string | null;
};

type Account = {
  key: string;
  customer_id: string | null;
  customer_name: string;
  city: string | null;
  rows: Row[];
  totalInvoices: number;
  totalRecurring: number;
  totalAmount: number;
  totalOpen: number;
  overdueCount: number;
  lastInvoiceDate: string | null;
};

function statusVariant(s: string | null) {
  const v = (s ?? '').toLowerCase();
  if (v.includes('bezahlt') && !v.includes('teil')) return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (v.includes('teil')) return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  if (v.includes('über')) return 'bg-destructive/15 text-destructive border-destructive/30';
  if (v.includes('offen')) return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

function fmtMoney(n: number | null, c: string | null = 'EUR') {
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    const cols = 'id, invoice_number, reference_number, customer_id, customer_name, city, invoice_date, due_date, total, balance, currency, status, payment_status, last_payment_date';
    const [inv, rec] = await Promise.all([
      supabase.from('zoho_invoices').select(cols).order('invoice_date', { ascending: false }).limit(10000),
      supabase.from('zoho_recurring_invoices').select(cols).order('invoice_date', { ascending: false }).limit(10000),
    ]);
    if (inv.error || rec.error) {
      setError(inv.error?.message || rec.error?.message || 'Fehler beim Laden');
      setRows([]);
    } else {
      const merged: Row[] = [
        ...(inv.data ?? []).map((r: any) => ({ ...r, source: 'invoice' as const })),
        ...(rec.data ?? []).map((r: any) => ({ ...r, source: 'recurring' as const })),
      ];
      setRows(merged);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const accounts = useMemo<Account[]>(() => {
    const q = search.trim().toLowerCase();
    let res = rows;
    if (statusFilter !== 'all') {
      res = res.filter((r) => (r.payment_status ?? '').toLowerCase() === statusFilter.toLowerCase());
    }
    if (q) {
      res = res.filter((r) =>
        [r.customer_name, r.city, r.reference_number, r.invoice_number, r.customer_id]
          .some((v) => (v ?? '').toLowerCase().includes(q))
      );
    }
    const map = new Map<string, Account>();
    const today = new Date().toISOString().slice(0, 10);
    for (const r of res) {
      const key = r.customer_id || `name:${(r.customer_name ?? 'Unbekannt').toLowerCase()}`;
      let acc = map.get(key);
      if (!acc) {
        acc = {
          key,
          customer_id: r.customer_id,
          customer_name: r.customer_name ?? 'Unbekannt',
          city: r.city,
          rows: [],
          totalInvoices: 0, totalRecurring: 0,
          totalAmount: 0, totalOpen: 0, overdueCount: 0,
          lastInvoiceDate: null,
        };
        map.set(key, acc);
      }
      acc.rows.push(r);
      if (r.source === 'invoice') acc.totalInvoices++; else acc.totalRecurring++;
      acc.totalAmount += Number(r.total ?? 0);
      acc.totalOpen += Number(r.balance ?? 0);
      const isOverdue = (r.balance ?? 0) > 0 && r.due_date && r.due_date < today;
      if (isOverdue) acc.overdueCount++;
      if (!acc.lastInvoiceDate || (r.invoice_date && r.invoice_date > acc.lastInvoiceDate)) {
        acc.lastInvoiceDate = r.invoice_date;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [rows, search, statusFilter]);

  const kpi = useMemo(() => ({
    accounts: accounts.length,
    invoices: accounts.reduce((s, a) => s + a.totalInvoices + a.totalRecurring, 0),
    totalAmount: accounts.reduce((s, a) => s + a.totalAmount, 0),
    totalOpen: accounts.reduce((s, a) => s + a.totalOpen, 0),
  }), [accounts]);

  const handleMove = async (r: Row) => {
    if (!isAdmin || r.source !== 'invoice') return;
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

  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));
  const expandAll = () => setExpanded(Object.fromEntries(accounts.map((a) => [a.key, true])));
  const collapseAll = () => setExpanded({});

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={<FileText className="w-6 h-6 text-primary" />}
        title="Rechnungen nach Kundenkonto"
        subtitle="Konsolidierte Übersicht aller Zoho-Rechnungen (einmalig + periodisch) je Kunde"
        actions={
          isAdmin && (
            <Button onClick={handleImport} disabled={importing} className="gold-gradient text-primary-foreground">
              <RefreshCw className={`w-4 h-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
              {importing ? 'Import läuft…' : 'Aus Zoho importieren'}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <DataCard className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-4 h-4" />Kundenkonten</div>
          <div className="text-2xl font-semibold mt-1">{kpi.accounts}</div>
        </DataCard>
        <DataCard className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileText className="w-4 h-4" />Rechnungen gesamt</div>
          <div className="text-2xl font-semibold mt-1">{kpi.invoices}</div>
        </DataCard>
        <DataCard className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="w-4 h-4" />Volumen</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{fmtMoney(kpi.totalAmount)}</div>
        </DataCard>
        <DataCard className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="w-4 h-4" />Offene Beträge</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums text-amber-500">{fmtMoney(kpi.totalOpen)}</div>
        </DataCard>
      </div>

      <DataCard className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Suche: Kunde, Ort, Rechnungs-/Referenznr.…" className="pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Zahlungsstatus:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="Bezahlt">Bezahlt</SelectItem>
                <SelectItem value="Offen">Unbezahlt / Offen</SelectItem>
                <SelectItem value="Überfällig">Überfällig</SelectItem>
                <SelectItem value="Teilweise bezahlt">Teilweise bezahlt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={expandAll}>Alle öffnen</Button>
            <Button size="sm" variant="outline" onClick={collapseAll}>Alle schließen</Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {accounts.length} Kundenkonten{search ? ` für "${search}"` : ''}
          {progress && <> • <span className="text-primary">{progress}</span></>}
        </div>
      </DataCard>

      {error && <PageError message={error} onRetry={fetchRows} />}

      {loading ? <PageLoading /> : (
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <DataCard className="p-12 text-center text-muted-foreground">
              Keine Daten gefunden.
            </DataCard>
          ) : accounts.map((a) => {
            const open = !!expanded[a.key];
            return (
              <DataCard key={a.key} className="overflow-hidden">
                <button
                  onClick={() => toggle(a.key)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 text-left"
                >
                  {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.customer_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.city ?? '–'} {a.customer_id ? `• #${a.customer_id}` : ''} • Letzte: {fmtDate(a.lastInvoiceDate)}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <Badge variant="outline" className="bg-muted/40">{a.totalInvoices} Rg.</Badge>
                    {a.totalRecurring > 0 && (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Repeat className="w-3 h-3 mr-1" />{a.totalRecurring}
                      </Badge>
                    )}
                    {a.overdueCount > 0 && (
                      <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
                        {a.overdueCount} überfällig
                      </Badge>
                    )}
                  </div>
                  <div className="text-right tabular-nums w-32">
                    <div className="text-sm font-semibold">{fmtMoney(a.totalAmount)}</div>
                    {a.totalOpen > 0 && <div className="text-xs text-amber-500">offen: {fmtMoney(a.totalOpen)}</div>}
                  </div>
                </button>
                {open && (
                  <div className="border-t border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Typ</th>
                          <th className="text-left px-4 py-2 font-medium">Rechnung</th>
                          <th className="text-left px-4 py-2 font-medium">Referenz</th>
                          <th className="text-left px-4 py-2 font-medium">Datum</th>
                          <th className="text-left px-4 py-2 font-medium">Fällig</th>
                          <th className="text-right px-4 py-2 font-medium">Betrag</th>
                          <th className="text-right px-4 py-2 font-medium">Saldo</th>
                          <th className="text-left px-4 py-2 font-medium">Letzte Zahlung</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                          {isAdmin && <th className="text-right px-4 py-2 font-medium">Aktion</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {a.rows.map((r) => (
                          <tr key={`${r.source}-${r.id}`} className="border-t border-border hover:bg-muted/10">
                            <td className="px-4 py-2">
                              {r.source === 'recurring' ? (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                  <Repeat className="w-3 h-3 mr-1" />Periodisch
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted/40">Einmalig</Badge>
                              )}
                            </td>
                            <td className="px-4 py-2 font-medium">{r.invoice_number ?? '–'}</td>
                            <td className="px-4 py-2">{r.reference_number ?? '–'}</td>
                            <td className="px-4 py-2">{fmtDate(r.invoice_date)}</td>
                            <td className="px-4 py-2">{fmtDate(r.due_date)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.total, r.currency)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.balance, r.currency)}</td>
                            <td className="px-4 py-2">{fmtDate(r.last_payment_date)}</td>
                            <td className="px-4 py-2">
                              <Badge variant="outline" className={statusVariant(r.payment_status)}>
                                {r.payment_status ?? '–'}
                              </Badge>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-2 text-right">
                                {r.source === 'invoice' && (
                                  <Button size="sm" variant="outline" onClick={() => handleMove(r)}>
                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Ratenzahler
                                  </Button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DataCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
