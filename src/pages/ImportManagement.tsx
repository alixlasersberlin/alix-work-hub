import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Cloud, RefreshCw, Play, Search, Filter, CheckCircle2, XCircle,
  Clock, AlertTriangle, Database, ArrowUpDown, Inbox, FileText, Loader2,
  User, Package, Zap, Eye, ArrowRight, Info, CalendarDays
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const IMPORT_SOURCES = [
  { key: 'zoho_eu_1', label: 'Alix Deutschland', region: 'EU' },
  { key: 'zoho_eu_2', label: 'Alix Austria', region: 'EU' },
  { key: 'zoho_us_1', label: 'Alix VAE', region: 'US' },
] as const;

type SourceKey = typeof IMPORT_SOURCES[number]['key'];

interface SourceStats {
  total: number;
  success: number;
  failed: number;
  lastImport: string | null;
  lastSuccess: string | null;
  lastFailed: string | null;
}

interface ImportLog {
  id: string;
  source_system: string;
  external_customer_id: string | null;
  external_order_id: string | null;
  order_number: string | null;
  import_status: string;
  message: string | null;
  imported_by: string | null;
  created_at: string;
}

interface DryRunItem {
  type: string;
  id: string;
  action: string;
  name?: string;
}

interface ImportResult {
  success?: boolean;
  fallback?: boolean;
  source_system?: string;
  mode?: string;
  is_dry_run?: boolean;
  imported_customers?: number;
  imported_orders?: number;
  failed_imports?: number;
  skipped_customers?: number;
  skipped_orders?: number;
  updated_customers?: number;
  updated_orders?: number;
  contact_pages?: number;
  order_pages?: number;
  total_contacts_fetched?: number;
  total_orders_fetched?: number;
  dry_run_results?: DryRunItem[];
  errors?: { type: string; id: string; message: string }[];
  error_code?: string;
  error?: string;
  message?: string;
  retry_after_seconds?: number;
  retryable?: boolean;
}

interface SingleSyncResult {
  success?: boolean;
  error?: string;
  message?: string;
  customer?: any;
  order_number?: string;
  source_system?: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30',
  pending: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
  skipped: 'bg-muted text-muted-foreground border-border',
};

export default function ImportManagement() {
  const { isAdmin, hasAnyRole } = useAuth();
  const canWrite = isAdmin;
  const canRead = isAdmin || hasAnyRole(['Auftragsverwaltung', 'Read Only Audit']);

  const [sourceStats, setSourceStats] = useState<Record<SourceKey, SourceStats | null>>({
    zoho_eu_1: null, zoho_eu_2: null, zoho_us_1: null,
  });
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [triggerLoading, setTriggerLoading] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{
    page: number;
    fetched: number;
    entity: string;
    startedAt: number;
    limitTotal?: number;
    hasMore: boolean;
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  // Date filter state
  type DatePreset = 'this_week' | 'this_month' | 'this_year' | 'custom' | 'all';
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);

  // Additional Zoho filter state
  const [zohoStatus, setZohoStatus] = useState('all');
  const [zohoCustomerName, setZohoCustomerName] = useState('');
  const [zohoSearchText, setZohoSearchText] = useState('');
  const [zohoSortColumn, setZohoSortColumn] = useState('date');
  const [zohoSortOrder, setZohoSortOrder] = useState<'ascending' | 'descending'>('descending');
  const [importLimit, setImportLimit] = useState<string>('all');
  const [importEntity, setImportEntity] = useState<'contacts' | 'salesorders'>('contacts');

  function getDateRange(): { date_from?: string; date_to?: string } {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (datePreset) {
      case 'this_week': {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(today.getFullYear(), today.getMonth(), diff);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return { date_from: fmt(start), date_to: fmt(end) };
      }
      case 'this_month':
        return {
          date_from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
          date_to: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
        };
      case 'this_year':
        return {
          date_from: fmt(new Date(today.getFullYear(), 0, 1)),
          date_to: fmt(new Date(today.getFullYear(), 11, 31)),
        };
      case 'custom':
        return {
          ...(customDateFrom ? { date_from: fmt(customDateFrom) } : {}),
          ...(customDateTo ? { date_to: fmt(customDateTo) } : {}),
        };
      default:
        return {};
    }
  }

  // Import result state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Single sync states
  const [syncCustomerSource, setSyncCustomerSource] = useState<string>('zoho_eu_1');
  const [syncCustomerId, setSyncCustomerId] = useState('');
  const [syncCustomerLoading, setSyncCustomerLoading] = useState(false);
  const [syncCustomerResult, setSyncCustomerResult] = useState<SingleSyncResult | null>(null);

  const [syncOrderSource, setSyncOrderSource] = useState<string>('zoho_eu_1');
  const [syncOrderId, setSyncOrderId] = useState('');
  const [syncOrderLoading, setSyncOrderLoading] = useState(false);
  const [syncOrderResult, setSyncOrderResult] = useState<SingleSyncResult | null>(null);

  // Recurring invoice import state
  type InvoicePreset = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year' | 'all' | 'custom';
  const [invoicePreset, setInvoicePreset] = useState<InvoicePreset>('this_year');
  const [invoiceCustomFrom, setInvoiceCustomFrom] = useState<Date | undefined>(undefined);
  const [invoiceCustomTo, setInvoiceCustomTo] = useState<Date | undefined>(undefined);
  const [invoiceSource, setInvoiceSource] = useState<SourceKey>('zoho_eu_1');
  const [invoiceImporting, setInvoiceImporting] = useState(false);
  const [packagesImporting, setPackagesImporting] = useState(false);
  const [packagesResult, setPackagesResult] = useState<{ packages_fetched: number; salesorders_with_packages: number; orders_updated: number; orders_missing_in_db: number } | null>(null);

  async function handlePackagesImport() {
    setPackagesImporting(true);
    setPackagesResult(null);
    try {
      toast({ title: 'Paket-Import gestartet', description: `Quelle: ${invoiceSource}` });
      const { data, error } = await supabase.functions.invoke('sync-zoho-packages', {
        body: { source_system: invoiceSource, per_page: 200, max_pages: 100 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message ?? data.error);
      setPackagesResult(data);
      toast({
        title: 'Paket-Import abgeschlossen',
        description: `${data.packages_fetched} Pakete • ${data.orders_updated} Aufträge aktualisiert${data.orders_missing_in_db ? ` • ${data.orders_missing_in_db} ohne DB-Treffer` : ''}`,
      });
    } catch (e: any) {
      toast({ title: 'Paket-Import fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setPackagesImporting(false);
    }
  }
  const [invoiceProgress, setInvoiceProgress] = useState<{ page: number; imported: number; updated: number; failed: number; profiles: number } | null>(null);
  const [invoiceImportError, setInvoiceImportError] = useState<{ title: string; message?: string; retryable?: boolean; retryAfterSeconds?: number } | null>(null);

  function getInvoiceDateFrom(): string {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    switch (invoicePreset) {
      case 'this_month': return fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      case 'last_month': return fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1));
      case 'this_quarter': {
        const q = Math.floor(today.getMonth() / 3) * 3;
        return fmt(new Date(today.getFullYear(), q, 1));
      }
      case 'this_year': return fmt(new Date(today.getFullYear(), 0, 1));
      case 'last_year': return fmt(new Date(today.getFullYear() - 1, 0, 1));
      case 'custom': return invoiceCustomFrom ? fmt(invoiceCustomFrom) : '2020-01-01';
      case 'all':
      default: return '2020-01-01';
    }
  }

  async function handleInvoiceImport() {
    setInvoiceImporting(true);
    setInvoiceProgress(null);
    setInvoiceImportError(null);
    const dateFrom = getInvoiceDateFrom();
    let page = 1;
    let totalImported = 0, totalUpdated = 0, totalFailed = 0, totalProfiles = 0;
    let stoppedByRetryableError = false;
    try {
      toast({ title: 'Rechnung-Import gestartet', description: `Ab ${dateFrom}` });
      for (let i = 0; i < 100; i++) {
        const { data, error } = await supabase.functions.invoke('sync-zoho-recurring-invoices', {
          body: { source_system: invoiceSource, date_from: dateFrom, page, max_pages: 1, per_page: 50 },
        });
        if (error) throw error;
        if (data?.retryable || data?.error) {
          const title = data?.error ?? 'Import fehlgeschlagen';
          const message = data?.message;
          const retryable = data?.retryable === true;
          const retryAfterSeconds = data?.retry_after_seconds;

          setInvoiceImportError({ title, message, retryable, retryAfterSeconds });

          if (retryable) {
            stoppedByRetryableError = true;
            toast({
              title,
              description: message ?? `Bitte in ca. ${retryAfterSeconds ?? 90} Sekunden erneut versuchen.`,
              variant: 'destructive',
            });
            break;
          }

          throw new Error(title);
        }

        totalImported += data?.imported ?? 0;
        totalUpdated += data?.updated ?? 0;
        totalFailed += data?.failed ?? 0;
        totalProfiles += data?.profiles_processed ?? 0;
        setInvoiceProgress({ page, imported: totalImported, updated: totalUpdated, failed: totalFailed, profiles: totalProfiles });
        if (!data?.profiles_have_more) break;
        page = (data?.last_profile_page ?? page) + 1;
        await new Promise(r => setTimeout(r, 2500));
      }
      if (!stoppedByRetryableError) {
        toast({
          title: 'Rechnung-Import abgeschlossen',
          description: `${totalImported} neu, ${totalUpdated} aktualisiert, ${totalFailed} fehlgeschlagen (${totalProfiles} Profile)`,
        });
      }
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Import fehlgeschlagen', variant: 'destructive' });
    } finally {
      setInvoiceImporting(false);
    }
  }

  useEffect(() => {
    if (canRead) {
      fetchSourceStats();
      fetchLogs();
    }
  }, [canRead]);

  async function fetchSourceStats() {
    setLoading(true);
    const stats: Record<string, SourceStats> = {};
    for (const src of IMPORT_SOURCES) {
      const { data, count } = await supabase
        .from('order_import_logs')
        .select('*', { count: 'exact' })
        .eq('source_system', src.key)
        .order('created_at', { ascending: false })
        .limit(500);

      const rows = data || [];
      const successRows = rows.filter(r => r.import_status === 'success');
      const failedRows = rows.filter(r => r.import_status === 'failed');

      stats[src.key] = {
        total: count || rows.length,
        success: successRows.length,
        failed: failedRows.length,
        lastImport: rows[0]?.created_at || null,
        lastSuccess: successRows[0]?.created_at || null,
        lastFailed: failedRows[0]?.created_at || null,
      };
    }
    setSourceStats(stats as Record<SourceKey, SourceStats>);
    setLoading(false);
  }

  async function fetchLogs() {
    setLogsLoading(true);
    const { data } = await supabase
      .from('order_import_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLogsLoading(false);
  }

  async function triggerImport(source: string, mode: 'manual' | 'dry_run', entity: 'contacts' | 'salesorders') {
    setTriggerLoading(`${source}_${mode}_${entity}`);
    setImportResult(null);
    setImportProgress(null);
    const dateRange = getDateRange();
    const filters: Record<string, string> = { ...dateRange };
    if (zohoStatus !== 'all') filters.status_filter = zohoStatus;
    if (zohoCustomerName.trim()) filters.customer_name = zohoCustomerName.trim();
    if (zohoSearchText.trim()) filters.search_text = zohoSearchText.trim();
    filters.sort_column = zohoSortColumn;
    filters.sort_order = zohoSortOrder;

    const isDryRun = mode === 'dry_run';
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entityLabel = entity === 'contacts' ? 'Kundendaten' : 'Aufträge';
    const allDryRunResults: DryRunItem[] = [];
    const allErrors: { type: string; id: string; message: string }[] = [];
    let totalImportedCustomers = 0;
    let totalSkippedCustomers = 0;
    let totalImportedOrders = 0;
    let totalSkippedOrders = 0;
    let totalUpdatedCustomers = 0;
    let totalUpdatedOrders = 0;
    let totalFailed = 0;
    let contactPages = 0;
    let orderPages = 0;
    let totalContactsFetched = 0;
    let totalOrdersFetched = 0;
    const importStartedAt = Date.now();
    const limitTotal = importLimit !== 'all' ? parseInt(importLimit, 10) : undefined;
    try {
      toast({
        title: isDryRun ? `Dry Run gestartet (${entityLabel})` : `Import gestartet (${entityLabel})`,
        description: 'Daten werden seitenweise verarbeitet...',
      });

      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const limitNum = importLimit !== 'all' ? parseInt(importLimit, 10) : undefined;
        const { data, error } = await supabase.functions.invoke('start-zoho-import', {
          body: { source_system: source, mode, entity, page, job_id: jobId, ...(limitNum ? { limit: limitNum } : {}), ...filters },
        });
        if (error) throw error;

        if (data?.fallback || data?.retryable) {
          const partialResult: ImportResult = {
            success: false,
            fallback: data.fallback === true,
            retryable: data.retryable === true,
            retry_after_seconds: data.retry_after_seconds,
            error_code: data.error_code,
            source_system: source,
            mode,
            is_dry_run: isDryRun,
            imported_customers: totalImportedCustomers,
            imported_orders: totalImportedOrders,
            failed_imports: totalFailed,
            skipped_customers: totalSkippedCustomers,
            skipped_orders: totalSkippedOrders,
            contact_pages: contactPages,
            order_pages: orderPages,
            total_contacts_fetched: totalContactsFetched,
            total_orders_fetched: totalOrdersFetched,
            error: data.error || 'Import vorübergehend nicht verfügbar',
            message: data.message,
            ...(isDryRun && allDryRunResults.length > 0 ? { dry_run_results: allDryRunResults } : {}),
            ...(allErrors.length > 0 ? { errors: allErrors } : {}),
          };

          setImportResult(partialResult);
          toast({
            title: 'Zoho momentan blockiert',
            description: data.message || 'Bitte in 1–2 Minuten erneut versuchen.',
            variant: 'destructive',
          });
          return;
        }

        if (!data?.success) throw new Error(data?.error || `${entityLabel} konnten nicht geladen werden`);

        if (entity === 'contacts') {
          totalContactsFetched += data.items_fetched ?? 0;
          totalImportedCustomers += data.imported ?? 0;
          totalSkippedCustomers += data.skipped ?? 0;
          totalUpdatedCustomers += data.updated ?? 0;
          contactPages = page;
        } else {
          totalOrdersFetched += data.items_fetched ?? 0;
          totalImportedOrders += data.imported ?? 0;
          totalSkippedOrders += data.skipped ?? 0;
          totalUpdatedOrders += data.updated ?? 0;
          orderPages = page;
        }
        const currentFetched = entity === 'contacts' ? totalContactsFetched : totalOrdersFetched;
        const currentImported = entity === 'contacts' ? totalImportedCustomers : totalImportedOrders;
        const currentUpdated = entity === 'contacts' ? totalUpdatedCustomers : totalUpdatedOrders;
        const currentSkipped = entity === 'contacts' ? totalSkippedCustomers : totalSkippedOrders;
        setImportProgress({
          page,
          fetched: currentFetched,
          entity: entityLabel,
          startedAt: importStartedAt,
          limitTotal,
          hasMore: data.has_more === true,
          imported: currentImported,
          updated: currentUpdated,
          skipped: currentSkipped,
          failed: totalFailed + (data.failed ?? 0),
        });
        totalFailed += data.failed ?? 0;
        if (data.dry_run_results) allDryRunResults.push(...data.dry_run_results);
        if (data.errors) allErrors.push(...data.errors);
        hasMore = data.has_more === true;
        page++;
        // Delay between pages to avoid Zoho rate limiting
        if (hasMore) await new Promise(r => setTimeout(r, 1500));
      }

      const result: ImportResult = {
        success: true,
        source_system: source,
        mode,
        is_dry_run: isDryRun,
        imported_customers: totalImportedCustomers,
        imported_orders: totalImportedOrders,
        failed_imports: totalFailed,
        skipped_customers: totalSkippedCustomers,
        skipped_orders: totalSkippedOrders,
        updated_customers: totalUpdatedCustomers,
        updated_orders: totalUpdatedOrders,
        contact_pages: contactPages,
        order_pages: orderPages,
        total_contacts_fetched: totalContactsFetched,
        total_orders_fetched: totalOrdersFetched,
        ...(isDryRun && allDryRunResults.length > 0 ? { dry_run_results: allDryRunResults } : {}),
        ...(allErrors.length > 0 ? { errors: allErrors } : {}),
      };

      setImportResult(result);
      const countLabel = entity === 'contacts'
        ? `${totalImportedCustomers} neu, ${totalUpdatedCustomers} aktualisiert`
        : `${totalImportedOrders} neu, ${totalUpdatedOrders} aktualisiert`;
      toast({
        title: isDryRun ? 'Dry Run abgeschlossen' : 'Import abgeschlossen',
        description: `${IMPORT_SOURCES.find(s => s.key === source)?.label} – ${countLabel}`,
      });
      if (!isDryRun) {
        setTimeout(() => { fetchSourceStats(); fetchLogs(); }, 2000);
      }
    } catch (err: any) {
      const rawMessage = err?.message || 'Import fehlgeschlagen';
      const isRateLimited = /too many requests|rate limit|access denied/i.test(rawMessage);
      const errorTitle = isRateLimited ? 'Zoho API-Limit erreicht' : rawMessage;
      const errorMessage = isRateLimited
        ? 'Zoho blockiert gerade neue Anfragen. Bitte in 1–2 Minuten erneut versuchen.'
        : undefined;

      setImportResult({
        success: false,
        retryable: isRateLimited,
        source_system: source,
        mode,
        is_dry_run: isDryRun,
        imported_customers: totalImportedCustomers,
        imported_orders: totalImportedOrders,
        failed_imports: totalFailed,
        skipped_customers: totalSkippedCustomers,
        skipped_orders: totalSkippedOrders,
        contact_pages: contactPages,
        order_pages: orderPages,
        total_contacts_fetched: totalContactsFetched,
        total_orders_fetched: totalOrdersFetched,
        error: errorTitle,
        message: errorMessage,
        ...(isDryRun && allDryRunResults.length > 0 ? { dry_run_results: allDryRunResults } : {}),
        ...(allErrors.length > 0 ? { errors: allErrors } : {}),
      });

      toast({
        title: isRateLimited ? 'Zoho momentan blockiert' : 'Fehler',
        description: errorMessage || rawMessage || 'Import konnte nicht gestartet werden.',
        variant: 'destructive',
      });
    } finally {
      setTriggerLoading(null);
      setImportProgress(null);
    }
  }

  async function syncSingleCustomer() {
    if (!syncCustomerId.trim()) return;
    setSyncCustomerLoading(true);
    setSyncCustomerResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-single-customer', {
        body: { source_system: syncCustomerSource, external_customer_id: syncCustomerId.trim() },
      });
      if (error) throw error;
      setSyncCustomerResult(data as SingleSyncResult);
      toast({
        title: data?.success ? 'Kunde synchronisiert' : 'Fehler',
        description: data?.success
          ? `Kunde ${data.customer?.company_name || data.customer?.contact_name || syncCustomerId} erfolgreich synchronisiert.`
          : (data?.message || 'Unbekannter Fehler'),
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err: any) {
      setSyncCustomerResult({ error: err.message });
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSyncCustomerLoading(false);
    }
  }

  async function syncSingleOrder() {
    if (!syncOrderId.trim()) return;
    setSyncOrderLoading(true);
    setSyncOrderResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('sync-single-order', {
        body: { source_system: syncOrderSource, external_order_id: syncOrderId.trim() },
      });
      if (error) throw error;
      setSyncOrderResult(data as SingleSyncResult);
      toast({
        title: data?.success ? 'Auftrag synchronisiert' : 'Fehler',
        description: data?.success
          ? `Auftrag ${data.order_number || syncOrderId} erfolgreich synchronisiert.`
          : (data?.message || 'Unbekannter Fehler'),
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err: any) {
      setSyncOrderResult({ error: err.message });
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
    } finally {
      setSyncOrderLoading(false);
    }
  }

  const filteredLogs = logs.filter(log => {
    if (statusFilter !== 'all' && log.import_status !== statusFilter) return false;
    if (sourceFilter !== 'all' && log.source_system !== sourceFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        log.order_number?.toLowerCase().includes(s) ||
        log.external_order_id?.toLowerCase().includes(s) ||
        log.external_customer_id?.toLowerCase().includes(s) ||
        log.message?.toLowerCase().includes(s)
      );
    }
    return true;
  }).sort((a, b) => {
    const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortDir === 'desc' ? -d : d;
  });

  function formatDate(d: string | null) {
    if (!d) return '–';
    return format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: de });
  }

  if (!canRead) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <Card className="max-w-md w-full text-center p-8">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Kein Zugriff</h2>
          <p className="text-muted-foreground">Sie haben keine Berechtigung für die Importverwaltung.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold gold-text">Importverwaltung</h1>
          <p className="text-muted-foreground text-sm mt-1">Zoho Books Verbindungen, Importe & Kontrollfunktionen</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchSourceStats(); fetchLogs(); }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="logs">Import-Protokoll</TabsTrigger>
          {canWrite && <TabsTrigger value="actions">Import-Aktionen</TabsTrigger>}
          {canWrite && <TabsTrigger value="invoices">Rechnung Import</TabsTrigger>}
          {canWrite && <TabsTrigger value="sync">Einzel-Sync</TabsTrigger>}
        </TabsList>

        {/* ============ OVERVIEW TAB ============ */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {IMPORT_SOURCES.map(src => {
              const stats = sourceStats[src.key];
              if (loading || !stats) {
                return (
                  <Card key={src.key} className="border-border">
                    <CardHeader className="pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
                    <CardContent className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                );
              }
              const hasActivity = stats.total > 0;
              return (
                <Card key={src.key} className="border-border hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-primary" />
                        {src.label}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">{src.region}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Importierte Datensätze</span>
                      <span className="font-medium">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[hsl(var(--success))]" /> Erfolgreich
                      </span>
                      <span className="font-medium text-[hsl(var(--success))]">{stats.success}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-destructive" /> Fehlgeschlagen
                      </span>
                      <span className="font-medium text-destructive">{stats.failed}</span>
                    </div>
                    <div className="border-t border-border pt-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Letzter Import</span>
                        <span>{formatDate(stats.lastImport)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Letzter Erfolg</span>
                        <span className="text-[hsl(var(--success))]">{formatDate(stats.lastSuccess)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Letzter Fehler</span>
                        <span className="text-destructive">{formatDate(stats.lastFailed)}</span>
                      </div>
                    </div>
                    {!hasActivity && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                        <Inbox className="w-3 h-3" /> Noch keine Importe
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ============ LOGS TAB ============ */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Auftragsnr., ext. ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px] bg-secondary border-border">
                <SelectValue placeholder="Quelle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Quellen</SelectItem>
                {IMPORT_SOURCES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-secondary border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="success">Erfolgreich</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="failed">Fehlgeschlagen</SelectItem>
                <SelectItem value="skipped">Übersprungen</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
              <ArrowUpDown className="w-4 h-4" />
            </Button>
          </div>

          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredLogs.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Keine Importprotokolle</h3>
                <p className="text-muted-foreground text-sm">Es wurden noch keine Importe durchgeführt oder die Filter ergeben keine Treffer.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Zeitpunkt</TableHead>
                    <TableHead>Quelle</TableHead>
                    <TableHead>Auftragsnr.</TableHead>
                    <TableHead>Ext. Kunden-ID</TableHead>
                    <TableHead>Ext. Auftrags-ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Nachricht</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map(log => (
                    <TableRow key={log.id} className="border-border">
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{log.source_system}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{log.order_number || '–'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.external_customer_id || '–'}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{log.external_order_id || '–'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_COLORS[log.import_status] || ''}>
                          {log.import_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                        {log.message || '–'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============ ACTIONS TAB ============ */}
        {canWrite && (
          <TabsContent value="actions" className="space-y-6">
            {/* Date Filter */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  Importfilter
                </CardTitle>
                <CardDescription>
                  Definieren Sie die Filter für den Zoho Books Import. Bereits vorhandene Aufträge werden übersprungen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Date range */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Zeitraum</Label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: 'all' as DatePreset, label: 'Alle' },
                      { key: 'this_week' as DatePreset, label: 'Diese Woche' },
                      { key: 'this_month' as DatePreset, label: 'Dieser Monat' },
                      { key: 'this_year' as DatePreset, label: 'Dieses Jahr' },
                      { key: 'custom' as DatePreset, label: 'Benutzerdefiniert' },
                    ]).map(p => (
                      <Button
                        key={p.key}
                        size="sm"
                        variant={datePreset === p.key ? 'default' : 'outline'}
                        onClick={() => setDatePreset(p.key)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>

                  {datePreset === 'custom' && (
                    <div className="flex flex-wrap items-end gap-4 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Von</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[160px] justify-start text-left font-normal">
                              <CalendarDays className="w-3.5 h-3.5 mr-2" />
                              {customDateFrom ? format(customDateFrom, 'dd.MM.yyyy') : 'Startdatum'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={customDateFrom}
                              onSelect={setCustomDateFrom}
                              className="p-3 pointer-events-auto"
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Bis</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[160px] justify-start text-left font-normal">
                              <CalendarDays className="w-3.5 h-3.5 mr-2" />
                              {customDateTo ? format(customDateTo, 'dd.MM.yyyy') : 'Enddatum'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={customDateTo}
                              onSelect={setCustomDateTo}
                              className="p-3 pointer-events-auto"
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Status filter */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Auftragsstatus (Zoho)</Label>
                    <Select value={zohoStatus} onValueChange={setZohoStatus}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        <SelectItem value="draft">Entwurf (Draft)</SelectItem>
                        <SelectItem value="open">Offen (Open)</SelectItem>
                        <SelectItem value="closed">Geschlossen (Closed)</SelectItem>
                        <SelectItem value="void">Storniert (Void)</SelectItem>
                        <SelectItem value="overdue">Überfällig (Overdue)</SelectItem>
                        <SelectItem value="confirmed">Bestätigt (Confirmed)</SelectItem>
                        <SelectItem value="fulfilled">Erfüllt (Fulfilled)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Customer name */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Kundenname</Label>
                    <Input
                      placeholder="z.B. Mustermann GmbH"
                      value={zohoCustomerName}
                      onChange={e => setZohoCustomerName(e.target.value)}
                      className="bg-secondary border-border"
                    />
                  </div>

                  {/* Search text */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Volltextsuche</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Suchbegriff in Zoho…"
                        value={zohoSearchText}
                        onChange={e => setZohoSearchText(e.target.value)}
                        className="pl-9 bg-secondary border-border"
                      />
                    </div>
                  </div>

                  {/* Sort */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Sortierung</Label>
                    <div className="flex gap-2">
                      <Select value={zohoSortColumn} onValueChange={setZohoSortColumn}>
                        <SelectTrigger className="bg-secondary border-border flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Datum</SelectItem>
                          <SelectItem value="salesorder_number">Auftragsnr.</SelectItem>
                          <SelectItem value="customer_name">Kunde</SelectItem>
                          <SelectItem value="total">Betrag</SelectItem>
                          <SelectItem value="created_time">Erstellzeit</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setZohoSortOrder(o => o === 'descending' ? 'ascending' : 'descending')}
                        title={zohoSortOrder === 'descending' ? 'Absteigend' : 'Aufsteigend'}
                      >
                        <ArrowUpDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Active filter summary */}
                {(datePreset !== 'all' || zohoStatus !== 'all' || zohoCustomerName || zohoSearchText) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-lg px-3 py-2">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Aktive Filter:</span>
                    {datePreset !== 'all' && (
                      <Badge variant="outline" className="text-xs">
                        {datePreset === 'custom'
                          ? `${customDateFrom ? format(customDateFrom, 'dd.MM.yyyy') : '–'} – ${customDateTo ? format(customDateTo, 'dd.MM.yyyy') : '–'}`
                          : datePreset === 'this_week' ? 'Diese Woche'
                          : datePreset === 'this_month' ? 'Dieser Monat'
                          : 'Dieses Jahr'}
                      </Badge>
                    )}
                    {zohoStatus !== 'all' && (
                      <Badge variant="outline" className="text-xs">Status: {zohoStatus}</Badge>
                    )}
                    {zohoCustomerName && (
                      <Badge variant="outline" className="text-xs">Kunde: {zohoCustomerName}</Badge>
                    )}
                    {zohoSearchText && (
                      <Badge variant="outline" className="text-xs">Suche: {zohoSearchText}</Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-xs"
                      onClick={() => {
                        setDatePreset('all');
                        setCustomDateFrom(undefined);
                        setCustomDateTo(undefined);
                        setZohoStatus('all');
                        setZohoCustomerName('');
                        setZohoSearchText('');
                        setZohoSortColumn('date');
                        setZohoSortOrder('descending');
                      }}
                    >
                      Alle zurücksetzen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Import-Typ & Limit */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Import-Typ:</Label>
                <Select value={importEntity} onValueChange={(v) => setImportEntity(v as 'contacts' | 'salesorders')}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacts">
                      <span className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> Kundendaten
                      </span>
                    </SelectItem>
                    <SelectItem value="salesorders">
                      <span className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5" /> Aufträge
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Max. Einträge:</Label>
                <Select value={importLimit} onValueChange={setImportLimit}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1.000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {importLimit !== 'all' && (
                <span className="text-xs text-muted-foreground">
                  Es werden max. {importLimit} Einträge pro Import verarbeitet
                </span>
              )}
            </div>

            {/* Unified Import Card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {importEntity === 'contacts' ? (
                    <User className="w-5 h-5 text-primary" />
                  ) : (
                    <Package className="w-5 h-5 text-primary" />
                  )}
                  {importEntity === 'contacts' ? 'Kundendaten importieren' : 'Aufträge importieren'}
                </CardTitle>
                <CardDescription>
                  {importEntity === 'contacts'
                    ? 'Importiert Kontakte aus Zoho Books. Bereits vorhandene Kunden werden aktualisiert oder übersprungen.'
                    : 'Importiert Verkaufsaufträge aus Zoho Books. Der verknüpfte Kunde muss bereits importiert sein. Dry Run prüft ohne Änderungen.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {IMPORT_SOURCES.map(src => (
                    <Card key={src.key} className="border-border bg-secondary/50">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">{src.label}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto">{src.region}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            disabled={triggerLoading !== null}
                            onClick={() => triggerImport(src.key, 'manual', importEntity)}
                          >
                            {triggerLoading === `${src.key}_manual_${importEntity}` ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <Play className="w-4 h-4 mr-1" />
                            )}
                            Import
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={triggerLoading !== null}
                            onClick={() => triggerImport(src.key, 'dry_run', importEntity)}
                          >
                            {triggerLoading === `${src.key}_dry_run_${importEntity}` ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <Eye className="w-4 h-4 mr-1" />
                            )}
                            Dry Run
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>



            {/* ============ IMPORT PROGRESS ============ */}
            {importProgress && triggerLoading && (() => {
              const elapsed = (Date.now() - importProgress.startedAt) / 1000;
              const perPage = importProgress.page > 0 ? elapsed / importProgress.page : 0;
              const progressPercent = importProgress.limitTotal
                ? Math.min(100, Math.round((importProgress.fetched / importProgress.limitTotal) * 100))
                : null;
              const etaSeconds = importProgress.hasMore && perPage > 0
                ? (importProgress.limitTotal
                    ? Math.max(0, ((importProgress.limitTotal - importProgress.fetched) / 200) * perPage)
                    : perPage * 2)
                : 0;
              const formatTime = (s: number) => {
                if (s < 60) return `~${Math.ceil(s)}s`;
                const m = Math.floor(s / 60);
                const sec = Math.ceil(s % 60);
                return `~${m}m ${sec}s`;
              };
              const formatElapsed = (s: number) => {
                if (s < 60) return `${Math.floor(s)}s`;
                const m = Math.floor(s / 60);
                const sec = Math.floor(s % 60);
                return `${m}m ${sec}s`;
              };
              return (
                <Card className="border-primary/50 bg-primary/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">
                            {importProgress.entity} werden verarbeitet…
                          </span>
                          <span className="text-sm text-muted-foreground tabular-nums">
                            Seite {importProgress.page} · {importProgress.fetched.toLocaleString('de-DE')} Einträge
                            {progressPercent !== null && ` · ${progressPercent}%`}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          {progressPercent !== null ? (
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          ) : (
                            <div className="bg-primary h-full rounded-full animate-pulse" style={{ width: '100%' }} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-background/50 rounded-md px-2.5 py-1.5 border border-border/50">
                        <span className="text-muted-foreground">Neu:</span>{' '}
                        <span className="font-medium text-[hsl(var(--success))] tabular-nums">{importProgress.imported.toLocaleString('de-DE')}</span>
                      </div>
                      <div className="bg-background/50 rounded-md px-2.5 py-1.5 border border-border/50">
                        <span className="text-muted-foreground">Aktualisiert:</span>{' '}
                        <span className="font-medium text-primary tabular-nums">{importProgress.updated.toLocaleString('de-DE')}</span>
                      </div>
                      <div className="bg-background/50 rounded-md px-2.5 py-1.5 border border-border/50">
                        <span className="text-muted-foreground">Übersprungen:</span>{' '}
                        <span className="font-medium text-muted-foreground tabular-nums">{importProgress.skipped.toLocaleString('de-DE')}</span>
                      </div>
                      <div className="bg-background/50 rounded-md px-2.5 py-1.5 border border-border/50">
                        <span className="text-muted-foreground">Fehler:</span>{' '}
                        <span className={`font-medium tabular-nums ${importProgress.failed > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{importProgress.failed.toLocaleString('de-DE')}</span>
                      </div>
                    </div>

                    {/* Time row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Vergangen: <span className="tabular-nums font-medium">{formatElapsed(elapsed)}</span>
                      </span>
                      {importProgress.hasMore && etaSeconds > 0 && (
                        <span>
                          Geschätzte Restzeit: <span className="tabular-nums font-medium">{formatTime(etaSeconds)}</span>
                        </span>
                      )}
                      {!importProgress.hasMore && (
                        <span className="text-[hsl(var(--success))]">Wird abgeschlossen…</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {importResult && (
              <Card className={`border-border ${importResult.retryable ? 'border-[hsl(var(--warning))]/50' : importResult.error ? 'border-destructive/50' : importResult.is_dry_run ? 'border-primary/50' : 'border-[hsl(var(--success))]/50'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {importResult.retryable ? (
                        <><AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))]" /> Vorübergehend blockiert</>
                      ) : importResult.error ? (
                        <><XCircle className="w-5 h-5 text-destructive" /> Fehler</>
                      ) : importResult.is_dry_run ? (
                        <><Eye className="w-5 h-5 text-primary" /> Dry Run Ergebnis</>
                      ) : (
                        <><CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" /> Import abgeschlossen</>
                      )}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setImportResult(null)} className="text-muted-foreground hover:text-foreground">
                      <XCircle className="w-4 h-4 mr-1" /> Zurücksetzen
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {importResult.error && !importResult.success ? (
                    <div className={`p-3 rounded-md text-sm ${importResult.retryable ? 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' : 'bg-destructive/10 text-destructive'}`}>
                      <div>{importResult.error}{importResult.message && `: ${importResult.message}`}</div>
                      {importResult.retryable && importResult.retry_after_seconds ? (
                        <div className="mt-1 text-xs opacity-80">Erneut versuchen in ca. {importResult.retry_after_seconds} Sekunden.</div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {/* Summary stats */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-secondary/50 rounded-md p-3 text-center">
                          <div className="text-2xl font-bold text-primary">{importResult.total_contacts_fetched ?? 0}</div>
                          <div className="text-xs text-muted-foreground">Kontakte abgerufen</div>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-3 text-center">
                          <div className="text-2xl font-bold text-primary">{importResult.total_orders_fetched ?? 0}</div>
                          <div className="text-xs text-muted-foreground">Aufträge abgerufen</div>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-3 text-center">
                          <div className="text-2xl font-bold text-[hsl(var(--success))]">{(importResult.imported_customers ?? 0) + (importResult.imported_orders ?? 0)}</div>
                          <div className="text-xs text-muted-foreground">Neu erstellt</div>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-3 text-center">
                          <div className="text-2xl font-bold text-primary">{(importResult.updated_customers ?? 0) + (importResult.updated_orders ?? 0)}</div>
                          <div className="text-xs text-muted-foreground">Aktualisiert</div>
                        </div>
                        <div className="bg-secondary/50 rounded-md p-3 text-center">
                          <div className="text-2xl font-bold text-destructive">{importResult.failed_imports ?? 0}</div>
                          <div className="text-xs text-muted-foreground">Fehler</div>
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Info className="w-3 h-3" /> Quelle: <span className="font-mono text-foreground">{importResult.source_system}</span>
                        </span>
                        {importResult.contact_pages != null && (
                          <span>Kontakt-Seiten: {importResult.contact_pages}</span>
                        )}
                        {importResult.order_pages != null && (
                          <span>Auftrags-Seiten: {importResult.order_pages}</span>
                        )}
                        {importResult.is_dry_run && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary">Dry Run – keine Daten geschrieben</Badge>
                        )}
                      </div>

                      {/* Dry run detail table */}
                      {importResult.is_dry_run && importResult.dry_run_results && importResult.dry_run_results.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Vorschau der Änderungen</h4>
                          <div className="max-h-[300px] overflow-y-auto rounded-md border border-border">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-border">
                                  <TableHead className="text-xs">Typ</TableHead>
                                  <TableHead className="text-xs">ID</TableHead>
                                  <TableHead className="text-xs">Aktion</TableHead>
                                  <TableHead className="text-xs">Name</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {importResult.dry_run_results.map((item, idx) => (
                                  <TableRow key={idx} className="border-border">
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {item.type === 'customer' ? <User className="w-3 h-3 mr-1" /> : <Package className="w-3 h-3 mr-1" />}
                                        {item.type === 'customer' ? 'Kunde' : 'Auftrag'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{item.id}</TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={item.action === 'create' ? 'border-[hsl(var(--success))]/30 text-[hsl(var(--success))]' : item.action === 'skip' ? 'border-muted-foreground/30 text-muted-foreground' : 'border-primary/30 text-primary'}>
                                        {item.action === 'create' ? 'Neu' : item.action === 'skip' ? 'Übersprungen' : 'Update'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{item.name || '–'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {/* Errors detail */}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> Fehlerprotokoll
                          </h4>
                          <div className="max-h-[200px] overflow-y-auto rounded-md border border-destructive/20">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-border">
                                  <TableHead className="text-xs">Typ</TableHead>
                                  <TableHead className="text-xs">ID</TableHead>
                                  <TableHead className="text-xs">Fehler</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {importResult.errors.map((err, idx) => (
                                  <TableRow key={idx} className="border-border">
                                    <TableCell className="text-xs">{err.type === 'customer' ? 'Kunde' : 'Auftrag'}</TableCell>
                                    <TableCell className="font-mono text-xs">{err.id}</TableCell>
                                    <TableCell className="text-xs text-destructive">{err.message}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setImportResult(null)}>
                      Schließen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Import rules */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Importregeln
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Zuerst wird der <span className="text-foreground font-medium">Kunde</span> importiert oder aktualisiert</li>
                  <li>Danach wird der <span className="text-foreground font-medium">Auftrag</span> importiert oder aktualisiert</li>
                  <li>Jeder Datensatz erhält das <span className="text-foreground font-medium">source_system</span> der Quelle</li>
                  <li>Original-Auftragsnummern bleiben erhalten</li>
                  <li>Dubletten werden anhand der externen IDs vermieden</li>
                  <li>Importe sind <span className="text-foreground font-medium">idempotent</span> – wiederholte Ausführung erzeugt keine Duplikate</li>
                  <li><span className="text-foreground font-medium">Dry Run</span> prüft die Daten, schreibt aber nicht in die Datenbank</li>
                  <li>Alle Aktionen werden im <span className="text-foreground font-medium">Audit-Log</span> protokolliert</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============ INVOICE IMPORT TAB ============ */}
        {canWrite && (
          <TabsContent value="invoices" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Rechnung Import (Ratenzahler)
                </CardTitle>
                <CardDescription>
                  Importiert Rechnungen aus wiederkehrenden Zoho-Profilen. Zusätzlich läuft täglich um 23:45 ein automatischer Import.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quelle</Label>
                    <Select value={invoiceSource} onValueChange={(v) => setInvoiceSource(v as SourceKey)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IMPORT_SOURCES.map(s => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Zeitraum</Label>
                    <Select value={invoicePreset} onValueChange={(v) => setInvoicePreset(v as InvoicePreset)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="this_month">Dieser Monat</SelectItem>
                        <SelectItem value="last_month">Letzter Monat</SelectItem>
                        <SelectItem value="this_quarter">Dieses Quartal</SelectItem>
                        <SelectItem value="this_year">Dieses Jahr</SelectItem>
                        <SelectItem value="last_year">Letztes Jahr</SelectItem>
                        <SelectItem value="all">Alle (seit 2020)</SelectItem>
                        <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {invoicePreset === 'custom' && (
                    <div className="space-y-2">
                      <Label>Datum von</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {invoiceCustomFrom ? format(invoiceCustomFrom, 'PPP', { locale: de }) : 'Datum wählen'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={invoiceCustomFrom}
                            onSelect={setInvoiceCustomFrom}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleInvoiceImport}
                    disabled={invoiceImporting}
                    className="gold-gradient text-primary-foreground"
                  >
                    {invoiceImporting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importiere...</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" /> Import starten</>
                    )}
                  </Button>
                  <Button
                    onClick={handlePackagesImport}
                    disabled={packagesImporting}
                    variant="outline"
                  >
                    {packagesImporting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Pakete importieren...</>
                    ) : (
                      <><Package className="w-4 h-4 mr-2" /> Pakete importieren</>
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Zeitraum ab: <strong>{getInvoiceDateFrom()}</strong>
                  </span>
                </div>

                {packagesResult && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-1 text-sm">
                    <div>Pakete aus Zoho: <strong>{packagesResult.packages_fetched}</strong></div>
                    <div>Aufträge mit Paketen: <strong>{packagesResult.salesorders_with_packages}</strong></div>
                    <div>Aufträge aktualisiert: <strong className="text-[hsl(var(--success))]">{packagesResult.orders_updated}</strong></div>
                    {packagesResult.orders_missing_in_db > 0 && (
                      <div>Ohne DB-Treffer: <strong className="text-destructive">{packagesResult.orders_missing_in_db}</strong></div>
                    )}
                  </div>
                )}

                {invoiceProgress && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 space-y-1 text-sm">
                    <div>Seite: <strong>{invoiceProgress.page}</strong></div>
                    <div>Profile verarbeitet: <strong>{invoiceProgress.profiles}</strong></div>
                    <div>Neu: <strong className="text-[hsl(var(--success))]">{invoiceProgress.imported}</strong></div>
                    <div>Aktualisiert: <strong>{invoiceProgress.updated}</strong></div>
                    <div>Fehlgeschlagen: <strong className="text-destructive">{invoiceProgress.failed}</strong></div>
                  </div>
                )}

                {invoiceImportError && (
                  <div className={`rounded-lg border p-4 text-sm ${invoiceImportError.retryable ? 'border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}>
                    <div className="font-medium">{invoiceImportError.title}</div>
                    {invoiceImportError.message && <div className="mt-1">{invoiceImportError.message}</div>}
                    {invoiceImportError.retryable && invoiceImportError.retryAfterSeconds ? (
                      <div className="mt-1 text-xs opacity-80">Erneut versuchen in ca. {invoiceImportError.retryAfterSeconds} Sekunden.</div>
                    ) : null}
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>Der automatische Import läuft täglich um 23:45 Uhr (UTC) und erfasst alle Rechnungen seit dem 01.01.2025.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ============ SINGLE SYNC TAB ============ */}
        {canWrite && (
          <TabsContent value="sync" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Single Customer Sync */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Einzelnen Kunden synchronisieren
                  </CardTitle>
                  <CardDescription>
                    Lädt einen einzelnen Kontakt aus Zoho Books nach und erstellt oder aktualisiert den Kunden.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Quellsystem</Label>
                    <Select value={syncCustomerSource} onValueChange={setSyncCustomerSource}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_SOURCES.map(s => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Externe Kunden-ID (Zoho contact_id)</Label>
                    <Input
                      placeholder="z.B. 4600000012345"
                      value={syncCustomerId}
                      onChange={e => setSyncCustomerId(e.target.value)}
                      className="bg-secondary border-border font-mono"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={syncCustomerLoading || !syncCustomerId.trim()}
                    onClick={syncSingleCustomer}
                  >
                    {syncCustomerLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Kunden synchronisieren
                  </Button>

                  {syncCustomerResult && (
                    <div className={`p-3 rounded-md text-sm ${syncCustomerResult.success ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : 'bg-destructive/10 text-destructive'}`}>
                      {syncCustomerResult.success ? (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">Erfolgreich synchronisiert</p>
                            {syncCustomerResult.customer && (
                              <p className="text-xs mt-1 opacity-80">
                                {syncCustomerResult.customer.company_name || syncCustomerResult.customer.contact_name || 'Ohne Name'}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{syncCustomerResult.error || 'Fehler'}</p>
                            {syncCustomerResult.message && <p className="text-xs mt-1 opacity-80">{syncCustomerResult.message}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Single Order Sync */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Einzelnen Auftrag synchronisieren
                  </CardTitle>
                  <CardDescription>
                    Lädt einen einzelnen Auftrag aus Zoho Books nach. Der verknüpfte Kunde muss bereits synchronisiert sein.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Quellsystem</Label>
                    <Select value={syncOrderSource} onValueChange={setSyncOrderSource}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_SOURCES.map(s => (
                          <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Externe Auftrags-ID (Zoho salesorder_id)</Label>
                    <Input
                      placeholder="z.B. 4600000067890"
                      value={syncOrderId}
                      onChange={e => setSyncOrderId(e.target.value)}
                      className="bg-secondary border-border font-mono"
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={syncOrderLoading || !syncOrderId.trim()}
                    onClick={syncSingleOrder}
                  >
                    {syncOrderLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Auftrag synchronisieren
                  </Button>

                  {syncOrderResult && (
                    <div className={`p-3 rounded-md text-sm ${syncOrderResult.success ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' : 'bg-destructive/10 text-destructive'}`}>
                      {syncOrderResult.success ? (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">Erfolgreich synchronisiert</p>
                            {syncOrderResult.order_number && (
                              <p className="text-xs mt-1 opacity-80">Auftragsnr. {syncOrderResult.order_number}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{syncOrderResult.error || 'Fehler'}</p>
                            {syncOrderResult.message && <p className="text-xs mt-1 opacity-80">{syncOrderResult.message}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Security note */}
            <Card className="border-border bg-secondary/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))]" />
                  Alle Sync-Operationen laufen ausschließlich über sichere Edge Functions. Keine Zoho-API-Zugriffe im Frontend.
                  Zoho-Secrets müssen serverseitig konfiguriert sein.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
