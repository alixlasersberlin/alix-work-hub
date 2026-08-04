import { useEffect, useMemo, useState } from 'react';
import { Repeat, Search, Loader2, ChevronDown, ChevronRight, RefreshCw, Download, FileSpreadsheet, FileText, FileJson, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonKpiGrid } from '@/components/infinity/Skeleton';
import { KpiTile } from '@/components/infinity/KpiTile';
import { StatusBadge as InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { RecurringProfileEditDialog, type EditableProfile } from '@/components/finance/RecurringProfileEditDialog';
import { RecurringProfileCreateDialog } from '@/components/finance/RecurringProfileCreateDialog';

import { RecurringInvoiceBookDialog, type BookableInvoice } from '@/components/finance/RecurringInvoiceBookDialog';
import { useFinancePermissions } from '@/hooks/useFinancePermissions';
import { InvoicePdfDialog, type PdfInvoiceRef } from '@/components/finance/InvoicePdfDialog';


// Beträge auf dieser Seite werden bewusst NICHT durch die Revenue-Mask (Super Admin)
// ausgeblendet — Vertragssummen sind für Finance-Auswertung essentiell.
const fmt = (n: number, c = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '—');

type Profile = {
  id: string;
  zoho_recurring_invoice_id: string;
  recurrence_name: string | null;
  reference_number: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  company_name: string | null;
  recurrence_frequency: string | null;
  repeat_every: number | null;
  start_date: string | null;
  end_date: string | null;
  next_invoice_date: string | null;
  last_sent_date: string | null;
  total: number | null;
  currency: string | null;
  created_at: string | null;
};

type Invoice = {
  id: string;
  zoho_invoice_id: string;
  zoho_recurring_invoice_id: string | null;
  invoice_number: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  status: string | null;
  currency: string | null;
  last_payment_date: string | null;
};

type Group = {
  customer_id: string;
  customer_name: string;
  profiles: Profile[];
  invoices: Invoice[];
  monthly: number;
  remaining: number;
  ytdBilled: number;
  openBalance: number;
  lastInvoiceDate: string | null;
  nextInvoiceDate: string | null;
  newestCreatedAt: string | null;
  currency: string;
  hasSepa: boolean;
};

const isSepaProfile = (p: Profile) => {
  const hay = `${p.recurrence_name ?? ''} ${p.reference_number ?? ''}`.toLowerCase();
  return /\bsepa\b|lastschrift/.test(hay);
};

const monthsFactor = (freq: string | null, every: number | null) => {
  const e = every && every > 0 ? every : 1;
  switch ((freq ?? '').toLowerCase()) {
    case 'days': return 30 / e;
    case 'weeks': return (52 / 12) / e;
    case 'months': return 1 / e;
    case 'years': return (1 / 12) / e;
    default: return 1 / e;
  }
};

// Länge einer Periode in Tagen (für Restlaufzeit-Berechnung)
const periodDays = (freq: string | null, every: number | null) => {
  const e = every && every > 0 ? every : 1;
  switch ((freq ?? '').toLowerCase()) {
    case 'days': return 1 * e;
    case 'weeks': return 7 * e;
    case 'months': return 30.4375 * e;
    case 'years': return 365.25 * e;
    default: return 30.4375 * e;
  }
};

/** Anzahl noch offener Rechnungen bis zum letzten Rechnungsdatum (end_date) */
const remainingCount = (p: Profile) => {
  if ((p.status ?? '').toLowerCase() !== 'active') return 0;
  if (!p.end_date) return 0;
  const end = new Date(p.end_date).getTime();
  const startRef = new Date(p.next_invoice_date || new Date().toISOString().slice(0, 10)).getTime();
  if (!isFinite(end) || !isFinite(startRef) || end < startRef) return 0;
  const days = (end - startRef) / 86400000;
  return Math.floor(days / periodDays(p.recurrence_frequency, p.repeat_every)) + 1;
};

/** Restsumme = offene Raten × Ratenbetrag */
const remainingAmount = (p: Profile) => remainingCount(p) * Number(p.total || 0);


export default function WiederkehrendeZahler() {
  const { region } = useAccountingRegion();
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'stopped' | 'sepa'>('active');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'overdue' | 'draft'>('all');

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState<20 | 50 | 100 | 'all'>(20);
  type SortKey = 'date_new' | 'date_old' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';
  const [sortBy, setSortBy] = useState<SortKey>('date_new');

  const { canWrite } = useFinancePermissions();
  const [editProfile, setEditProfile] = useState<EditableProfile | null>(null);
  const [bookInvoice, setBookInvoice] = useState<BookableInvoice | null>(null);
  const [pdfInvoice, setPdfInvoice] = useState<PdfInvoiceRef | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);


  async function stopProfile(p: Profile) {
    if (!confirm(`Vertrag "${p.recurrence_name || p.reference_number || ''}" stoppen und zur Prüfung verschieben?`)) return;
    setStoppingId(p.id);
    const { error } = await supabase
      .from('zoho_recurring_profiles')
      .update({ status: 'pruefung' } as any)
      .eq('id', p.id);
    setStoppingId(null);
    if (error) {
      toast({ title: 'Stopp fehlgeschlagen', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Vertrag gestoppt', description: 'Der Datensatz liegt jetzt unter Prüfung.' });
    load();
  }


  async function load() {
    setLoading(true);
    setError(null);
    const [p, i] = await Promise.all([
      supabase
        .from('zoho_recurring_profiles')
        .select('*')
        .eq('accounting_region', region === 'CH' ? 'CH' : 'EU')
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(5000),
      supabase
        .from('zoho_recurring_invoices')
        .select('*')
        .eq('accounting_region', region === 'CH' ? 'CH' : 'EU')
        .order('invoice_date', { ascending: false, nullsFirst: false })
        .limit(5000),
    ]);
    if (p.error) { setError(p.error.message); setLoading(false); return; }
    if (i.error) { setError(i.error.message); setLoading(false); return; }
    setProfiles((p.data ?? []) as Profile[]);
    setInvoices((i.data ?? []) as Invoice[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [region]);

  async function runSync() {
    setSyncing(true);
    try {
      const [a, b] = await Promise.all([
        supabase.functions.invoke('sync-zoho-recurring-profiles', {
          body: { source_system: 'zoho_eu_1', page: 1, per_page: 100, max_pages: 30 },
        }),
        supabase.functions.invoke('sync-zoho-recurring-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: '2024-01-01', page: 1, per_page: 200, max_pages: 30, fetch_details: false },
        }),
      ]);
      if (a.error || b.error) throw new Error(a.error?.message || b.error?.message);
      toast({ title: 'Sync gestartet', description: 'Profile & Rechnungen werden aktualisiert.' });
      await load();
    } catch (e: any) {
      toast({ title: 'Sync fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    const keyOf = (cid: string | null, name: string | null) => cid || `name:${(name || 'Unbekannt').toLowerCase()}`;

    for (const p of profiles) {
      const k = keyOf(p.customer_id, p.company_name || p.customer_name);
      if (!map.has(k)) {
        map.set(k, {
          customer_id: p.customer_id || k,
          customer_name: p.company_name || p.customer_name || 'Unbekannt',
          profiles: [], invoices: [], monthly: 0, remaining: 0, ytdBilled: 0, openBalance: 0,
          lastInvoiceDate: null, nextInvoiceDate: null, newestCreatedAt: null, currency: p.currency || 'EUR',
          hasSepa: false,
        });
      }
      const g = map.get(k)!;
      g.profiles.push(p);
      if (isSepaProfile(p)) g.hasSepa = true;
      const isActive = (p.status ?? '').toLowerCase() === 'active';
      if (isActive && p.total) g.monthly += Number(p.total) * monthsFactor(p.recurrence_frequency, p.repeat_every);
      g.remaining += remainingAmount(p);
      if (p.next_invoice_date && (!g.nextInvoiceDate || p.next_invoice_date < g.nextInvoiceDate)) g.nextInvoiceDate = p.next_invoice_date;
      if (p.created_at && (!g.newestCreatedAt || p.created_at > g.newestCreatedAt)) g.newestCreatedAt = p.created_at;
    }

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const invMatches = (inv: Invoice) => {
      if (invoiceStatusFilter === 'all') return true;
      const s = (inv.status ?? '').toLowerCase();
      const bal = Number(inv.balance || 0);
      if (invoiceStatusFilter === 'paid') return s === 'paid' || bal <= 0;
      if (invoiceStatusFilter === 'unpaid') return bal > 0 && s !== 'draft';
      if (invoiceStatusFilter === 'overdue') return bal > 0 && !!(inv as any).due_date && String((inv as any).due_date) < today;
      if (invoiceStatusFilter === 'draft') return s === 'draft' || s === 'entwurf';
      return true;
    };
    for (const inv of invoices.filter(invMatches)) {

      const k = keyOf(inv.customer_id, inv.customer_name);
      if (!map.has(k)) {
        map.set(k, {
          customer_id: inv.customer_id || k,
          customer_name: inv.customer_name || 'Unbekannt',
          profiles: [], invoices: [], monthly: 0, remaining: 0, ytdBilled: 0, openBalance: 0,
          lastInvoiceDate: null, nextInvoiceDate: null, newestCreatedAt: null, currency: inv.currency || 'EUR',
          hasSepa: false,
        });
      }
      const g = map.get(k)!;
      g.invoices.push(inv);
      if (inv.invoice_date && inv.invoice_date >= yearStart) g.ytdBilled += Number(inv.total || 0);
      if (inv.balance) g.openBalance += Number(inv.balance);
      if (inv.invoice_date && (!g.lastInvoiceDate || inv.invoice_date > g.lastInvoiceDate)) g.lastInvoiceDate = inv.invoice_date;
    }

    return Array.from(map.values())
      .filter(g => {
        if (invoiceStatusFilter !== 'all' && g.invoices.length === 0) return false;
        if (statusFilter === 'sepa') return g.hasSepa;
        if (statusFilter === 'active') return !g.hasSepa && g.profiles.some(p => (p.status ?? '').toLowerCase() === 'active');
        if (statusFilter === 'stopped') return !g.hasSepa && g.profiles.length > 0 && g.profiles.every(p => (p.status ?? '').toLowerCase() !== 'active');
        return true;
      })
      .sort((a, b) => {
        const ac = a.newestCreatedAt || '';
        const bc = b.newestCreatedAt || '';
        if (ac !== bc) return bc.localeCompare(ac);
        return b.monthly - a.monthly;
      });
  }, [profiles, invoices, statusFilter, invoiceStatusFilter]);


  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const s = search.toLowerCase();
    return groups.filter(g =>
      g.customer_name.toLowerCase().includes(s) ||
      g.profiles.some(p => (p.recurrence_name ?? '').toLowerCase().includes(s) || (p.reference_number ?? '').toLowerCase().includes(s)) ||
      g.invoices.some(i => (i.invoice_number ?? '').toLowerCase().includes(s))
    );
  }, [groups, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'amount_desc': return arr.sort((a, b) => b.monthly - a.monthly);
      case 'amount_asc': return arr.sort((a, b) => a.monthly - b.monthly);
      case 'date_new': return arr.sort((a, b) => (b.newestCreatedAt || '').localeCompare(a.newestCreatedAt || ''));
      case 'date_old': return arr.sort((a, b) => (a.newestCreatedAt || '').localeCompare(b.newestCreatedAt || ''));
      case 'name_asc': return arr.sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'de'));
      case 'name_desc': return arr.sort((a, b) => b.customer_name.localeCompare(a.customer_name, 'de'));
      default: return arr;
    }
  }, [filtered, sortBy]);

  const visible = useMemo(
    () => (pageSize === 'all' ? sorted : sorted.slice(0, pageSize)),
    [sorted, pageSize]
  );

  const totals = useMemo(() => {
    return {
      customers: filtered.length,
      monthly: filtered.reduce((s, g) => s + g.monthly, 0),
      remaining: filtered.reduce((s, g) => s + g.remaining, 0),
      ytd: filtered.reduce((s, g) => s + g.ytdBilled, 0),
      open: filtered.reduce((s, g) => s + g.openBalance, 0),
      activeProfiles: filtered.reduce((s, g) => s + g.profiles.filter(p => (p.status ?? '').toLowerCase() === 'active').length, 0),
    };
  }, [filtered]);

  // ---------- Auswahl & Export ----------
  const selectedGroups = useMemo(() => filtered.filter(g => selected[g.customer_id]), [filtered, selected]);
  const exportGroups = selectedGroups.length > 0 ? selectedGroups : filtered;
  const allSelected = filtered.length > 0 && filtered.every(g => selected[g.customer_id]);
  const someSelected = filtered.some(g => selected[g.customer_id]);

  function toggleAll(v: boolean) {
    setSelected(prev => {
      const next = { ...prev };
      filtered.forEach(g => { if (v) next[g.customer_id] = true; else delete next[g.customer_id]; });
      return next;
    });
  }

  type ExportRow = Record<string, string | number>;
  function buildRows(): ExportRow[] {
    const rows: ExportRow[] = [];
    for (const g of exportGroups) {
      if (g.profiles.length === 0) {
        rows.push({
          Kunde: g.customer_name, Vertrag: '—', Referenz: '', Status: '',
          Frequenz: '', Erfasst: '', Start: '', Ende: '', 'Letzte Rechnung': fmtDate(g.lastInvoiceDate),
          'Nächste Rechnung': fmtDate(g.nextInvoiceDate), Währung: g.currency,
          Betrag: 0, Monatlich: 0, 'Restraten': 0, Restsumme: 0, 'Abgerechnet YTD': Number(g.ytdBilled.toFixed(2)), 'Offener Betrag': Number(g.openBalance.toFixed(2)),
          SEPA: g.hasSepa ? 'Ja' : 'Nein',
        });
        continue;
      }
      for (const p of g.profiles) {
        rows.push({
          Kunde: g.customer_name,
          Vertrag: p.recurrence_name ?? '—',
          Referenz: p.reference_number ?? '',
          Status: p.status ?? '',
          Frequenz: `${p.repeat_every ?? 1}x ${p.recurrence_frequency ?? ''}`.trim(),
          Erfasst: fmtDate(p.created_at),
          Start: fmtDate(p.start_date),
          Ende: fmtDate(p.end_date),
          'Letzte Rechnung': fmtDate(p.last_sent_date),
          'Nächste Rechnung': fmtDate(p.next_invoice_date),
          Währung: p.currency || g.currency,
          Betrag: Number(Number(p.total || 0).toFixed(2)),
          Monatlich: Number((Number(p.total || 0) * monthsFactor(p.recurrence_frequency, p.repeat_every)).toFixed(2)),
          'Restraten': remainingCount(p),
          Restsumme: Number(remainingAmount(p).toFixed(2)),
          'Abgerechnet YTD': Number(g.ytdBilled.toFixed(2)),
          'Offener Betrag': Number(g.openBalance.toFixed(2)),
          SEPA: g.hasSepa ? 'Ja' : 'Nein',
        });
      }
    }
    return rows;
  }

  const fileBase = () => `wiederkehrende-zahler-${region}-${new Date().toISOString().slice(0, 10)}`;

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = buildRows();
    if (!rows.length) { toast({ title: 'Keine Daten', description: 'Nichts zu exportieren.', variant: 'destructive' }); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '\uFEFF' + [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileBase()}.csv`);
    toast({ title: 'CSV exportiert', description: `${rows.length} Zeilen` });
  }

  async function exportXlsx() {
    const rows = buildRows();
    if (!rows.length) { toast({ title: 'Keine Daten', description: 'Nichts zu exportieren.', variant: 'destructive' }); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(c => ({ wch: Math.max(12, c.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wiederkehrende Zahler');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase()}.xlsx`);
    toast({ title: 'Excel exportiert', description: `${rows.length} Zeilen` });
  }

  async function exportPdf() {
    const rows = buildRows();
    if (!rows.length) { toast({ title: 'Keine Daten', description: 'Nichts zu exportieren.', variant: 'destructive' }); return; }
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const cols = ['Kunde', 'Vertrag', 'Referenz', 'Status', 'Frequenz', 'Erfasst', 'Start', 'Ende', 'Nächste Rechnung', 'Betrag', 'Monatlich', 'Restsumme'];
    const sumMonthly = exportGroups.reduce((s, g) => s + g.monthly, 0);
    doc.setFontSize(14);
    doc.text(`Wiederkehrende Zahler · Buchhaltung ${region}`, 40, 40);
    doc.setFontSize(9);
    doc.text(
      `${exportGroups.length} Kunden · ${rows.length} Verträge · Volumen/Monat ${fmt(sumMonthly)} · Stand ${new Date().toLocaleDateString('de-DE')}`,
      40, 56,
    );
    autoTable(doc, {
      startY: 72,
      head: [cols],
      body: rows.map(r => cols.map(c => (typeof r[c] === 'number' ? fmt(Number(r[c]), String(r['Währung'] || 'EUR')) : String(r[c] ?? '')))),
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 30], textColor: [212, 175, 55] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' } },
    });
    doc.save(`${fileBase()}.pdf`);
    toast({ title: 'PDF exportiert', description: `${rows.length} Zeilen` });
  }


  if (loading) return <div className="space-y-6"><SkeletonKpiGrid count={5} /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wiederkehrende Zahler"
        subtitle="Periodische Rechnungen & aktive Verträge aus Zoho Deutschland — gruppiert nach Kundenkonto"
        icon={Repeat}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="done" label={`${profiles.length}`} dotOnly />}
        actions={
          <div className="flex items-center gap-2">
            {canWrite && (
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Neuanlage
              </Button>
            )}
            <Button onClick={runSync} disabled={syncing} size="sm" variant="outline">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Jetzt synchronisieren
            </Button>
          </div>
        }

      />

      {error && <PageError message={error} onRetry={load} />}

      <div className="grid md:grid-cols-4 gap-4">
        <KpiTile label="Kunden" value={totals.customers} icon={Repeat} accent="sky" />
        <KpiTile label="Selbstzahler" value={totals.activeProfiles} icon={Repeat} accent="violet" />
        <KpiTile label="Volumen / Monat" value={fmt(totals.monthly)} icon={Repeat} accent="gold" />
        <KpiTile label="Restsumme offen" value={fmt(totals.remaining)} icon={Repeat} accent="emerald" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Kunde, Vertragsnr. oder Rechnungsnr. suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          {(['sepa', 'active', 'stopped', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded ${statusFilter === s ? (s === 'sepa' ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground') : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'sepa' ? 'SEPA' : s === 'active' ? 'Selbstzahler' : s === 'stopped' ? 'Beendet' : 'Alle'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          {(['all', 'unpaid', 'overdue', 'paid', 'draft'] as const).map(s => (
            <button
              key={s}
              onClick={() => setInvoiceStatusFilter(s)}
              className={`px-3 py-1 text-xs rounded ${invoiceStatusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s === 'all' ? 'Status: Alle' : s === 'unpaid' ? 'Offen' : s === 'overdue' ? 'Überfällig' : s === 'paid' ? 'Bezahlt' : 'Entwurf'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Sortierung:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="amount_desc">Betrag absteigend</option>
            <option value="amount_asc">Betrag aufsteigend</option>
            <option value="date_new">Datum neueste</option>
            <option value="date_old">Datum älteste</option>
            <option value="name_asc">Alphabetisch A–Z</option>
            <option value="name_desc">Alphabetisch Z–A</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Anzeige:</span>
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 20 | 50 | 100))}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">Alle</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none border border-border rounded-md px-3 py-2">
          <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label="Alle markieren" />
          {allSelected ? 'Auswahl aufheben' : 'Alle markieren'}
          {someSelected && <span className="text-primary font-medium">({selectedGroups.length})</span>}
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export {someSelected ? `(${selectedGroups.length} markiert)` : `(alle ${filtered.length})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {exportGroups.length} Kunden werden exportiert
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={exportPdf}><FileText className="w-4 h-4 mr-2" />PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={exportXlsx}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel (XLSX)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportCsv}><FileJson className="w-4 h-4 mr-2" />CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


      <DataCard
        title={`Kundenkonten (${visible.length} / ${filtered.length})`}
        actions={
          <div className="flex items-center gap-4 text-sm">
            <div className="text-muted-foreground">
              Σ Verträge monatlich:{' '}
              <span className="font-semibold text-primary tabular-nums">{fmt(totals.monthly)}</span>
            </div>
            <div className="text-muted-foreground">
              Σ Restsumme:{' '}
              <span className="font-semibold text-emerald-500 tabular-nums">{fmt(totals.remaining)}</span>
            </div>
            <div className="text-muted-foreground">
              Aktive Verträge:{' '}
              <span className="font-semibold text-foreground tabular-nums">{totals.activeProfiles}</span>
            </div>
          </div>
        }
      >
        <div className="divide-y divide-border -mx-5">
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center text-muted-foreground text-sm">Keine Treffer.</div>
          )}
          {visible.map(g => {
            const isOpen = !!open[g.customer_id];
            const activeP = g.profiles.filter(p => (p.status ?? '').toLowerCase() === 'active').length;
            return (
              <div key={g.customer_id} className="px-5">
                <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!selected[g.customer_id]}
                  onCheckedChange={(v) => setSelected(s => ({ ...s, [g.customer_id]: !!v }))}
                  aria-label={`${g.customer_name} markieren`}
                />
                <button
                  className="flex-1 min-w-0 py-3 flex items-center gap-3 hover:bg-muted/30 px-2 rounded transition-colors text-left"
                  onClick={() => setOpen(s => ({ ...s, [g.customer_id]: !s[g.customer_id] }))}
                >

                  {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {g.hasSepa ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4 tracking-wide">SEPA</Badge>
                      ) : (
                        <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0 h-4 tracking-wide">Zahler</Badge>
                      )}
                      <span className="truncate">{g.customer_name}</span>
                    </div>
                    {g.remaining > 0 && (
                      <div className="text-[11px] mt-0.5">
                        <span className="text-muted-foreground">Restsumme: </span>
                        <span className="font-semibold text-primary tabular-nums">{fmt(g.remaining, g.currency)}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                      <span>{activeP} aktiv / {g.profiles.length} Verträge</span>
                      <span>{g.invoices.length} Rechnungen</span>
                      {g.nextInvoiceDate && <span>nächste: {fmtDate(g.nextInvoiceDate)}</span>}
                      {g.lastInvoiceDate && <span>letzte: {fmtDate(g.lastInvoiceDate)}</span>}
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-end text-sm">
                    <span className="font-semibold tabular-nums">{fmt(g.monthly, g.currency)}<span className="text-xs text-muted-foreground"> /Mon.</span></span>
                    <span className="text-xs text-muted-foreground tabular-nums">YTD {fmt(g.ytdBilled, g.currency)}</span>
                  </div>
                  {g.openBalance > 0 && (
                    <Badge variant="destructive" className="ml-2 tabular-nums">{fmt(g.openBalance, g.currency)}</Badge>
                  )}
                </button>
                </div>


                {isOpen && (
                  <div className="pb-4 pl-7 space-y-4 animate-fade-in">
                    {g.profiles.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-medium mb-2">Verträge / Profile</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="text-left px-3 py-2">Name / Referenz</th>
                                <th className="text-left px-3 py-2">Erfasst</th>
                                <th className="text-left px-3 py-2">Frequenz</th>
                                <th className="text-left px-3 py-2">Start</th>
                                <th className="text-left px-3 py-2">Ende</th>
                                <th className="text-left px-3 py-2">Letzte</th>
                                <th className="text-left px-3 py-2">Nächste</th>
                                <th className="text-right px-3 py-2">Betrag</th>
                                <th className="text-right px-3 py-2">Monatlich</th>
                                <th className="text-right px-3 py-2">Restsumme</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-right px-3 py-2">Aktion</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.profiles.map(p => {
                                const monthly = Number(p.total || 0) * monthsFactor(p.recurrence_frequency, p.repeat_every);
                                return (
                                <tr key={p.id} className="border-t border-border">
                                  <td className="px-3 py-2">
                                    <div className="font-medium">{p.recurrence_name || '—'}</div>
                                    {p.reference_number && <div className="text-xs text-muted-foreground font-mono">{p.reference_number}</div>}
                                  </td>
                                  <td className="px-3 py-2">{fmtDate(p.created_at)}</td>
                                  <td className="px-3 py-2">{p.repeat_every ?? 1}× {p.recurrence_frequency ?? '—'}</td>
                                  <td className="px-3 py-2">{fmtDate(p.start_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.end_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.last_sent_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(p.next_invoice_date)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(p.total || 0), p.currency || 'EUR')}</td>
                                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(monthly, p.currency || 'EUR')}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-primary">
                                    {remainingCount(p) > 0 ? (
                                      <>
                                        {fmt(remainingAmount(p), p.currency || 'EUR')}
                                        <div className="text-[10px] text-muted-foreground font-normal">{remainingCount(p)} Raten</div>
                                      </>
                                    ) : '—'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant={(p.status ?? '').toLowerCase() === 'active' ? 'default' : 'secondary'} className="capitalize">{p.status ?? '—'}</Badge>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={!canWrite}
                                        onClick={() => setEditProfile(p as EditableProfile)}
                                      >
                                        Bearbeiten
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={!canWrite || stoppingId === p.id || (p.status ?? '').toLowerCase() === 'pruefung'}
                                        onClick={() => stopProfile(p)}
                                        title="Vertrag stoppen und zur Prüfung verschieben"
                                      >
                                        {stoppingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'STOP'}
                                      </Button>
                                    </div>
                                  </td>

                                </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                                <td className="px-3 py-2" colSpan={7}>Summe ({g.profiles.length} Verträge, davon {activeP} aktiv)</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {fmt(g.profiles.reduce((s, p) => s + Number(p.total || 0), 0), g.currency)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-primary">
                                  {fmt(g.monthly, g.currency)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-primary">
                                  {fmt(g.remaining, g.currency)}
                                </td>
                                <td />
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )}

                    {g.invoices.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-medium mb-2">Rechnungen ({g.invoices.length})</h4>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="text-left px-3 py-2">Rechnungsnr.</th>
                                <th className="text-left px-3 py-2">Datum</th>
                                <th className="text-left px-3 py-2">Fällig</th>
                                <th className="text-right px-3 py-2">Betrag</th>
                                <th className="text-right px-3 py-2">Offen</th>
                                <th className="text-left px-3 py-2">Status</th>
                                <th className="text-left px-3 py-2">Letzte Zahlung</th>
                                <th className="text-right px-3 py-2">Aktion</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.invoices.slice(0, 50).map(inv => (
                                <tr key={inv.id} className="border-t border-border">
                                  <td className="px-3 py-2 font-mono">
                                    {inv.zoho_invoice_id ? (
                                      <button
                                        type="button"
                                        onClick={() => setPdfInvoice({
                                          zoho_invoice_id: inv.zoho_invoice_id,
                                          invoice_number: inv.invoice_number,
                                          source_system: (inv as any).source_system ?? 'zoho_eu_1',
                                          recurring: false,
                                        })}
                                        className="text-primary hover:underline"
                                        title="Rechnung als PDF öffnen"
                                      >
                                        {inv.invoice_number || 'PDF'}
                                      </button>
                                    ) : (inv.invoice_number || '—')}
                                  </td>
                                  <td className="px-3 py-2">{fmtDate(inv.invoice_date)}</td>
                                  <td className="px-3 py-2">{fmtDate(inv.due_date)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(inv.total || 0), inv.currency || 'EUR')}</td>
                                  <td className={`px-3 py-2 text-right tabular-nums ${Number(inv.balance) > 0 ? 'text-destructive font-medium' : ''}`}>
                                    {fmt(Number(inv.balance || 0), inv.currency || 'EUR')}
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge variant={(inv.status ?? '').toLowerCase() === 'paid' ? 'default' : 'secondary'} className="capitalize">{inv.status ?? '—'}</Badge>
                                  </td>
                                  <td className="px-3 py-2">{fmtDate(inv.last_payment_date)}</td>
                                  <td className="px-3 py-2 text-right">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!canWrite}
                                      onClick={() => setBookInvoice(inv as BookableInvoice)}
                                    >
                                      Buchen
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                              {g.invoices.length > 50 && (
                                <tr><td colSpan={8} className="px-3 py-2 text-center text-xs text-muted-foreground">… {g.invoices.length - 50} weitere</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DataCard>

      <p className="text-xs text-muted-foreground text-center">
        Quelle: Zoho Deutschland (zoho_eu_1) · Tägliche Synchronisation 23:45 Uhr · {profiles.length} Profile · {invoices.length} Rechnungen geladen
      </p>

      <RecurringProfileEditDialog
        profile={editProfile}
        open={!!editProfile}
        onOpenChange={(v) => { if (!v) setEditProfile(null); }}
        onSaved={load}
      />
      <InvoicePdfDialog
        invoice={pdfInvoice}
        open={!!pdfInvoice}
        onOpenChange={(v) => { if (!v) setPdfInvoice(null); }}
      />
      <RecurringInvoiceBookDialog
        invoice={bookInvoice}
        open={!!bookInvoice}
        onOpenChange={(v) => { if (!v) setBookInvoice(null); }}
        onBooked={load}
      />
      <RecurringProfileCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        region={region === 'CH' ? 'CH' : 'EU'}
        onCreated={load}
      />

    </div>
  );
}
