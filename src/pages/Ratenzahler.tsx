import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Banknote, RefreshCw, ArrowRightLeft, Search, CheckCircle2, PlusCircle, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';

type Row = {
  id: string;
  invoice_number: string | null;
  reference_number: string | null;
  customer_name: string | null;
  device_name: string | null;
  city: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  status: string | null;
  payment_status: string | null;
};
type ChangeDiff = { field: string; old: unknown; new: unknown };
type ChangeEntry = {
  kind: 'new' | 'update';
  invoice_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  total: number | null;
  currency: string | null;
  diffs: ChangeDiff[];
};
type PreviewResult = {
  newCount: number;
  updateCount: number;
  unchanged: number;
  duplicates: number;
  failed: number;
  profiles: number;
  truncated: boolean;
  changes: ChangeEntry[];
};

const FIELD_LABELS: Record<string, string> = {
  invoice_number: 'Rechnungsnr.',
  reference_number: 'Auftragsnr.',
  customer_name: 'Kunde',
  device_name: 'Gerät',
  city: 'Ort',
  invoice_date: 'Datum',
  due_date: 'Fällig',
  currency: 'Währung',
  total: 'Betrag',
  balance: 'Saldo',
  status: 'Status',
  payment_status: 'Zahlungsstatus',
  last_payment_date: 'Letzte Zahlung',
  accounting_region: 'Buchungskreis',
};



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
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n);
  } catch {
    return `${n.toFixed(2)} ${c ?? ''}`;
  }
}

function fmtDate(d: string | null) {
  if (!d) return '–';
  try {
    return new Date(d).toLocaleDateString('de-DE');
  } catch {
    return d;
  }
}

export default function Ratenzahler() {
  const { roles } = useAuth();
  const isAdmin = roles.includes('Admin') || (roles.includes('Super Admin') || roles.includes('Admin'));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importing, setImporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<{ page: number; pct: number; label: string } | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('zoho_recurring_invoices')
      .select('id, invoice_number, reference_number, customer_name, device_name, city, invoice_date, due_date, total, balance, currency, status, payment_status')
      .order('invoice_date', { ascending: false })
      .limit(5000);
    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filtered = useMemo(() => {
    let res = rows;
    if (statusFilter !== 'all') {
      res = res.filter((r) => (r.payment_status ?? '').toLowerCase() === statusFilter.toLowerCase());
    }
    return res.filter((r) => matchesQuery(r, search));
  }, [rows, search, statusFilter]);

  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);

  const handleMove = async (r: Row) => {
    if (!isAdmin) return;
    if (!confirm(`Rechnung ${r.invoice_number ?? ''} nach Rechnungen verschieben?`)) return;
    try {
      const { data: full, error: fetchErr } = await supabase
        .from('zoho_recurring_invoices').select('*').eq('id', r.id).maybeSingle();
      if (fetchErr || !full) throw fetchErr ?? new Error('Datensatz nicht gefunden');
      const { id, created_at, updated_at, synced_at, device_name, zoho_recurring_invoice_id, ...rest } = full as any;
      const { error: insErr } = await supabase.from('zoho_invoices').upsert(
        { ...rest, synced_at: new Date().toISOString() },
        { onConflict: 'source_system,zoho_invoice_id' },
      );
      if (insErr) throw insErr;
      const { error: delErr } = await supabase.from('zoho_recurring_invoices').delete().eq('id', r.id);
      if (delErr) throw delErr;
      toast({ title: 'Verschoben', description: `Rechnung nach Rechnungen verschoben.` });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e: any) {
      toast({ title: 'Verschieben fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    }
  };

  const MAX_PAGES = 50;

  /** Phase 1: Vorschau – nichts schreiben, nur Abweichungen zum Bestand ermitteln. */
  const handleCheck = async () => {
    setChecking(true);
    setProgress({ page: 1, pct: 2, label: 'Verbinde mit Zoho…' });
    try {
      let page = 1;
      const acc: PreviewResult = {
        newCount: 0, updateCount: 0, unchanged: 0, duplicates: 0,
        failed: 0, profiles: 0, truncated: false, changes: [],
      };
      for (let i = 0; i < MAX_PAGES; i++) {
        setProgress({
          page,
          pct: Math.min(95, Math.round(((i + 1) / MAX_PAGES) * 100)),
          label: `Prüfe Profil-Seite ${page} • ${acc.newCount} neu / ${acc.updateCount} geändert`,
        });
        const { data, error } = await supabase.functions.invoke('sync-zoho-recurring-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: '2025-01-01', page, max_pages: 1, per_page: 50, dry_run: true },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        acc.newCount += data?.imported ?? 0;
        acc.updateCount += data?.updated ?? 0;
        acc.unchanged += data?.unchanged ?? 0;
        acc.duplicates += data?.duplicates ?? 0;
        acc.failed += data?.failed ?? 0;
        acc.profiles += data?.profiles_processed ?? 0;
        acc.truncated = acc.truncated || data?.changes_truncated === true;
        for (const c of (data?.changes ?? []) as ChangeEntry[]) {
          if (acc.changes.length < 1000) acc.changes.push(c);
          else acc.truncated = true;
        }
        if (!data?.profiles_have_more) break;
        page = (data?.last_profile_page ?? page) + 1;
      }
      setProgress({ page, pct: 100, label: 'Prüfung abgeschlossen' });
      setPreview(acc);
      setPreviewOpen(true);
    } catch (e: any) {
      toast({ title: 'Prüfung fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setChecking(false);
      setTimeout(() => setProgress(null), 1200);
    }
  };

  /** Phase 2: Übernahme nach Bestätigung der angezeigten Änderungen. */
  const handleImport = async () => {
    setPreviewOpen(false);
    setImporting(true);
    setProgress({ page: 1, pct: 2, label: 'Übernahme startet…' });
    try {
      let page = 1;
      let totalImported = 0, totalUpdated = 0, totalFailed = 0;
      // Iterate until Zoho reports no more recurring profiles. Each call processes
      // a small batch to stay within the edge function's resource limits.
      for (let i = 0; i < MAX_PAGES; i++) {
        setProgress({
          page,
          pct: Math.min(95, Math.round(((i + 1) / MAX_PAGES) * 100)),
          label: `Übernehme Profil-Seite ${page} • ${totalImported} neu / ${totalUpdated} aktualisiert`,
        });
        const { data, error } = await supabase.functions.invoke('sync-zoho-recurring-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: '2025-01-01', page, max_pages: 1, per_page: 50 },
        });
        if (error) throw error;
        totalImported += data?.imported ?? 0;
        totalUpdated += data?.updated ?? 0;
        totalFailed += data?.failed ?? 0;
        if (!data?.profiles_have_more) break;
        page = (data?.last_profile_page ?? page) + 1;
      }
      setProgress({ page, pct: 100, label: 'Import abgeschlossen' });
      toast({
        title: 'Import abgeschlossen',
        description: `Neu: ${totalImported} • Aktualisiert: ${totalUpdated} • Fehler: ${totalFailed}`,
      });
      setPreview(null);
      await fetchRows();
    } catch (e: any) {
      toast({ title: 'Import fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setImporting(false);
      setTimeout(() => setProgress(null), 1200);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={Banknote}
        title="Ratenzahler"
        subtitle="Periodische Rechnungen aus Zoho Books mit Zahlungsstatus"
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${rows.length} Raten`} pulse={loading} />}
        actions={
          isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleCheck} disabled={checking || importing}>
                <Search className={`w-4 h-4 mr-2 ${checking ? 'animate-pulse' : ''}`} />
                {checking ? 'Prüfe Bestand…' : 'Bestand prüfen'}
              </Button>
              {preview && (
                <Button onClick={() => setPreviewOpen(true)} disabled={importing} className="gold-gradient text-primary-foreground">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Änderungen ({preview.newCount + preview.updateCount})
                </Button>
              )}
            </div>
          )
        }
      />

      {progress && (
        <DataCard className="mb-4 p-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="font-medium">{progress.label}</span>
            <span className="tabular-nums text-muted-foreground">{progress.pct}%</span>
          </div>
          <Progress value={progress.pct} />
        </DataCard>
      )}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={filtered.length}
        visible={visible.length}
      >
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
      </ListToolbar>

      {error && <PageError message={error} onRetry={fetchRows} />}

      {loading ? (
        <DataCard><SkeletonTable rows={10} cols={6} /></DataCard>
      ) : (
        <DataCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Rechnung</th>
                  <th className="text-left px-4 py-3 font-medium">Auftragsnr.</th>
                  <th className="text-left px-4 py-3 font-medium">Kunde</th>
                  <th className="text-left px-4 py-3 font-medium">Gerät</th>
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
                  <tr>
                    <td colSpan={isAdmin ? 11 : 10} className="px-4 py-12 text-center text-muted-foreground">
                      Keine Daten. Klicken Sie auf „Bestand prüfen", um Änderungen aus Zoho zu ermitteln.
                    </td>
                  </tr>
                ) : (
                  visible.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{r.invoice_number ?? '–'}</td>
                      <td className="px-4 py-3">{r.reference_number ?? '–'}</td>
                      <td className="px-4 py-3">{r.customer_name ?? '–'}</td>
                      <td className="px-4 py-3 max-w-[260px] truncate" title={r.device_name ?? ''}>{r.device_name ?? '–'}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Änderungen prüfen &amp; bestätigen</DialogTitle>
            <DialogDescription>
              Vorschau aus Zoho – es wurde noch nichts gespeichert. Erst nach Bestätigung werden die Daten übernommen.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Neu</div>
                  <div className="text-xl font-semibold tabular-nums text-emerald-500">{preview.newCount}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Geändert</div>
                  <div className="text-xl font-semibold tabular-nums text-amber-500">{preview.updateCount}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Unverändert</div>
                  <div className="text-xl font-semibold tabular-nums">{preview.unchanged}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Duplikate / Fehler</div>
                  <div className="text-xl font-semibold tabular-nums">{preview.duplicates} / {preview.failed}</div>
                </div>
              </div>

              <ScrollArea className="h-[320px] mt-3 rounded-lg border border-border">
                {preview.changes.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Keine Abweichungen gefunden – der Bestand ist aktuell.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {preview.changes.map((c, i) => (
                      <div key={`${c.invoice_number ?? 'x'}-${i}`} className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {c.kind === 'new' ? (
                            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                              <PlusCircle className="w-3 h-3 mr-1" /> Neu
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-500 border-amber-500/30">
                              <PencilLine className="w-3 h-3 mr-1" /> Änderung
                            </Badge>
                          )}
                          <span className="font-medium">{c.invoice_number ?? '–'}</span>
                          <span className="text-muted-foreground">{c.customer_name ?? '–'}</span>
                          <span className="text-muted-foreground text-xs">{fmtDate(c.invoice_date)}</span>
                          <span className="ml-auto tabular-nums">{fmtMoney(c.total, c.currency)}</span>
                        </div>
                        {c.diffs.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs">
                            {c.diffs.map((d) => (
                              <li key={d.field} className="flex flex-wrap items-center gap-2">
                                <span className="text-muted-foreground min-w-[120px]">{FIELD_LABELS[d.field] ?? d.field}</span>
                                <span className="line-through text-muted-foreground">{String(d.old ?? '–')}</span>
                                <span>→</span>
                                <span className="font-medium">{String(d.new ?? '–')}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {preview.truncated && (
                <p className="text-xs text-muted-foreground">
                  Es werden nur die ersten 1.000 Änderungen angezeigt – beim Import werden alle übernommen.
                </p>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Abbrechen</Button>
            <Button
              onClick={handleImport}
              disabled={importing || !preview || preview.newCount + preview.updateCount === 0}
              className="gold-gradient text-primary-foreground"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
              Änderungen übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
