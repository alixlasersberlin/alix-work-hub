import { TenantBadge } from '@/components/TenantBadge';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { maskRevenueString } from '@/lib/revenue-mask';
import { supabase } from '@/integrations/supabase/client';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { FileText, RefreshCw, ArrowRightLeft, ChevronDown, ChevronRight, Users, Wallet, AlertTriangle, Repeat, Pencil, Printer, Download, Loader2, Trash2, Mail, CheckCircle2, TrendingUp, Clock, Zap, Scale, Gavel, ArrowUp, ArrowDown, ChevronsUpDown, Undo2, X as LucideXIcon } from 'lucide-react';

function SortableTh({ label, sortKey, colSort, onSort, align = 'left' }: {
  label: string;
  sortKey: any;
  colSort: { key: any; dir: 'asc' | 'desc' } | null;
  onSort: (k: any) => void;
  align?: 'left' | 'right';
}) {
  const active = colSort?.key === sortKey;
  return (
    <th className={`px-4 py-2 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Nach ${label} sortieren`}
        className={`inline-flex items-center gap-1 uppercase transition-colors hover:text-primary ${active ? 'text-primary' : ''}`}
      >
        {label}
        {active
          ? (colSort!.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
          : <ChevronsUpDown className="w-3 h-3 opacity-30" />}
      </button>
    </th>
  );
}

import { cn } from '@/lib/utils';
import { postPaymentToJournal } from '@/lib/finance/journal';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAccountingRegion } from '@/contexts/AccountingRegionContext';

import { ListToolbar } from '@/components/finance/ListToolbar';
import { AccountStatementActions } from '@/components/finance/AccountStatementActions';
import { SofortRechnungDialog } from '@/components/finance/SofortRechnungDialog';
import { InvoiceReturnDebitDialog } from '@/components/finance/InvoiceReturnDebitDialog';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { stampExistingPdfBlob } from '@/lib/facsimile/jsPdfHelpers';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';
import templateAsset from '@/assets/az-rechnung-template.jpg.asset.json';
import logoAsset from '@/assets/alix-logo-gold-pdf.png.asset.json';

let _tplCache: string | null = null;
let _logoCache: string | null = null;
async function loadDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function loadTemplate(): Promise<string> {
  if (_tplCache) return _tplCache;
  _tplCache = await loadDataUrl(templateAsset.url);
  return _tplCache;
}
async function loadLogo(): Promise<string> {
  if (_logoCache) return _logoCache;
  _logoCache = await loadDataUrl(logoAsset.url);
  return _logoCache;
}
function addrLinesFromObj(a: any): string[] {
  if (!a || typeof a !== 'object') return [];
  const out: string[] = [];
  const street = a.address || a.street;
  const street2 = a.street2 || a.address2;
  const zipCity = [a.zip || a.postal_code || '', a.city || ''].filter(Boolean).join(' ');
  if (street) out.push(String(street));
  if (street2) out.push(String(street2));
  if (zipCity) out.push(zipCity);
  if (a.country) out.push(String(a.country));
  return out;
}


type Row = {
  id: string;
  source: 'invoice' | 'recurring' | 'unpaid';

  zoho_invoice_id: string | null;
  source_system: string | null;
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
  raw_data?: any;
  raw_is_draft?: boolean | null;
  is_mietkauf?: boolean | null;
  is_deposit?: boolean | null;
  deposit_id?: string | null;
  created_at?: string | null;
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
  /** Neuestes Datum einer gestellten/festgeschriebenen Rechnung (kein Entwurf/Storno) */
  lastFinalizedDate?: string | null;
};

function statusVariant(s: string | null) {
  const v = (s ?? '').toLowerCase();
  if (v.includes('bezahlt') && !v.includes('teil')) return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (v.includes('teil')) return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  if (v.includes('über')) return 'bg-destructive text-destructive-foreground border-destructive font-semibold';
  if (v.includes('offen')) return 'bg-destructive text-destructive-foreground border-destructive font-semibold';
  return 'bg-muted text-muted-foreground border-border';
}

function _fmtMoneyBase(n: number | null, c: string | null = 'EUR') {
  if (n == null) return '–';
  try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c || 'EUR' }).format(n); }
  catch { return `${n.toFixed(2)} ${c ?? ''}`; }
}
function fmtMoney(n: number | null, c: string | null = 'EUR') { return maskRevenueString(_fmtMoneyBase(n, c)); }
function fmtDate(d: string | null) {
  if (!d) return '–';
  try { return new Date(d).toLocaleDateString('de-DE'); } catch { return d; }
}

function isDraftInvoice(r: Pick<Row, 'status' | 'payment_status' | 'raw_data' | 'raw_is_draft'>) {
  const status = String(r.status ?? '').toLowerCase();
  const paymentStatus = String(r.payment_status ?? '').toLowerCase();
  const rawDraft = r.raw_is_draft === true || r.raw_data?.is_draft === true;
  return status === 'draft' || status === 'entwurf' || paymentStatus === 'entwurf' || rawDraft;
}

function matchesDocStatus(r: Row, docStatus: string) {
  if (docStatus === 'all') return true;
  const s = String(r.status ?? '').toLowerCase();
  if (docStatus === 'draft') return isDraftInvoice(r);
  if (docStatus === 'void') return s === 'void' || s === 'storniert' || s === 'cancelled';
  if (docStatus === 'anwalt') return isAnwaltRow(r);
  if (docStatus === 'inkasso') return isInkassoRow(r);
  if (docStatus === 'bezahlt' || docStatus === 'offen' || docStatus === 'teilweise bezahlt' || docStatus === 'überfällig') {
    if (s === 'void' || s === 'storniert' || s === 'cancelled') return false;
    return matchesPayStatus(r, docStatus);
  }
  // sent = alles andere (verschickt/offen/bezahlt)
  return !isDraftInvoice(r) && !(s === 'void' || s === 'storniert' || s === 'cancelled');
}


// "Offen" umfasst auch teilweise bezahlte / überfällige Rechnungen mit Restsaldo
export function matchesPayStatus(r: Row, statusFilter: string): boolean {
  if (statusFilter === 'all') return true;
  const ps = (r.payment_status ?? '').toLowerCase();
  if (statusFilter.toLowerCase() === 'offen') {
    if (ps === 'bezahlt' || ps === 'paid') return false;
    return ps === 'offen' || ps === 'teilweise bezahlt' || ps === 'überfällig' || Number(r.balance ?? 0) > 0;
  }
  return ps === statusFilter.toLowerCase();
}

// Reihenfolge für die Sortierung nach Status (Gruppen von "aktiv" nach "erledigt")
export function statusRank(r: Row): number {
  const s = String(r.status ?? '').toLowerCase();
  if (s === 'void' || s === 'storniert' || s === 'cancelled') return 90;
  if (isDraftInvoice(r)) return 10;
  const ps = String(r.payment_status ?? '').trim().toLowerCase();
  if (ps === 'anwalt') return 70;
  if (ps === 'inkasso intern') return 60;
  if (ps === 'überfällig') return 20;
  if (ps === 'teilweise bezahlt') return 30;
  if (ps === 'offen' || Number(r.balance ?? 0) > 0) return 40;
  if (ps === 'bezahlt' || ps === 'paid') return 80;
  return 50;
}

type ViewMode = 'accounts' | 'list' | 'highest' | 'oldest' | 'newest' | 'overdue' | 'anwalt' | 'inkasso';


// Rechnungen im Status "Anwalt" werden aus allen normalen Ansichten ausgeblendet
export function isAnwaltRow(r: Row): boolean {
  return String(r.payment_status ?? '').trim().toLowerCase() === 'anwalt';
}

// Rechnungen im Status "Inkasso Intern" werden ebenfalls separat geführt
export function isInkassoRow(r: Row): boolean {
  return String(r.payment_status ?? '').trim().toLowerCase() === 'inkasso intern';
}

function flatRowsForKpi(rows: Row[], search: string, statusFilter: string, docStatus = 'all'): number {
  let res = rows;
  if (statusFilter !== 'all') {
    res = res.filter((r) => matchesPayStatus(r, statusFilter));
  }

  res = res.filter((r) => matchesDocStatus(r, docStatus));
  res = search.trim() ? res.filter((r) => matchesQuery(r, search)) : res;
  return res.reduce((s, r) => s + Number(r.balance ?? 0), 0);
}


type InvoicesProps = { mietkaufOnly?: boolean };

// Zieltabelle je Datenquelle
function tableFor(source: Row['source']) {
  if (source === 'recurring') return 'zoho_recurring_invoices';
  if (source === 'unpaid') return 'zoho_unpaid_invoices';
  return 'zoho_invoices';
}

// Modul-Cache: Rechnungsliste bleibt beim Zurücknavigieren sofort sichtbar
const ROWS_CACHE = new Map<string, { ts: number; rows: Row[] }>();
const ROWS_CACHE_TTL = 60_000;
// Cache der Mietkauf-Summen je Mandant (Kontenansicht)
const MK_CACHE = new Map<string, { ts: number; map: Record<string, number> }>();
const MK_CACHE_TTL = 5 * 60_000;



export default function Invoices({ mietkaufOnly = false }: InvoicesProps) {
  const { tenantId } = useTenantFilter();

  const { roles, user, profile } = useAuth();
  const { region, setRegion } = useAccountingRegion();
  const [returnDebitRow, setReturnDebitRow] = useState<Row | null>(null);

  const isSuperAdmin = (roles.includes('Super Admin') || roles.includes('Admin'));
  const isAdmin = roles.includes('Admin') || isSuperAdmin;
  /** Löschen ist ausschließlich Super Admin erlaubt */
  const canDelete = roles.includes('Super Admin');

  /** REVISION-Markierungen je Rechnung (finance_invoice_revisions) */
  type RevisionEntry = { revised_at: string; revised_by_name: string | null };
  const [revisions, setRevisions] = useState<Record<string, RevisionEntry>>({});
  const [revisionBusyId, setRevisionBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, RevisionEntry> = {};
      let cursor: string | null = null;
      for (let i = 0; i < 20; i++) {
        let q: any = (supabase.from('finance_invoice_revisions') as any)
          .select('id, invoice_id, revised_at, revised_by_name')
          .eq('is_revision', true)
          .order('id', { ascending: false })
          .limit(1000);
        if (cursor) q = q.lt('id', cursor);
        const { data, error } = await q;
        if (error) break;
        const list = data ?? [];
        for (const row of list) map[row.invoice_id] = { revised_at: row.revised_at, revised_by_name: row.revised_by_name };
        if (list.length < 1000) break;
        cursor = list[list.length - 1]?.id ?? null;
        if (!cursor) break;
      }
      if (!cancelled) setRevisions(map);
    })();
    return () => { cancelled = true; };
  }, []);


  const toggleRevision = async (r: Row, next: boolean) => {
    setRevisionBusyId(r.id);
    try {
      const userName = (profile as any)?.full_name || (profile as any)?.email || user?.email || 'Unbekannt';
      if (next) {
        const revised_at = new Date().toISOString();
        const { error } = await (supabase.from('finance_invoice_revisions') as any).upsert({
          invoice_id: r.id,
          invoice_source: r.source ?? 'invoice',
          invoice_number: r.invoice_number ?? null,
          is_revision: true,
          revised_at,
          revised_by: user?.id ?? null,
          revised_by_name: userName,
        }, { onConflict: 'invoice_id' });
        if (error) throw error;
        setRevisions((s) => ({ ...s, [r.id]: { revised_at, revised_by_name: userName } }));
        toast({ title: 'Revision gesetzt', description: `${r.invoice_number ?? ''} – ${userName}` });
      } else {
        const { error } = await (supabase.from('finance_invoice_revisions') as any)
          .update({ is_revision: false }).eq('invoice_id', r.id);
        if (error) throw error;
        setRevisions((s) => { const n = { ...s }; delete n[r.id]; return n; });
        toast({ title: 'Revision entfernt' });
      }
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Revision konnte nicht gespeichert werden', variant: 'destructive' });
    } finally {
      setRevisionBusyId(null);
    }
  };


  /** Aktionsleiste – wird als eigene Zeile unter der Rechnungszeile gerendert */
  const renderRowActions = (r: Row) => (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2">
      {isAdmin && (
        <Button size="sm" variant="ghost" title="Bearbeiten" onClick={(event) => handleEditClick(event, r)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button size="sm" variant="ghost" title="Drucken" disabled={pdfLoadingId === r.id} onClick={() => handlePrint(r)}>
        {pdfLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
      </Button>
      <Button size="sm" variant="ghost" title="Download PDF" disabled={pdfLoadingId === r.id} onClick={() => handleDownload(r)}>
        {pdfLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      </Button>
      {isAdmin && isDraftInvoice(r) && (
        <Button
          size="sm"
          variant="outline"
          title="Entwurf festschreiben"
          className="h-8 px-2 gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          onClick={() => commitDraft(r)}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Festschreiben
        </Button>
      )}
      {isAdmin && (r.payment_status ?? '').toLowerCase() !== 'bezahlt' && (
        <Button
          size="sm"
          variant="outline"
          title="Als bezahlt buchen"
          className="h-8 px-2 gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
          onClick={(event) => handleBookClick(event, r)}
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Buchen
        </Button>
      )}
      {isAdmin && (

        <Button
          size="sm"
          variant="outline"
          type="button"
          title="Status ändern"
          className="h-8 px-2 gap-1 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openStatusDialog(r); }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Status Änderung
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        type="button"
        title="Rechnung per E-Mail versenden"
        className="h-8 px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEmail(r); }}
      >
        <Mail className="w-3.5 h-3.5" /> Rechnung/Email
      </Button>
      <label
        className="flex items-center gap-1.5 h-8 px-2 rounded-md border border-orange-500/40 text-orange-400 text-xs font-medium cursor-pointer hover:bg-orange-500/10"
        title={
          revisions[r.id]
            ? `Revision am ${new Date(revisions[r.id]!.revised_at).toLocaleString('de-DE')} von ${revisions[r.id]!.revised_by_name ?? 'unbekannt'}`
            : 'Rechnung als Revision markieren'
        }
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={!!revisions[r.id]}
          disabled={revisionBusyId === r.id}
          onCheckedChange={(v) => toggleRevision(r, v === true)}
        />
        REVISION
        {revisions[r.id] && (
          <span className="text-[10px] opacity-80">
            {new Date(revisions[r.id]!.revised_at).toLocaleDateString('de-DE')} · {revisions[r.id]!.revised_by_name ?? '—'}
          </span>
        )}
      </label>

      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          type="button"
          title={mietkaufOnly ? 'Aus Vermietung entfernen' : 'Als Mietkauf Geräte buchen und nach „In Vermietung" verschieben'}
          disabled={mietkaufBusyId === r.id}
          className="h-8 px-2 gap-1 border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMietkauf(r); }}
        >
          {mietkaufBusyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
          {mietkaufOnly ? 'Vermietung lösen' : 'Mietkauf Geräte'}
        </Button>
      )}
      {r.source !== 'unpaid' && (
        <Button
          size="sm"
          variant="outline"
          type="button"
          title={r.is_deposit ? 'Anzahlungs-Markierung entfernen' : 'Als Anzahlung markieren – erscheint zusätzlich unter Offene Anzahlungen'}
          disabled={depositBusyId === r.id}
          className={`h-8 px-2 gap-1 ${r.is_deposit ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10' : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleDeposit(r); }}
        >
          {depositBusyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
          {r.is_deposit ? 'Ist Anzahlung ✓' : 'Ist Anzahlung'}
        </Button>
      )}
      {isAdmin && r.source !== 'unpaid' && (
        <Button
          size="sm"
          variant="outline"
          type="button"
          title="Zahlung stornieren und Rücklastschrift buchen (Gebühren + Gerätesperre)"
          className="h-8 px-2 gap-1 border-rose-500/50 text-rose-400 hover:bg-rose-500/10"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReturnDebitRow(r); }}
        >
          <Undo2 className="w-3.5 h-3.5" /> Rücklastschrift
        </Button>
      )}

      {canDelete && (
        <Button size="sm" variant="ghost" title="Löschen" className="text-destructive hover:text-destructive" onClick={() => handleDelete(r)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );


  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Filterung erst nach dem Tippen (hält die Eingabe flüssig bei tausenden Zeilen)
  const dSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [docStatusFilter, setDocStatusFilter] = useState<string>('all');
  // Zeitraum-Filter (Rechnungsdatum von/bis)
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const matchesDateRange = (r: Row) => {
    const d = String(r.invoice_date ?? r.created_at ?? '').slice(0, 10);
    if (!d) return !dateFrom && !dateTo;
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };
  const [includeUnpaid, setIncludeUnpaid] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('invoices_include_unpaid') === '1';
  });
  const setIncludeUnpaidPersist = (v: boolean) => {
    setIncludeUnpaid(v);
    try { localStorage.setItem('invoices_include_unpaid', v ? '1' : '0'); } catch {}
  };


  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [previewRow, setPreviewRow] = useState<Row | null>(null);
  const [openActions, setOpenActions] = useState<Record<string, boolean>>({});
  const toggleActions = (key: string) => setOpenActions((s) => ({ ...s, [key]: !s[key] }));
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ reference_number: '', due_date: '', payment_status: '', invoice_number: '', customer_name: '', invoice_date: '', total: '', balance: '', status: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [statusRow, setStatusRow] = useState<Row | null>(null);
  const [statusForm, setStatusForm] = useState({ payment_status: '', status: '' });
  const [statusSaving, setStatusSaving] = useState(false);
  const [emailRow, setEmailRow] = useState<Row | null>(null);
  const [emailForm, setEmailForm] = useState({ to_email: '', to_name: '', bcc: '', subject: '', body_text: '' });
  const [emailStatusAfter, setEmailStatusAfter] = useState('');

  const [emailSending, setEmailSending] = useState(false);
  const [emailPreparing, setEmailPreparing] = useState(false);
  const [bookRow, setBookRow] = useState<Row | null>(null);
  const [bookMethod, setBookMethod] = useState<'Überweisung' | 'Bar' | 'Lastschrift' | 'SEPA'>('Überweisung');
  const [bookDate, setBookDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [bookSaving, setBookSaving] = useState(false);
  const [bookAmount, setBookAmount] = useState<string>('0');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'highest';
    const v = localStorage.getItem('invoices_view_mode') as ViewMode | null;
    // Legacy-Werte: overdue/anwalt/inkasso sind jetzt kombinierbare Filter
    if (v === 'overdue' || v === 'anwalt' || v === 'inkasso') return 'list';
    return v && ['accounts', 'list', 'highest', 'oldest', 'newest'].includes(v) ? v : 'highest';
  });
  // Kombinierbare Zusatzfilter (können mit jeder Basis-Ansicht gemischt werden)
  type ExtraFilters = { overdue: boolean; anwalt: boolean; inkasso: boolean };
  const [extra, setExtra] = useState<ExtraFilters>(() => {
    const base: ExtraFilters = { overdue: false, anwalt: false, inkasso: false };
    if (typeof window === 'undefined') return base;
    try {
      const raw = localStorage.getItem('invoices_extra_filters');
      if (raw) return { ...base, ...JSON.parse(raw) };
      const v = localStorage.getItem('invoices_view_mode');
      if (v === 'overdue' || v === 'anwalt' || v === 'inkasso') return { ...base, [v]: true };
    } catch {}
    return base;
  });
  const toggleExtra = (k: keyof ExtraFilters) =>
    setExtra((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      try { localStorage.setItem('invoices_extra_filters', JSON.stringify(next)); } catch {}
      return next;
    });
  const [listSort, setListSort] = useState<'number' | 'date' | 'status'>(() => {
    if (typeof window === 'undefined') return 'date';
    return (localStorage.getItem('invoices_list_sort') as 'number' | 'date' | 'status') || 'date';
  });
  const setViewModePersist = (m: ViewMode) => {
    setViewMode(m); try { localStorage.setItem('invoices_view_mode', m); } catch {}
  };
  const setListSortPersist = (s: 'number' | 'date' | 'status') => {
    setListSort(s); try { localStorage.setItem('invoices_list_sort', s); } catch {}
  };
  const isListView = viewMode === 'list' || viewMode === 'newest';
  const isAccountView = !isListView;


  // ---- RECHNUNG NACHTRAG: fehlende Raten rückwirkend erzeugen (ohne Versand) ----
  const [nachtragBusy, setNachtragBusy] = useState<string | null>(null);

  // ---- SOFORT RECHNUNG: festgeschriebene Rechnung/Anzahlung direkt aufs Konto ----
  const [sofortAccount, setSofortAccount] = useState<Account | null>(null);


  const addRecurrenceInterval = (d: Date, freq: string | null, every: number | null) => {
    const e = every && every > 0 ? every : 1;
    const n = new Date(d);
    switch ((freq ?? 'months').toLowerCase()) {
      case 'days': n.setDate(n.getDate() + e); break;
      case 'weeks': n.setDate(n.getDate() + 7 * e); break;
      case 'years': n.setFullYear(n.getFullYear() + e); break;
      default: n.setMonth(n.getMonth() + e); break;
    }
    return n;
  };

  /** Erzeugt alle fehlenden periodischen Rechnungen des Kontos rückwirkend – ohne Versand an den Kunden. */
  async function nachtragAccount(a: Account) {
    if (!confirm(`„RECHNUNG NACHTRAG" für ${a.customer_name}?\n\nAlle fehlenden periodischen Rechnungen werden rückwirkend mit dem jeweiligen Monatsdatum erzeugt.\nEs erfolgt KEIN Versand an den Kunden.`)) return;
    setNachtragBusy(a.key);
    try {
      let q = supabase.from('zoho_recurring_profiles').select('*');
      q = a.customer_id
        ? q.eq('customer_id', a.customer_id)
        : q.ilike('customer_name', a.customer_name);
      const { data: profiles, error: pErr } = await q;
      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) {
        toast({ title: 'Kein Ratenvertrag gefunden', description: 'Für dieses Kundenkonto ist kein wiederkehrendes Profil hinterlegt.', variant: 'destructive' });
        return;
      }

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const rows: any[] = [];

      for (const p of profiles as any[]) {
        const { data: existing } = await supabase
          .from('zoho_recurring_invoices')
          .select('invoice_date')
          .eq('zoho_recurring_invoice_id', p.zoho_recurring_invoice_id ?? '');
        const existingDates = new Set(
          [
            ...((existing ?? []).map((i: any) => String(i.invoice_date ?? '').slice(0, 10))),
            ...a.rows.filter((r) => r.source === 'recurring').map((r) => String(r.invoice_date ?? '').slice(0, 10)),
          ].filter(Boolean),
        );

        const startStr = p.start_date || p.created_at;
        if (!startStr) continue;
        let cur = new Date(String(startStr).slice(0, 10));
        const endLimit = p.end_date ? new Date(p.end_date) : today;
        const stopAt = endLimit < today ? endLimit : today;
        let guard = 0;
        while (cur <= stopAt && guard < 240) {
          guard++;
          const iso = cur.toISOString().slice(0, 10);
          if (!existingDates.has(iso)) {
            const due = new Date(cur); due.setDate(due.getDate() + 14);
            rows.push({
              zoho_invoice_id: `local-${p.zoho_recurring_invoice_id || p.id}-${iso}`,
              zoho_recurring_invoice_id: p.zoho_recurring_invoice_id || null,
              invoice_number: `RN-${(p.reference_number || p.recurrence_name || 'VTR')}-${iso.replace(/-/g, '').slice(0, 6)}`,
              reference_number: p.reference_number || null,
              customer_id: p.customer_id ?? a.customer_id,
              customer_name: p.customer_name || p.company_name || a.customer_name,
              invoice_date: iso,
              due_date: due.toISOString().slice(0, 10),
              total: Number(p.total || 0),
              balance: Number(p.total || 0),
              currency: p.currency || 'EUR',
              status: 'open',
              payment_status: 'Offen',
              source_system: 'alixwork',
            });
          }
          cur = addRecurrenceInterval(cur, p.recurrence_frequency, p.repeat_every);
        }
      }

      if (rows.length === 0) {
        toast({ title: 'Keine Lücken gefunden', description: 'Alle periodischen Rechnungen sind bereits vorhanden.' });
        return;
      }

      const { error: iErr } = await supabase
        .from('zoho_recurring_invoices')
        .upsert(rows as any, { onConflict: 'source_system,zoho_invoice_id' });
      if (iErr) throw iErr;

      toast({
        title: 'Rechnungen nachgetragen',
        description: `${rows.length} fehlende Rechnung(en) rückwirkend erzeugt – ohne Versand an den Kunden.`,
      });
      fetchRows({ silent: true });
    } catch (e: any) {
      toast({ title: 'Nachtrag fehlgeschlagen', description: e?.message ?? String(e), variant: 'destructive' });
    } finally {
      setNachtragBusy(null);
    }
  }


  const fetchRows = async (opts?: { silent?: boolean }) => {
    const cacheKey = `${region}|${mietkaufOnly}|${includeUnpaid}`;
    const cached = ROWS_CACHE.get(cacheKey);
    if (!opts?.silent && cached && Date.now() - cached.ts < ROWS_CACHE_TTL) {
      // Sofort aus dem Cache anzeigen und im Hintergrund aktualisieren
      setRows(cached.rows);
      setLoading(false);
      void refetchRows(cacheKey, false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    setError(null);
    await refetchRows(cacheKey, !opts?.silent);
  };


  const refetchRows = async (cacheKey: string, showError: boolean) => {
    // Performance: raw_data (großes JSONB) NICHT in die Liste laden – nur das benötigte Flag.
    const cols = 'id, created_at, zoho_invoice_id, source_system, invoice_number, reference_number, customer_id, customer_name, city, invoice_date, due_date, total, balance, currency, status, payment_status, last_payment_date, raw_is_draft:raw_data->is_draft';
    // PostgREST liefert max. 1000 Zeilen je Request.
    // Seiten werden spekulativ PARALLEL (6 gleichzeitig) geladen, statt nacheinander.
    const fetchAllPages = async (build: () => any, page = 1000, max = 40000) => {
      const out: any[] = [];
      let start = 0;
      let done = false;
      while (!done && out.length < max) {
        const starts = [0, 1, 2, 3, 4, 5].map((k) => start + k * page);
        const res = await Promise.all(
          starts.map((s) => build().order('id', { ascending: false }).range(s, s + page - 1)),
        );
        for (const r of res) {
          if (r.error) return { data: out, error: r.error };
          const rows = r.data ?? [];
          out.push(...rows);
          if (rows.length < page) { done = true; break; }
        }
        start += starts.length * page;
      }
      return { data: out, error: null };
    };

    const withTenant = (q: any) => (tenantId ? q.eq('tenant_id', tenantId) : q);
    const [inv, rec, unp] = await Promise.all([
      fetchAllPages(() => withTenant((supabase.from('zoho_invoices') as any).select(`${cols}, is_mietkauf, is_deposit, deposit_id`).in('accounting_region', String(region) === 'ALL' ? ['EU','CH'] : [region]).eq('is_mietkauf', mietkaufOnly))),
      fetchAllPages(() => withTenant((supabase.from('zoho_recurring_invoices') as any).select(`${cols}, is_mietkauf, is_deposit, deposit_id`).eq('is_mietkauf', mietkaufOnly))),
      includeUnpaid && !mietkaufOnly
        ? fetchAllPages(() => (supabase.from('zoho_unpaid_invoices') as any)
            .select('id, created_at, invoice_id, invoice_number, customer_name, invoice_date, due_date, total, balance, currency_code, status, raw_customer_id:raw->customer_id'))
        : Promise.resolve({ data: [], error: null } as any),
    ]);


    if (inv.error || rec.error) {
      if (showError) {
        setError(inv.error?.message || rec.error?.message || 'Fehler beim Laden');
        setRows([]);
      }
    } else {
      const isChCurrency = (c?: string | null) => (c ?? '').toUpperCase() === 'CHF';
      const knownNumbers = new Set<string>([
        ...(inv.data ?? []).map((r: any) => String(r.invoice_number ?? '')),
        ...(rec.data ?? []).map((r: any) => String(r.invoice_number ?? '')),
      ]);
      const unpaidRows: Row[] = (unp?.data ?? [])
        .filter((r: any) => !knownNumbers.has(String(r.invoice_number ?? '')))
        .filter((r: any) => (String(region) === 'ALL' ? true : region === 'CH' ? isChCurrency(r.currency_code) : !isChCurrency(r.currency_code)))
        .map((r: any) => {
          const st = String(r.status ?? '').toLowerCase();
          const paymentStatus = st === 'overdue' ? 'Überfällig' : st === 'partially_paid' ? 'Teilweise bezahlt' : 'Offen';
          return {
            id: r.id,
            source: 'unpaid' as const,
            zoho_invoice_id: r.invoice_id ?? null,
            source_system: null,
            invoice_number: r.invoice_number ?? null,
            reference_number: null,
            customer_id: (r.raw_customer_id ? String(r.raw_customer_id) : null),
            customer_name: r.customer_name ?? null,
            city: null,
            invoice_date: r.invoice_date ?? null,
            due_date: r.due_date ?? null,
            total: r.total ?? null,
            balance: r.balance ?? null,
            currency: r.currency_code ?? 'EUR',
            status: r.status ?? null,
            payment_status: paymentStatus,
            last_payment_date: null,
            is_mietkauf: false,
            created_at: (r as any).created_at ?? null,
          } as Row;
        });
      const mergedRaw: Row[] = [
        ...(inv.data ?? []).map((r: any) => ({ ...r, source: 'invoice' as const })),
        ...(rec.data ?? [])
          .filter((r: any) => (String(region) === 'ALL' ? true : region === 'CH' ? isChCurrency(r.currency) : !isChCurrency(r.currency)))
          .map((r: any) => ({ ...r, source: 'recurring' as const })),
        ...unpaidRows,
      ];
      // Quellenübergreifende Deduplizierung: gleiche Rechnungsnummer nur einmal.
      // Priorität: invoice (regulärer Sync) > recurring > unpaid
      const prio: Record<string, number> = { invoice: 0, recurring: 1, unpaid: 2 };
      const byNumber = new Map<string, Row>();
      const merged: Row[] = [];
      for (const r of mergedRaw) {
        const key = (r.invoice_number ?? '').trim().toLowerCase();
        if (!key) { merged.push(r); continue; }
        const existing = byNumber.get(key);
        if (!existing) { byNumber.set(key, r); continue; }
        if (prio[r.source] < prio[existing.source]) byNumber.set(key, r);
      }
      merged.push(...byNumber.values());
      ROWS_CACHE.set(cacheKey, { ts: Date.now(), rows: merged });
      setRows(merged);

    }

    setLoading(false);
  };


  const [mietkaufBusyId, setMietkaufBusyId] = useState<string | null>(null);
  const toggleMietkauf = async (r: Row) => {
    if (r.source === 'unpaid') { toast({ title: 'Nur Ansicht', description: 'Diese Rechnung stammt aus den Offenen Posten und kann hier nicht bearbeitet werden.', variant: 'destructive' }); return; }
    const table = tableFor(r.source);
    const next = !r.is_mietkauf;
    setMietkaufBusyId(r.id);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from(table as any)
      .update({
        is_mietkauf: next,
        mietkauf_booked_at: next ? new Date().toISOString() : null,
        mietkauf_booked_by: next ? (auth?.user?.id ?? null) : null,
      } as any)
      .eq('id', r.id);
    setMietkaufBusyId(null);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    setRows((prev) => prev.filter((x) => !(x.id === r.id && x.source === r.source)));
    toast({
      title: next ? 'Nach „In Vermietung" verschoben' : 'Zurück zu Rechnungen',
      description: `Rechnung ${r.invoice_number ?? ''} wurde ${next ? 'als Mietkauf gebucht' : 'aus der Vermietung entfernt'}.`,
    });
  };

  // ---- „ist Anzahlung" (Rechnung zusätzlich in Offene Anzahlungen führen) ----
  const [depositBusyId, setDepositBusyId] = useState<string | null>(null);
  const toggleDeposit = async (r: Row) => {
    if (r.source === 'unpaid') {
      toast({ title: 'Nur Ansicht', description: 'Diese Rechnung stammt aus den Offenen Posten und kann hier nicht bearbeitet werden.', variant: 'destructive' });
      return;
    }
    const table = tableFor(r.source);
    const next = !r.is_deposit;
    setDepositBusyId(r.id);
    try {
      let depositId: string | null = r.deposit_id ?? null;

      if (next) {
        const gross = Number(r.total ?? 0) || 0;
        const paid = Math.max(0, gross - (Number(r.balance ?? gross) || 0));
        const isPaid = (Number(r.balance ?? 0) || 0) <= 0.009 && gross > 0;
        const payload: any = {
          source: 'rechnung',
          source_ref: `${table}:${r.id}`,
          deposit_number: r.invoice_number ?? null,
          customer_name: r.customer_name ?? null,
          company_name: r.customer_name ?? null,
          invoice_number: r.invoice_number ?? null,
          currency: r.currency ?? 'EUR',
          net_amount: 0,
          vat_amount: 0,
          gross_amount: gross,
          paid_amount: paid,
          open_amount: Math.max(0, gross - paid),
          issue_date: r.invoice_date ?? null,
          due_date: r.due_date ?? null,
          status: isPaid ? 'gebucht' : (paid > 0 ? 'teilweise' : 'offen'),
          accounting_region: (r.currency ?? '').toUpperCase() === 'CHF' ? 'CH' : 'EU',
          linked_invoice_table: table,
          linked_invoice_id: r.id,
          note: 'Aus Rechnungsliste als Anzahlung markiert',
        };
        if (depositId) {
          const { error } = await supabase.from('finance_deposits' as any).update(payload).eq('id', depositId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('finance_deposits' as any).insert(payload).select('id').single();
          if (error) throw error;
          depositId = (data as any)?.id ?? null;
        }
      } else if (depositId) {
        const { error } = await supabase.from('finance_deposits' as any).delete().eq('id', depositId);
        if (error) throw error;
        depositId = null;
      }

      const { error: upErr } = await supabase
        .from(table as any)
        .update({ is_deposit: next, deposit_id: depositId } as any)
        .eq('id', r.id);
      if (upErr) throw upErr;

      setRows((prev) => prev.map((x) =>
        x.id === r.id && x.source === r.source ? { ...x, is_deposit: next, deposit_id: depositId } : x,
      ));
      toast({
        title: next ? 'Als Anzahlung markiert' : 'Anzahlungs-Markierung entfernt',
        description: next
          ? `Rechnung ${r.invoice_number ?? ''} erscheint jetzt zusätzlich unter Offene Anzahlungen.`
          : `Rechnung ${r.invoice_number ?? ''} wird nicht mehr in Offene Anzahlungen geführt.`,
      });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Unbekannt', variant: 'destructive' });
    } finally {
      setDepositBusyId(null);
    }
  };



  // ---- Mehrfachauswahl (Rechnungsliste) ----
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState('');
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const bulkMietkauf = async () => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    const next = !mietkaufOnly;
    const { data: auth } = await supabase.auth.getUser();
    const patch = {
      is_mietkauf: next,
      mietkauf_booked_at: next ? new Date().toISOString() : null,
      mietkauf_booked_by: next ? (auth?.user?.id ?? null) : null,
    } as any;
    const invIds = rows.filter((x) => x.source === 'invoice' && selectedIds.includes(x.id)).map((x) => x.id);
    const recIds = rows.filter((x) => x.source === 'recurring' && selectedIds.includes(x.id)).map((x) => x.id);
    const results = await Promise.all([
      invIds.length ? supabase.from('zoho_invoices').update(patch).in('id', invIds) : Promise.resolve({ error: null } as any),
      recIds.length ? supabase.from('zoho_recurring_invoices' as any).update(patch).in('id', recIds) : Promise.resolve({ error: null } as any),
    ]);
    setBulkBusy(false);
    const err = results.find((x: any) => x.error)?.error;
    if (err) {
      toast({ title: 'Fehler', description: err.message, variant: 'destructive' });
      return;
    }
    const count = selectedIds.length;
    setRows((prev) => prev.filter((x) => !selectedIds.includes(x.id)));
    setSelectedIds([]);
    toast({
      title: next ? 'Nach „In Vermietung" verschoben' : 'Zurück zu Rechnungen',
      description: `${count} Rechnung(en) ${next ? 'als MietKauf gebucht' : 'aus der Vermietung entfernt'}.`,
    });
  };

  // ---- Ausgewählte an Mahn-Engine übergeben ----
  const [dunningBusy, setDunningBusy] = useState(false);
  const runDunningEngine = async () => {
    const ids = Array.from(
      new Set(
        rows
          .filter((x) => selectedIds.includes(x.id) && x.customer_id)
          .map((x) => String(x.customer_id)),
      ),
    );
    if (ids.length === 0) {
      toast({ title: 'Keine Kundenzuordnung', description: 'Für die markierten Rechnungen ist kein Kundenkonto hinterlegt.', variant: 'destructive' });
      return;
    }
    if (!confirm(`Mahn-Engine für ${ids.length} Kundenkonto(en) starten?\n\nEs werden nur Mahn-ENTWÜRFE erzeugt – kein automatischer Versand.`)) return;
    setDunningBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('finance-reminder-engine', {
        body: { customer_ids: ids },
      });
      if (error) throw error;
      const created = (data as any)?.created ?? (data as any)?.drafts_created ?? 0;
      const skipped = (data as any)?.skipped ?? 0;
      toast({
        title: 'Mahn-Engine ausgeführt',
        description: `${created} Entwurf/Entwürfe erstellt${skipped ? `, ${skipped} übersprungen` : ''}. Versand unter Buchhaltung → Mahnwesen.`,
      });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message ?? 'Mahn-Engine fehlgeschlagen', variant: 'destructive' });
    } finally {
      setDunningBusy(false);
    }
  };


  useEffect(() => { fetchRows(); }, [region, mietkaufOnly, includeUnpaid, tenantId]);



  // Realtime: aktualisiert Offene Beträge live – stark entzerrt, damit
  // Massen-Updates (z. B. Zoho-Sync) keine Refetch-Lawine auslösen.
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let pending = false;
    const run = () => {
      pending = false;
      if (document.hidden) { pending = true; return; }
      fetchRows({ silent: true });
    };
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(run, 20000);
    };
    const onVisible = () => { if (!document.hidden && pending) run(); };
    document.addEventListener('visibilitychange', onVisible);
    const channel = supabase
      .channel('invoices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zoho_invoices' }, trigger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zoho_recurring_invoices' }, trigger)
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  // Mietkauf-Geräte-Summen je Kundenkonto – nur in der Kontenansicht nötig,
  // Ergebnis wird modulweit zwischengespeichert (spart 2 Großabfragen pro Wechsel).
  const [mietkaufTotals, setMietkaufTotals] = useState<Record<string, number>>(
    () => MK_CACHE.get(tenantId ?? 'all')?.map ?? {},
  );
  useEffect(() => {
    if (!isAccountView) return;
    const key = tenantId ?? 'all';
    const cached = MK_CACHE.get(key);
    if (cached && Date.now() - cached.ts < MK_CACHE_TTL) { setMietkaufTotals(cached.map); return; }
    let cancelled = false;
    (async () => {
      const sel = 'customer_id, customer_name, total';
      const withTenant = (q: any) => (tenantId ? q.eq('tenant_id', tenantId) : q);
      const [a, b] = await Promise.all([
        withTenant((supabase.from('zoho_invoices') as any).select(sel).eq('is_mietkauf', true)).limit(5000),
        withTenant((supabase.from('zoho_recurring_invoices') as any).select(sel).eq('is_mietkauf', true)).limit(5000),
      ]);
      if (cancelled) return;
      const map: Record<string, number> = {};
      for (const r of [...(a.data ?? []), ...(b.data ?? [])]) {
        const k = r.customer_id || `name:${String(r.customer_name ?? 'Unbekannt').toLowerCase()}`;
        map[k] = (map[k] ?? 0) + Number(r.total ?? 0);
      }
      MK_CACHE.set(key, { ts: Date.now(), map });
      setMietkaufTotals(map);
    })();
    return () => { cancelled = true; };
  }, [tenantId, isAccountView]);



  // "Anwalt"/"Inkasso Intern"/"Überfällig" sind kombinierbare Filter
  const scopedRows = useMemo<Row[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const isPaid = (r: Row) => {
      const ps = String(r.payment_status || r.status || '').toLowerCase();
      return ps.includes('bezahlt') && !ps.includes('teilweise') && !ps.includes('unbezahlt') && !ps.includes('nicht');
    };
    let res =
      extra.anwalt || extra.inkasso || docStatusFilter === 'anwalt' || docStatusFilter === 'inkasso'
        ? rows.filter(
            (r) =>
              ((extra.anwalt || docStatusFilter === 'anwalt') && isAnwaltRow(r)) ||
              ((extra.inkasso || docStatusFilter === 'inkasso') && isInkassoRow(r)),
          )
        : rows.filter((r) => !isAnwaltRow(r) && !isInkassoRow(r));
    if (extra.overdue) {
      res = res.filter((r) => !isPaid(r) && Number(r.balance ?? 0) > 0 && !!r.due_date && String(r.due_date) < today);
    }
    if (dateFrom || dateTo) {
      res = res.filter((r) => matchesDateRange(r));
    }
    return res;
  }, [rows, extra, dateFrom, dateTo, docStatusFilter]);



  const accounts = useMemo<Account[]>(() => {
    let res = scopedRows;
    if (statusFilter !== 'all') {
      res = res.filter((r) => matchesPayStatus(r, statusFilter));
    }
    res = res.filter((r) => matchesDocStatus(r, docStatusFilter));
    res = dSearch.trim() ? res.filter((r) => matchesQuery(r, dSearch)) : res;

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
      // Nur gestellte/festgeschriebene Rechnungen (kein Entwurf, kein Storno)
      if (matchesDocStatus(r, 'sent')) {
        const d = String(r.invoice_date ?? r.created_at ?? '');
        if (d && (!acc.lastFinalizedDate || d > acc.lastFinalizedDate)) acc.lastFinalizedDate = d;
      }
    }
    const accs = Array.from(map.values());
    const rowKey = (r: Row) =>
      `${String(matchesDocStatus(r, 'sent') ? 1 : 0)}|${String(r.invoice_date ?? r.created_at ?? '')}`;
    for (const a of accs) {
      // Innerhalb des Kontos: gestellte/festgeschriebene Rechnungen zuerst, neueste oben
      a.rows.sort((x, y) => rowKey(y).localeCompare(rowKey(x)));
    }
    // Konten-Sortierung: neueste gestellte/festgeschriebene Rechnung zuerst (absteigend)
    return accs.sort((a, b) =>
      String(b.lastFinalizedDate ?? b.lastInvoiceDate ?? '').localeCompare(
        String(a.lastFinalizedDate ?? a.lastInvoiceDate ?? ''),
      ),
    );
  }, [scopedRows, dSearch, statusFilter, docStatusFilter]);

  const kpi = useMemo(() => ({
    accounts: accounts.length,
    invoices: accounts.reduce((s, a) => s + a.totalInvoices + a.totalRecurring, 0),
    totalAmount: accounts.reduce((s, a) => s + a.totalAmount, 0),
    // Offene Beträge = Live-Summe der Salden aller aktuell sichtbaren Rechnungen
    totalOpen: flatRowsForKpi(scopedRows, dSearch, statusFilter, docStatusFilter),
    // OP Total = Summe aller Konten (Mietkauf-Geräte-Volumen minus geleistete Zahlungen)
    opTotal: accounts.reduce((s, a) => {
      const mk = Number(mietkaufTotals[a.key] ?? 0);
      if (mk <= 0) return s;
      const paid = a.rows.reduce((p, r) => p + (Number(r.total ?? 0) - Number(r.balance ?? 0)), 0);
      return s + (mk - paid);
    }, 0),
  }), [accounts, scopedRows, dSearch, statusFilter, docStatusFilter, mietkaufTotals]);

  // ---- Spaltensortierung (Klick auf Spaltenkopf) ----
  type SortKey = 'status' | 'invoice_number' | 'customer_name' | 'reference_number' | 'invoice_date' | 'due_date' | 'total' | 'balance';
  const [colSort, setColSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);
  const toggleColSort = (key: SortKey) =>
    setColSort((prev) =>
      prev?.key !== key ? { key, dir: 'asc' } : prev.dir === 'asc' ? { key, dir: 'desc' } : null,
    );


  const flatRows = useMemo<Row[]>(() => {
    let res = scopedRows;
    if (statusFilter !== 'all') {
      res = res.filter((r) => matchesPayStatus(r, statusFilter));
    }
    res = res.filter((r) => matchesDocStatus(r, docStatusFilter));
    res = dSearch.trim() ? res.filter((r) => matchesQuery(r, dSearch)) : res;



    if (colSort) {
      const dir = colSort.dir === 'asc' ? 1 : -1;
      const num = (v: any) => Number(v ?? 0);
      const str = (v: any) => String(v ?? '');
      const cmp = (a: Row, b: Row) => {
        switch (colSort.key) {
          case 'status': return str(a.payment_status || a.status).localeCompare(str(b.payment_status || b.status), 'de');
          case 'invoice_number': return str(a.invoice_number).localeCompare(str(b.invoice_number), 'de', { numeric: true });
          case 'customer_name': return str(a.customer_name).localeCompare(str(b.customer_name), 'de', { sensitivity: 'base' });
          case 'reference_number': return str(a.reference_number).localeCompare(str(b.reference_number), 'de', { numeric: true });
          case 'invoice_date': return str(a.invoice_date).localeCompare(str(b.invoice_date));
          case 'due_date': return str(a.due_date).localeCompare(str(b.due_date));
          case 'total': return num(a.total) - num(b.total);
          case 'balance': return num(a.balance) - num(b.balance);
          default: return 0;
        }
      };
      return [...res].sort((a, b) => cmp(a, b) * dir);
    }
    const sorted = [...res].sort((a, b) => {
      if (extra.overdue && viewMode !== 'newest') {
        // Am längsten überfällig zuerst
        return String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999'));
      }
      if (viewMode === 'newest') {
        // Neueste zuerst nach Erfassungsdatum (created_at), Fallback Rechnungsdatum
        const av = String(a.created_at ?? a.invoice_date ?? '');
        const bv = String(b.created_at ?? b.invoice_date ?? '');
        return bv.localeCompare(av);
      }
      if (viewMode === 'oldest') {
        // Älteste Rechnungen zuerst
        return String(a.invoice_date ?? '9999').localeCompare(String(b.invoice_date ?? '9999'));
      }
      if (listSort === 'status') {
        const d = statusRank(a) - statusRank(b);
        if (d !== 0) return d;
        return String(b.invoice_date ?? '').localeCompare(String(a.invoice_date ?? ''));
      }
      if (listSort === 'number') {
        return String(b.invoice_number ?? '').localeCompare(String(a.invoice_number ?? ''), 'de', { numeric: true });
      }

      return String(b.invoice_date ?? '').localeCompare(String(a.invoice_date ?? ''));
    });
    return sorted;
  }, [scopedRows, dSearch, statusFilter, docStatusFilter, listSort, viewMode, extra, colSort]);


  // ---- Mahn-/E-Mail-Status je Rechnung (zweite Zeile unter dem Kundennamen) ----
  type RowMeta = { mails: number; opened: number; lastSent: string | null; level: number | null; reminderSent: string | null };
  const [rowMeta, setRowMeta] = useState<Record<string, RowMeta>>({});
  const visibleRows = useMemo(() => paginate(flatRows, pageSize), [flatRows, pageSize]);
  const metaKeys = useMemo(() => {
    const numbers = Array.from(new Set(visibleRows.map((r) => r.invoice_number).filter(Boolean) as string[])).slice(0, 60);
    const names = Array.from(new Set(visibleRows.map((r) => r.customer_name).filter(Boolean) as string[])).slice(0, 60);
    return { numbers, names, sig: `${numbers.join('|')}#${names.join('|')}` };
  }, [visibleRows]);

  useEffect(() => {
    let cancelled = false;
    const { numbers, names } = metaKeys;
    if (!numbers.length) { setRowMeta({}); return; }
    (async () => {
      try {
        const [mailsRes, remsRes] = await Promise.all([
          supabase
            .from('mail_messages')
            .select('subject, sent_at, opened_at, status')
            .or(numbers.map((n) => `subject.ilike.%${n}%`).join(','))
            .limit(500),
          names.length
            ? supabase.from('finance_reminders' as any).select('customer_name, level, status, sent_at').in('customer_name', names).limit(500)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        if (cancelled) return;
        const byNumber: Record<string, RowMeta> = {};
        for (const n of numbers) byNumber[n] = { mails: 0, opened: 0, lastSent: null, level: null, reminderSent: null };
        for (const m of (mailsRes.data ?? []) as any[]) {
          const subj = String(m.subject ?? '');
          for (const n of numbers) {
            if (!subj.toLowerCase().includes(n.toLowerCase())) continue;
            const e = byNumber[n];
            e.mails += 1;
            if (m.opened_at) e.opened += 1;
            const s = m.sent_at ?? null;
            if (s && (!e.lastSent || s > e.lastSent)) e.lastSent = s;
          }
        }
        const byName: Record<string, { level: number | null; sent: string | null }> = {};
        for (const r of ((remsRes as any).data ?? []) as any[]) {
          const k = String(r.customer_name ?? '').toLowerCase();
          const cur = byName[k] ?? { level: null, sent: null };
          if (r.level != null && (cur.level == null || Number(r.level) > cur.level)) cur.level = Number(r.level);
          if (r.sent_at && (!cur.sent || r.sent_at > cur.sent)) cur.sent = r.sent_at;
          byName[k] = cur;
        }
        for (const r of visibleRows) {
          const n = r.invoice_number;
          if (!n || !byNumber[n]) continue;
          const nm = byName[String(r.customer_name ?? '').toLowerCase()];
          if (nm) { byNumber[n].level = nm.level; byNumber[n].reminderSent = nm.sent; }
        }
        setRowMeta(byNumber);
      } catch {
        /* Status ist optional */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaKeys.sig]);



  // Kundenkonten für die Anzeige: "Höchste" = höchstes Rechnungsvolumen zuerst,
  // "Älteste OP" = nur offene Posten, Konten nach ältester offener Rechnung
  const displayAccounts = useMemo<Account[]>(() => {
    // Leere Ordner (Kundenkonten ohne passende Rechnungen) werden entfernt
    const base = accounts.filter((a) => a.rows.length > 0);
    if (viewMode === 'highest') return [...base].sort((a, b) => b.totalAmount - a.totalAmount);
    if (viewMode === 'oldest') {
      const withOpen = base
        .map((a) => {
          const openRows = a.rows.filter((r) => Number(r.balance ?? 0) > 0);
          if (openRows.length === 0) return null;
          const sorted = [...openRows].sort((x, y) =>
            String(x.invoice_date ?? '9999').localeCompare(String(y.invoice_date ?? '9999')),
          );
          return {
            ...a,
            rows: sorted,
            totalInvoices: sorted.filter((r) => r.source === 'invoice').length,
            totalRecurring: sorted.filter((r) => r.source !== 'invoice').length,
            totalAmount: sorted.reduce((s, r) => s + Number(r.total ?? 0), 0),
            totalOpen: sorted.reduce((s, r) => s + Number(r.balance ?? 0), 0),
            oldestOpenDate: sorted[0]?.invoice_date ?? null,
          } as Account & { oldestOpenDate: string | null };
        })
        .filter(Boolean) as (Account & { oldestOpenDate: string | null })[];
      return withOpen.sort((a, b) =>
        String(a.oldestOpenDate ?? '9999').localeCompare(String(b.oldestOpenDate ?? '9999')),
      );
    }
    if (listSort === 'status') {
      // Konten nach "dringendstem" Status ihrer Rechnungen gruppieren
      return [...base]
        .map((a) => ({ ...a, rows: [...a.rows].sort((x, y) => statusRank(x) - statusRank(y)) }))
        .sort((a, b) => statusRank(a.rows[0]) - statusRank(b.rows[0]));
    }
    return base;
  }, [accounts, viewMode, listSort]);



  // Regionsübergreifende Fallback-Suche: findet Rechnungen aus anderer Region / Mietkauf-Ansicht
  const [globalHits, setGlobalHits] = useState<any[]>([]);
  useEffect(() => {
    const q = search.trim();
    if (q.length < 3 || flatRows.length > 0) { setGlobalHits([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const { data } = await (supabase.from('zoho_invoices') as any)
        .select('id, invoice_number, customer_name, invoice_date, total, balance, status, accounting_region, is_mietkauf, reference_number')
        .or(`invoice_number.ilike.${like},customer_name.ilike.${like},reference_number.ilike.${like}`)
        .limit(25);
      if (!cancelled) setGlobalHits(data ?? []);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, flatRows.length]);




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

  const handleDelete = async (r: Row) => {
    if (!isSuperAdmin) return;
    if (r.source === 'unpaid') { toast({ title: 'Nicht möglich', description: 'Offene-Posten-Rechnungen werden in den Offenen Posten verwaltet.', variant: 'destructive' }); return; }
    if (!confirm(`Rechnung ${r.invoice_number ?? ''} unwiderruflich löschen?`)) return;
    try {
      const table = tableFor(r.source);
      const { error } = await supabase.from(table).delete().eq('id', r.id);
      if (error) throw error;
      toast({ title: 'Gelöscht', description: `Rechnung ${r.invoice_number ?? ''} gelöscht.` });
      setRows((prev) => prev.filter((x) => !(x.id === r.id && x.source === r.source)));
    } catch (e: any) {
      toast({ title: 'Löschen fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    }
  };



  const generateInternalInvoicePdf = async (r: Row): Promise<Blob | null> => {
    const { data: full, error } = await supabase
      .from('zoho_invoices')
      .select('*')
      .eq('id', r.id)
      .maybeSingle();
    if (error || !full) {
      toast({ title: 'PDF fehlgeschlagen', description: error?.message ?? 'Rechnung nicht gefunden', variant: 'destructive' });
      return null;
    }
    // Optional Kunde nachladen für Adresse
    let customer: any = null;
    if (full.customer_id) {
      const { data: c } = await supabase.from('customers').select('*').eq('external_customer_id', full.customer_id).maybeSingle();
      customer = c;
    }
    const raw: any = full.raw_data ?? {};
    const cur = full.currency || 'EUR';
    const money = (n: number) =>
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: cur }).format(Number(n) || 0);

    const doc = createPDF({ unit: 'mm', format: 'a4' });
    const PAGE_W = 210, PAGE_H = 297;
    const LEFT = 30, RIGHT = 195;
    const CONTENT_W = RIGHT - LEFT;
    const TOP_CONTENT = 55, BOTTOM_LIMIT = 265;
    const templateUrl = await loadTemplate();
    const logoUrl = await loadLogo();
    const LOGO_W = 45 * 1.2;
    const LOGO_H = LOGO_W / (1920 / 360);
    const LOGO_X = RIGHT - LOGO_W;
    const LOGO_Y = 12;
    const drawTemplate = () => {
      doc.addImage(templateUrl, 'JPEG', 0, 0, PAGE_W, PAGE_H, undefined, 'FAST');
      doc.addImage(logoUrl, 'PNG', LOGO_X, LOGO_Y, LOGO_W, LOGO_H, undefined, 'FAST');
    };
    drawTemplate();

    // Titel
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20, 60, 110);
    doc.text('Rechnung', LEFT, TOP_CONTENT);

    // Meta rechts
    const metaX = 130;
    let metaY = TOP_CONTENT;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const meta: Array<[string, string]> = [
      ['Rechnungsnr.', full.invoice_number || '—'],
      ['Rechnungsdatum', fmtDate(full.invoice_date)],
      ['Fällig am', fmtDate(full.due_date)],
    ];
    if (full.reference_number) meta.push(['Auftragsnr.', String(full.reference_number)]);
    for (const [k, v] of meta) {
      doc.setFont('helvetica', 'bold'); doc.text(k, metaX, metaY);
      doc.setFont('helvetica', 'normal'); doc.text(v, metaX + 32, metaY);
      metaY += 5;
    }

    // Rechnungsadresse
    const ay = TOP_CONTENT + 12;
    const billing = customer?.billing_address || customer?.shipping_address || (full as any).billing_address || null;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 60, 110);
    doc.text('Rechnungsadresse', LEFT, ay);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    let y = ay + 5;
    const name = customer?.company_name || customer?.contact_name || full.customer_name;
    if (name) { doc.text(String(name), LEFT, y); y += 4.4; }
    const addressLines = addrLinesFromObj(billing);
    if (addressLines.length === 0 && billing && typeof billing === 'string') {
      String(billing).split('\n').forEach((l) => { if (l && l !== name) { doc.text(l, LEFT, y); y += 4.4; } });
    } else {
      addressLines.forEach((l) => { doc.text(l, LEFT, y); y += 4.4; });
    }

    if (customer?.email) { doc.text(String(customer.email), LEFT, y); y += 4.4; }
    let cy = y + 6;

    // Einleitung
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const intro = raw.intro || 'Vielen Dank für Ihr Vertrauen. Wir stellen Ihnen die folgenden Leistungen in Rechnung.';
    const introWrapped = doc.splitTextToSize(String(intro), CONTENT_W);
    doc.text(introWrapped, LEFT, cy);
    cy += introWrapped.length * 4.4 + 4;

    // Positionen
    const items: any[] = Array.isArray(raw.line_items) && raw.line_items.length
      ? raw.line_items
      : [{ name: `Auftrag ${full.reference_number ?? ''}`.trim() || 'Rechnungsposition', description: '', quantity: 1, rate: Number(full.total ?? 0), amount: Number(full.total ?? 0) }];

    const taxRate = Number(raw.tax_rate ?? 0);
    const subtotal = Number(raw.subtotal ?? items.reduce((s, it) => s + (Number(it.amount ?? Number(it.quantity ?? 0) * Number(it.rate ?? 0))), 0));
    const taxAmount = Number(raw.tax_amount ?? subtotal * taxRate / 100);
    const total = Number(full.total ?? subtotal + taxAmount);

    autoTable(doc, {
      startY: cy,
      margin: { left: LEFT, right: PAGE_W - RIGHT, top: TOP_CONTENT, bottom: PAGE_H - BOTTOM_LIMIT },
      head: [['Pos', 'Beschreibung', 'Menge', 'Einzelpreis netto', 'MwSt', 'Summe netto']],
      body: items.map((it, i) => [
        i + 1,
        [it.name, it.description].filter(Boolean).join('\n'),
        String(it.quantity ?? 1),
        money(Number(it.rate ?? 0)),
        `${taxRate}%`,
        money(Number(it.amount ?? Number(it.quantity ?? 0) * Number(it.rate ?? 0))),
      ]),
      styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
      headStyles: { fillColor: [183, 217, 255], textColor: [20, 60, 110] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { halign: 'right', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 16 },
        5: { halign: 'right', cellWidth: 30 },
      },
      willDrawPage: () => {
        const pageNo = (doc as any).internal.getCurrentPageInfo().pageNumber;
        if (pageNo > 1) drawTemplate();
      },
    });
    let finalY = (doc as any).lastAutoTable.finalY + 8;

    // Totals
    const totalsLabelX = 110;
    const totalsValueX = RIGHT;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('Netto:', totalsLabelX, finalY);
    doc.text(money(subtotal), totalsValueX, finalY, { align: 'right' });
    doc.text(`MwSt (${taxRate}%):`, totalsLabelX, finalY + 5);
    doc.text(money(taxAmount), totalsValueX, finalY + 5, { align: 'right' });
    doc.setDrawColor(20, 60, 110);
    doc.line(totalsLabelX, finalY + 8, totalsValueX, finalY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 60, 110);
    doc.text('Rechnungsbetrag (brutto):', totalsLabelX, finalY + 14);
    doc.text(money(total), totalsValueX, finalY + 14, { align: 'right' });

    // Zahlungshinweis
    let py = finalY + 26;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 60, 110);
    doc.text('Zahlungshinweis', LEFT, py);
    py += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const hint = `Bitte überweisen Sie den Rechnungsbetrag von ${money(total)} bis zum ${fmtDate(full.due_date)} unter Angabe der Rechnungsnummer ${full.invoice_number}.`;
    const hintWrapped = doc.splitTextToSize(hint, CONTENT_W);
    doc.text(hintWrapped, LEFT, py);
    py += hintWrapped.length * 4.6 + 6;

    if (raw.notes) {
      doc.setFont('helvetica', 'bold'); doc.text('Notiz', LEFT, py); py += 5;
      doc.setFont('helvetica', 'normal');
      const nWrap = doc.splitTextToSize(String(raw.notes), CONTENT_W);
      doc.text(nWrap, LEFT, py); py += nWrap.length * 4.6 + 6;
    }

    // Sign-off
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(20, 60, 110);
    doc.text('Mit freundlichen Grüßen', LEFT, py); py += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(full.source_system === 'zoho_eu_2' ? 'Alix Lasers Austria' : 'Alix Lasers Deutschland', LEFT, py);
    py += 10;

    // Bankdaten
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 60, 110);
    doc.text('Bankverbindung', LEFT, py); py += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const bank: Array<[string, string]> = [
      ['Kontoinhaber', 'Alix Lasers GmbH'],
      ['Bank', 'Deutsche Bank'],
      ['IBAN', 'DE07 1007 0100 0142 6600 00'],
      ['SWIFT/BIC', 'DEUTDEBB101'],
    ];
    for (const [k, v] of bank) {
      doc.setFont('helvetica', 'bold'); doc.text(k + ':', LEFT, py);
      doc.setFont('helvetica', 'normal'); doc.text(v, LEFT + 28, py);
      py += 4.6;
    }

    // Seitenzahlen
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        doc.text(`Rechnung ${full.invoice_number}`, LEFT, TOP_CONTENT - 8);
        doc.setDrawColor(200, 200, 200);
        doc.line(LEFT, TOP_CONTENT - 5, RIGHT, TOP_CONTENT - 5);
      }
      // Impressum / Firmenangaben zentriert
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      const centerX = PAGE_W / 2;
      doc.text(
        'Alix Lasers GmbH  ·  Zeppelin Straße 3  ·  12529 Berlin- Schönefeld  ·  Deutschland  ·  Telefon: +49 30 577 127 45  ·  Fax: +49 30 577 127 46',
        centerX, PAGE_H - 16, { align: 'center' },
      );
      doc.text(
        'Vertreten durch die Geschäftsführerin: ABLM Management UG (haftungsbeschränkt)  ·  Registergericht: Amtsgericht Berlin-Charlottenburg',
        centerX, PAGE_H - 13, { align: 'center' },
      );
      doc.text(
        'Handelsregisternummer: HRB 245388  ·  Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE321691012',
        centerX, PAGE_H - 10, { align: 'center' },
      );

      doc.setFontSize(8);
      doc.text(
        `Rechnung ${full.invoice_number}  ·  Seite ${i} von ${totalPages}`,
        RIGHT, PAGE_H - 4, { align: 'right' },
      );
    }

    const rawBlob = doc.output('blob') as Blob;
    return await stampExistingPdfBlob(rawBlob, 'invoice', full.invoice_number, {
      customer_id: customer?.id ?? null,
      title: `Rechnung ${full.invoice_number}`,
    });
  };


  const isInternalInvoice = (r: Row) =>
    r.source_system === 'internal' || (r.zoho_invoice_id?.startsWith('manual-') ?? false);

  const fetchInvoicePdf = async (r: Row): Promise<Blob | null> => {
    if (!r.zoho_invoice_id) {
      toast({ title: 'Kein Verweis', description: 'Für diese Rechnung ist keine ID hinterlegt.', variant: 'destructive' });
      return null;
    }
    setPdfLoadingId(r.id);
    try {
      if (isInternalInvoice(r)) {
        return await generateInternalInvoicePdf(r);
      }
      const { data, error } = await supabase.functions.invoke('zoho-invoice-pdf', {
        body: {
          zoho_invoice_id: r.zoho_invoice_id,
          source_system: r.source_system ?? 'zoho_eu_1',
          recurring: r.source === 'recurring',
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const b64 = (data as any)?.pdf_base64;
      if (!b64) throw new Error('Kein PDF erhalten');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const rawBlob = new Blob([bytes], { type: 'application/pdf' });
      return await stampExistingPdfBlob(rawBlob, 'invoice', r.invoice_number ?? undefined, {
        title: `Rechnung ${r.invoice_number ?? ''}`.trim() || undefined,
      });
    } catch (e: any) {
      console.error('[Invoices] fetchInvoicePdf failed', e);
      toast({ title: 'PDF fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
      return null;
    } finally {
      setPdfLoadingId(null);
    }
  };


  const handlePrint = async (r: Row) => {
    const blob = await fetchInvoicePdf(r);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.addEventListener('load', () => { try { w.print(); } catch { /* noop */ } });
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handlePreview = async (r: Row) => {
    setPreviewRow(r);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    const blob = await fetchInvoicePdf(r);
    if (!blob) { setPreviewRow(null); return; }
    setPreviewUrl(URL.createObjectURL(blob));
  };

  const handleDownload = async (r: Row) => {
    const blob = await fetchInvoicePdf(r);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${r.invoice_number ?? 'rechnung'}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const openEdit = (r: Row) => {
    setEditRow(r);
    setEditForm({
      reference_number: r.reference_number ?? '',
      due_date: r.due_date ?? '',
      payment_status: r.payment_status ?? '',
      invoice_number: r.invoice_number ?? '',
      customer_name: r.customer_name ?? '',
      invoice_date: r.invoice_date ?? '',
      total: r.total != null ? String(r.total) : '',
      balance: r.balance != null ? String(r.balance) : '',
      status: isDraftInvoice(r) ? 'draft' : 'sent',
    });
  };

  const handleEditClick = (event: { preventDefault: () => void; stopPropagation: () => void }, r: Row) => {
    event.preventDefault();
    event.stopPropagation();
    openEdit(r);
  };

  // Lädt raw_data erst bei Bedarf nach (nicht mehr in der Listenabfrage enthalten).
  const loadRawData = async (r: Row): Promise<any> => {
    if (r.raw_data && typeof r.raw_data === 'object' && !Array.isArray(r.raw_data)) return r.raw_data;
    if (r.source === 'unpaid') return {};
    const table = tableFor(r.source);
    const { data } = await (supabase as any).from(table).select('raw_data').eq('id', r.id).maybeSingle();
    const raw = data?.raw_data;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  };

  const commitDraft = async (r: Row) => {
    if (!isDraftInvoice(r)) return;
    if (r.source === 'unpaid') return;
    try {
      const table = tableFor(r.source);
      const raw = await loadRawData(r);
      const patch: any = {
        status: 'sent',
        raw_data: { ...raw, is_draft: false },
      };
      const { error } = await (supabase as any).from(table).update(patch).eq('id', r.id);
      if (error) throw error;
      setRows((prev) => prev.map((x) => (x.id === r.id && x.source === r.source
        ? { ...x, status: 'sent', raw_data: patch.raw_data }
        : x)));
      toast({ title: 'Festgeschrieben', description: `Rechnung ${r.invoice_number ?? ''} wurde festgeschrieben.` });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (editRow.source === 'unpaid') { toast({ title: 'Nur Ansicht', description: 'Offene-Posten-Rechnungen sind hier schreibgeschützt.', variant: 'destructive' }); return; }
    setEditSaving(true);
    try {
      const wantsStorno = editForm.payment_status === 'Storniert' || editForm.status === 'void';
      if (wantsStorno) {
        const stornoPatch = await bookStorno(editRow);
        setRows((prev) => prev.map((x) => (x.id === editRow.id && x.source === editRow.source ? { ...x, ...stornoPatch } : x)));
        toast({ title: 'Rechnung storniert', description: `Offener Betrag ausgebucht (Storno) – ${editRow.invoice_number ?? ''}.` });
        setEditRow(null);
        return;
      }
      const table = tableFor(editRow.source);
      const patch: any = {
        reference_number: editForm.reference_number || null,
        due_date: editForm.due_date || null,
        payment_status: editForm.payment_status || null,
      };

      if (editForm.status) {
        patch.status = editForm.status;
        const raw = await loadRawData(editRow);
        patch.raw_data = { ...raw, is_draft: editForm.status === 'draft' };
      }
      if (isSuperAdmin) {
        patch.invoice_number = editForm.invoice_number || null;
        patch.customer_name = editForm.customer_name || null;
        patch.invoice_date = editForm.invoice_date || null;
        patch.total = editForm.total === '' ? null : Number(editForm.total);
        patch.balance = editForm.balance === '' ? null : Number(editForm.balance);
      }
      const { error } = await supabase.from(table).update(patch).eq('id', editRow.id);
      if (error) throw error;
      setRows((prev) => prev.map((x) => x.id === editRow.id && x.source === editRow.source ? { ...x, ...patch } : x));
      toast({ title: 'Gespeichert', description: `Rechnung ${editRow.invoice_number ?? ''} aktualisiert.` });
      setEditRow(null);
    } catch (e: any) {
      toast({ title: 'Speichern fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const openStatusDialog = (r: Row) => {
    setStatusForm({ payment_status: r.payment_status ?? '', status: isDraftInvoice(r) ? 'draft' : 'sent' });
    setStatusRow(r);
  };

  /**
   * Ermittelt die beschreibbare Rechnung. Offene-Posten-Zeilen ("unpaid") sind nur eine
   * Spiegelung – für Buchungen wird die echte Rechnung in zoho_invoices gesucht.
   */
  const resolveWritableTarget = async (r: Row): Promise<{ table: string; id: string } | null> => {
    if (r.source !== 'unpaid') return { table: tableFor(r.source), id: r.id };
    if (!r.invoice_number) return null;
    const { data } = await (supabase as any)
      .from('zoho_invoices')
      .select('id')
      .eq('invoice_number', r.invoice_number)
      .limit(1)
      .maybeSingle();
    return data?.id ? { table: 'zoho_invoices', id: data.id } : null;
  };

  /** Storniert eine Rechnung: schließt den offenen Betrag und bucht ihn als Storno aus. */
  const bookStorno = async (r: Row) => {
    const open = Number(r.balance ?? r.total ?? 0);
    const target = await resolveWritableTarget(r);
    if (!target) throw new Error('Zu dieser Offenen-Posten-Zeile existiert keine Rechnung in Zoho-Rechnungen.');
    const raw = await loadRawData(r);
    const patch: any = {
      payment_status: 'Storniert',
      status: 'void',
      balance: 0,
      raw_data: { ...raw, is_draft: false, is_void: true, storno_at: new Date().toISOString(), storno_amount: open },
    };
    const { error } = await (supabase as any).from(target.table).update(patch).eq('id', target.id);
    if (error) throw error;
    if (r.source === 'unpaid') {
      await (supabase as any).from('zoho_unpaid_invoices').update({ balance: 0, status: 'void' }).eq('id', r.id);
    }
    if (open !== 0) {
      await (supabase as any).from('finance_transactions').insert({
        amount: -Math.abs(open),
        currency: r.currency ?? 'EUR',
        booking_date: new Date().toISOString().slice(0, 10),
        reference: r.invoice_number ?? r.id,
        transaction_type: 'Storno',
        notes: `Storno Rechnung ${r.invoice_number ?? ''} – ${r.customer_name ?? ''}`.trim(),
        tenant_id: tenantId ?? null,
      });
    }
    return patch;
  };

  const saveStatus = async () => {
    if (!statusRow) return;
    const isStornoRequest = statusForm.status === 'void' || statusForm.payment_status === 'Storniert';
    if (statusRow.source === 'unpaid' && !isStornoRequest) {
      toast({ title: 'Nur Ansicht', description: 'Offene-Posten-Rechnungen sind hier schreibgeschützt.', variant: 'destructive' });
      return;
    }

    setStatusSaving(true);
    try {
      const isStorno = statusForm.status === 'void' || statusForm.payment_status === 'Storniert';
      if (isStorno) {
        const patch = await bookStorno(statusRow);
        setRows((prev) => prev.map((x) => (x.id === statusRow.id && x.source === statusRow.source ? { ...x, ...patch } : x)));
        toast({ title: 'Rechnung storniert', description: `Offener Betrag ausgebucht (Storno) – ${statusRow.invoice_number ?? ''}.` });
        setStatusRow(null);
        return;
      }
      const table = tableFor(statusRow.source);
      const patch: any = { payment_status: statusForm.payment_status || null };
      if (statusForm.status) {
        patch.status = statusForm.status;
        const raw = await loadRawData(statusRow);
        patch.raw_data = { ...raw, is_draft: statusForm.status === 'draft' };
      }
      const { error } = await (supabase as any).from(table).update(patch).eq('id', statusRow.id);
      if (error) throw error;
      setRows((prev) => prev.map((x) => (x.id === statusRow.id && x.source === statusRow.source ? { ...x, ...patch } : x)));
      toast({ title: 'Status geändert', description: `Rechnung ${statusRow.invoice_number ?? ''} aktualisiert.` });
      setStatusRow(null);
    } catch (e: any) {
      toast({ title: 'Statusänderung fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setStatusSaving(false);
    }
  };


  const saveBulkStatus = async () => {
    const targets = rows.filter((x) => selectedIds.includes(x.id) && (x.source !== 'unpaid' || bulkStatusValue === 'Storniert'));
    if (targets.length === 0 || !bulkStatusValue) return;
    setBulkStatusSaving(true);
    let ok = 0;
    let failed = 0;
    try {
      const isStorno = bulkStatusValue === 'Storniert';
      for (const t of targets) {
        if (isStorno) {
          try { await bookStorno(t); ok++; } catch { failed++; }
          continue;
        }
        const { error } = await (supabase as any)
          .from(tableFor(t.source))
          .update({ payment_status: bulkStatusValue })
          .eq('id', t.id);
        if (error) failed++; else ok++;
      }
      const ids = new Set(targets.map((t) => t.id));
      setRows((prev) => prev.map((x) => (ids.has(x.id)
        ? { ...x, payment_status: bulkStatusValue, ...(isStorno ? { status: 'void', balance: 0 } : {}) }
        : x)));
      toast({
        title: 'Status geändert',
        description: `${ok} Rechnung(en) auf „${bulkStatusValue}" gesetzt${failed ? `, ${failed} fehlgeschlagen` : ''}.`,
        variant: failed && !ok ? 'destructive' : undefined,
      });
      setBulkStatusOpen(false);
      setSelectedIds([]);
    } catch (e: any) {
      toast({ title: 'Statusänderung fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setBulkStatusSaving(false);
    }
  };



  const openEmail = async (r: Row) => {
    console.log('[Invoices] openEmail clicked', { id: r.id, invoice_number: r.invoice_number });
    setEmailPreparing(true);
    setEmailStatusAfter('');
    setEmailRow(r);
    setEmailForm({
      to_email: '',
      to_name: r.customer_name ?? '',
      bcc: '',
      subject: `Rechnung ${r.invoice_number ?? ''}`.trim(),
      body_text: `Sehr geehrte Kundin, sehr geehrter Kunde,\n\nbitte beachten Sie die beigefügte Anlage zu dieser E-Mail.\n\nLeider haben wir trotz unserer bisherigen Kontaktaufnahme erneut keine Rückmeldung und keinen Zahlungseingang von Ihnen erhalten.\n\nWir fordern Sie daher auf, den noch offenen Rechnungsbetrag unverzüglich zu begleichen, um weitere Maßnahmen und die damit verbundenen zusätzlichen Kosten zu vermeiden.\n\nSollten Sie die Zahlung zwischenzeitlich bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.\n\nMit freundlichen Grüßen\n\nAlix Lasers GmbH`,
    });
    try {
      let foundEmail: string | null = null;
      let foundName: string | null = null;

      // 1) Lookup über external_customer_id (+ source_system, falls vorhanden)
      if (r.customer_id) {
        let q = supabase
          .from('customers')
          .select('email, contact_name, company_name, source_system')
          .eq('external_customer_id', r.customer_id);
        if (r.source_system) q = q.eq('source_system', r.source_system);
        const { data: c } = await q.maybeSingle();
        if (c?.email) { foundEmail = c.email; foundName = c.company_name ?? c.contact_name ?? null; }
      }

      // 2) Fallback: Lookup über Firmenname
      if (!foundEmail && r.customer_name) {
        const { data: c2 } = await supabase
          .from('customers')
          .select('email, contact_name, company_name')
          .ilike('company_name', r.customer_name)
          .not('email', 'is', null)
          .limit(1)
          .maybeSingle();
        if (c2?.email) { foundEmail = c2.email; foundName = c2.company_name ?? c2.contact_name ?? null; }
      }

      // 3) Fallback: Email aus raw_data der Zoho-Rechnung
      if (!foundEmail) {
        const rd: any = await loadRawData(r);
        const rawEmail =
          rd.email ||
          rd.customer_email ||
          rd?.contact_persons?.[0]?.email ||
          rd?.billing_address?.email ||
          null;
        if (rawEmail && typeof rawEmail === 'string') foundEmail = rawEmail;
      }

      if (foundEmail) {
        setEmailForm((f) => ({
          ...f,
          to_email: foundEmail!,
          to_name: foundName ?? f.to_name,
        }));
      } else {
        console.warn('[Invoices] Keine Kunden-Email gefunden für', r.customer_name, r.customer_id);
      }

      // 4) Vertriebspartner (salesperson) aus verknüpftem Auftrag → user_profiles.email → BCC
      if (r.reference_number) {
        const { data: ord } = await supabase
          .from('orders')
          .select('salesperson_name')
          .or(`order_number.eq.${r.reference_number},internal_number.eq.${r.reference_number}`)
          .not('salesperson_name', 'is', null)
          .limit(1)
          .maybeSingle();
        const spName = (ord as any)?.salesperson_name?.trim();
        if (spName) {
          const { data: sp } = await supabase
            .from('user_profiles')
            .select('email')
            .ilike('full_name', spName)
            .maybeSingle();
          const spEmail = (sp as any)?.email;
          if (spEmail) {
            setEmailForm((f) => ({ ...f, bcc: spEmail }));
          }
        }
      }
    } catch (e) {
      console.error('[Invoices] openEmail error', e);
    } finally {
      setEmailPreparing(false);
    }
  };

  const sendEmail = async () => {
    if (!emailRow) return;
    if (!emailForm.to_email) {
      toast({ title: 'Empfänger fehlt', description: 'Bitte E-Mail-Adresse angeben.', variant: 'destructive' });
      return;
    }
    setEmailSending(true);
    try {
      const blob = await fetchInvoicePdf(emailRow);
      if (!blob) throw new Error('PDF konnte nicht erzeugt werden');
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const chunk = 0x2000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
      }
      const b64 = btoa(binary);
      const bccList = emailForm.bcc
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s.includes('@'));
      // zoho_invoices.customer_id ist eine Zoho-ID (numerisch) – mail_messages.customer_id erwartet UUID.
      const isUuid = (v: unknown) =>
        typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
      const { data, error } = await supabase.functions.invoke('send-mail', {
        body: {
          to_email: emailForm.to_email,
          to_name: emailForm.to_name || null,
          from_email: 'finance@alixwork.de',
          from_name: 'Alix Lasers | Finance',
          subject: emailForm.subject,
          body_text: emailForm.body_text,
          body_html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">${
            (emailForm.body_text || '')
              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
              .split(/\n{2,}/)
              .map((p) => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br/>')}</p>`)
              .join('')
          }</div>`,
          bcc: bccList.length ? bccList : null,
          customer_id: isUuid(emailRow.customer_id) ? emailRow.customer_id : null,
          attachments: [{
            filename: `${emailRow.invoice_number ?? 'rechnung'}.pdf`,
            content: b64,
            contentType: 'application/pdf',
          }],
        },
      });
      if (error) {
        const ctx: any = (error as any)?.context;
        let detail = error.message;
        try { if (ctx?.text) detail = await ctx.text(); } catch { /* noop */ }
        console.error('[Invoices] send-mail failed', detail);
        throw new Error(detail);
      }
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({ title: 'E-Mail versendet', description: `Rechnung ${emailRow.invoice_number ?? ''} an ${emailForm.to_email}` });

      if (emailStatusAfter) {
        if (emailRow.source === 'unpaid') {
          toast({ title: 'Status nicht geändert', description: 'Offene-Posten-Rechnungen sind schreibgeschützt.', variant: 'destructive' });
        } else {
          try {
            const table = tableFor(emailRow.source);
            const patch: any = { payment_status: emailStatusAfter };
            const { error: sErr } = await (supabase as any).from(table).update(patch).eq('id', emailRow.id);
            if (sErr) throw sErr;
            setRows((prev) => prev.map((x) => (x.id === emailRow.id && x.source === emailRow.source ? { ...x, ...patch } : x)));
            toast({ title: 'Status geändert', description: `Neuer Status: ${emailStatusAfter}` });
          } catch (se: any) {
            toast({ title: 'Statusänderung fehlgeschlagen', description: se?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
          }
        }
      }
      setEmailStatusAfter('');
      setEmailRow(null);

    } catch (e: any) {
      toast({ title: 'Versand fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setEmailSending(false);
    }
  };

  const handleImport = async (regionFilter: 'all' | 'EU' | 'CH' = 'all') => {
    setImporting(true);
    setProgress('Starte Import…');
    try {
      let page = 1;
      let totalImported = 0, totalUpdated = 0, totalFailed = 0, totalSkipped = 0, totalDuplicates = 0;
      let totalRegionSkipped = 0, totalCh = 0;
      for (let i = 0; i < 100; i++) {
        const { data, error } = await supabase.functions.invoke('sync-zoho-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: '2025-01-01', page, max_pages: 1, per_page: 100, exclude_profile_name: 'SEPA Ratenzahler', region_filter: regionFilter },
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
        totalDuplicates += data?.duplicates ?? 0;
        totalRegionSkipped += data?.skipped_region ?? 0;
        totalCh += data?.ch_count ?? 0;
        setProgress(`${regionFilter === 'all' ? '' : regionFilter + ' • '}Seite ${page} • Neu: ${totalImported} • Aktualisiert: ${totalUpdated} • Duplikate: ${totalDuplicates} • SEPA übersprungen: ${totalSkipped}`);
        if (!data?.has_more) break;
        page = (data?.last_page ?? page) + 1;
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast({
        title: 'Import abgeschlossen',
        description: `${regionFilter === 'CH' ? '🇨🇭 Nur Buchhaltung CH • ' : regionFilter === 'EU' ? 'Nur Buchhaltung EU • ' : ''}Neu: ${totalImported} • Aktualisiert: ${totalUpdated} • davon CH: ${totalCh} • Duplikate: ${totalDuplicates} • SEPA übersprungen: ${totalSkipped}${totalRegionSkipped ? ` • Andere Region übersprungen: ${totalRegionSkipped}` : ''} • Fehler: ${totalFailed}`,
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

  /** Öffnet den ALIX COLLECT Fall des Kundenkontos (sonst Command Center). */
  const openDunning = async (a: { customer_id?: string | null; customer_name?: string | null }) => {
    try {
      let caseId: string | null = null;
      if (a.customer_id) {
        const { data } = await supabase
          .from('collect_cases' as any)
          .select('id')
          .eq('customer_key', a.customer_id)
          .maybeSingle();
        caseId = (data as any)?.id ?? null;
      }
      if (!caseId && a.customer_name) {
        const { data } = await supabase
          .from('collect_cases' as any)
          .select('id')
          .ilike('customer_name', `%${a.customer_name}%`)
          .limit(1);
        caseId = (data as any)?.[0]?.id ?? null;
      }
      window.open(caseId ? `/finance/collect/${caseId}` : '/finance/collect', '_blank');
      if (!caseId) toast({ title: 'Kein Mahnfall gefunden', description: 'Command Center geöffnet.' });
    } catch (e: any) {
      toast({ title: 'Öffnen fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    }
  };


  const openBook = (r: Row) => {
    setBookRow(r);
    setBookMethod('Überweisung');
    setBookDate(new Date().toISOString().slice(0, 10));
    const open = Number(r.balance ?? r.total ?? 0);
    setBookAmount(open > 0 ? open.toFixed(2) : '0.00');
  };

  const handleBookClick = (event: React.MouseEvent<HTMLButtonElement>, r: Row) => {
    event.preventDefault();
    event.stopPropagation();
    openBook(r);
  };

  const submitBook = async () => {
    if (!bookRow) return;
    setBookSaving(true);
    try {
      const openBefore = Number(bookRow.balance ?? bookRow.total ?? 0);
      const pay = Math.max(0, Number(String(bookAmount).replace(',', '.')) || 0);
      if (pay <= 0) throw new Error('Bitte einen Zahlbetrag größer 0 eingeben.');
      const newBalance = Math.max(0, +(openBefore - pay).toFixed(2));
      const fullyPaid = newBalance <= 0.0049;
      if (bookRow.source === 'unpaid') throw new Error('Offene-Posten-Rechnungen können hier nicht gebucht werden.');
      const table = tableFor(bookRow.source);
      const patch: any = {
        payment_status: fullyPaid ? 'Bezahlt' : 'Teilweise bezahlt',
        balance: newBalance,
        last_payment_date: bookDate,
      };
      const { data: updated, error } = await (supabase as any).from(table).update(patch).eq('id', bookRow.id).select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('Buchung nicht gespeichert – keine Berechtigung zum Ändern dieser Rechnung (nur Admin/Super Admin).');
      }

      // Verknüpfte Anzahlung mitführen (verschwindet bei Vollzahlung aus „Offene Anzahlungen")
      if (bookRow.deposit_id) {
        const grossDep = Number(bookRow.total ?? 0) || 0;
        const paidDep = Math.max(0, +(grossDep - newBalance).toFixed(2));
        await supabase.from('finance_deposits' as any).update({
          paid_amount: paidDep,
          open_amount: Math.max(0, +(grossDep - paidDep).toFixed(2)),
          status: fullyPaid ? 'gebucht' : 'teilweise',
        } as any).eq('id', bookRow.deposit_id);
      }




      const gross = +pay.toFixed(2);
      const net = +(gross / 1.19).toFixed(2);
      const vat = +(gross - net).toFixed(2);
      const jr = await postPaymentToJournal({
        customer_id: bookRow.customer_id,
        invoice_number: bookRow.invoice_number,
        reference: bookRow.invoice_number,
        amount_gross: gross,
        amount_net: net,
        amount_vat: vat,
        booking_date: bookDate,
        description: `Zahlung Rechnung ${bookRow.invoice_number ?? ''} (${bookMethod})${fullyPaid ? '' : ' – Teilzahlung'} – ${bookRow.customer_name ?? ''}`.trim(),
        source_table: table,
        source_id: (globalThis.crypto?.randomUUID?.() ?? bookRow.id),
        vorgang: 'Zahlung',
        payment_method: bookMethod,
      });

      setRows((prev) => prev.map((x) => (x.id === bookRow.id && x.source === bookRow.source
        ? { ...x, payment_status: patch.payment_status, balance: newBalance, last_payment_date: bookDate }
        : x)));
      if (!jr.ok) {
        toast({ title: 'Rechnung gebucht – Journal fehlgeschlagen', description: jr.error || 'Journal-Buchung fehlgeschlagen', variant: 'destructive' });
      } else {
        toast({ title: 'Gebucht', description: `Zahlung ${fmtMoney(gross, bookRow.currency)} für Rechnung ${bookRow.invoice_number ?? ''} verbucht.${fullyPaid ? '' : ` Restsaldo: ${fmtMoney(newBalance, bookRow.currency)}`}` });
      }
      setBookRow(null);

    } catch (e: any) {
      toast({ title: 'Fehler', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBookSaving(false);
    }
  };


  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        icon={FileText}
        title={mietkaufOnly ? (isAccountView ? 'Mietkauf Geräte nach Kundenkonto' : 'Mietkauf Geräte – Rechnungsliste') : [
          (viewMode === 'highest' ? 'Höchste Kundenkonten' : viewMode === 'newest' ? 'Neuste Rechnungen' : viewMode === 'oldest' ? 'Älteste OP nach Kundenkonto' : viewMode === 'accounts' ? 'Rechnungen nach Kundenkonto' : 'Rechnungsliste'),
          [extra.overdue && 'Überfällig', extra.anwalt && 'Anwalt', extra.inkasso && 'Inkasso Intern'].filter(Boolean).join(' + '),
        ].filter(Boolean).join(' · ')}
        subtitle={mietkaufOnly ? 'Alle als Mietkauf Geräte gebuchten Vorgänge' : (viewMode === 'highest' ? 'Kundenkonten mit dem höchsten Rechnungsvolumen – absteigend' : viewMode === 'newest' ? 'Zuletzt erfasste Rechnungen zuerst' : viewMode === 'oldest' ? 'Offene Posten je Kundenkonto – älteste offene Rechnung zuerst' : viewMode === 'accounts' ? 'Konsolidierte Übersicht aller Zoho-Rechnungen (einmalig + periodisch) je Kunde' : 'Alle Rechnungen sortiert nach Datum oder Rechnungsnummer')}

        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${kpi.accounts} Konten`} pulse={loading} />}
        actions={
          isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={importing} className="gold-gradient text-primary-foreground">
                  <RefreshCw className={`w-4 h-4 mr-2 ${importing ? 'animate-spin' : ''}`} />
                  {importing ? 'Import läuft…' : 'Aus Zoho importieren'}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Import-Umfang</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleImport('all')}>Alle Rechnungen (EU + CH)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleImport('EU')}>Nur Buchhaltung EU</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleImport('CH')}>
                  🇨🇭 Nur „Ort: Alix Lasers ® Schweiz" (CH)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
        <DataCard className="p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Users className="w-3.5 h-3.5" />Kundenkonten</div>
          <div className="text-base font-semibold mt-0.5">{kpi.accounts}</div>
        </DataCard>
        <DataCard className="p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><FileText className="w-3.5 h-3.5" />Rechnungen gesamt</div>
          <div className="text-base font-semibold mt-0.5">{kpi.invoices}</div>
        </DataCard>
        <DataCard className="p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Wallet className="w-3.5 h-3.5" />Volumen</div>
          <div className="text-base font-semibold mt-0.5 tabular-nums">{fmtMoney(kpi.totalAmount)}</div>
        </DataCard>
        <DataCard className="p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><AlertTriangle className="w-3.5 h-3.5" />Offene Beträge</div>
          <div className="text-base font-semibold mt-0.5 tabular-nums text-amber-500">{fmtMoney(kpi.totalOpen)}</div>
        </DataCard>
        <DataCard className="p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Wallet className="w-3.5 h-3.5" />OP Total (alle Konten)</div>
          <div className={`text-base font-semibold mt-0.5 tabular-nums ${kpi.opTotal > 0 ? 'text-destructive' : 'text-emerald-400'}`}>{fmtMoney(kpi.opTotal)}</div>
        </DataCard>
      </div>



      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-secondary p-0.5 max-w-full">
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'accounts' ? 'default' : 'ghost'}
            className="h-8 px-3 gap-1.5"
            onClick={() => setViewModePersist('accounts')}
          >
            <Users className="w-3.5 h-3.5" /> Nach Kundenkonto
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            className="h-8 px-3 gap-1.5"
            onClick={() => setViewModePersist('list')}
          >
            <FileText className="w-3.5 h-3.5" /> Rechnungsliste
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'highest' ? 'default' : 'ghost'}
            className="h-8 px-3 gap-1.5"
            onClick={() => setViewModePersist('highest')}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Höchste
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'oldest' ? 'default' : 'ghost'}
            className="h-8 px-3 gap-1.5"
            onClick={() => setViewModePersist('oldest')}
          >
            <Clock className="w-3.5 h-3.5" /> Älteste OP
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'newest' ? 'default' : 'ghost'}
            className="h-8 px-3 gap-1.5"
            onClick={() => setViewModePersist('newest')}
          >
            <Clock className="w-3.5 h-3.5" /> Neuste
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button
            type="button"
            size="sm"
            variant={extra.overdue ? 'default' : 'ghost'}
            className={cn("h-8 px-3 gap-1.5", !extra.overdue && "text-red-500 hover:text-red-500")}
            onClick={() => toggleExtra('overdue')}
            aria-pressed={extra.overdue}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Überfällig
          </Button>
          <Button
            type="button"
            size="sm"
            variant={extra.anwalt ? 'default' : 'ghost'}
            className={cn("h-8 px-3 gap-1.5", !extra.anwalt && "text-amber-500 hover:text-amber-500")}
            onClick={() => toggleExtra('anwalt')}
            aria-pressed={extra.anwalt}
          >
            <Scale className="w-3.5 h-3.5" /> Anwalt
          </Button>
          <Button
            type="button"
            size="sm"
            variant={extra.inkasso ? 'default' : 'ghost'}
            className={cn("h-8 px-3 gap-1.5", !extra.inkasso && "text-orange-500 hover:text-orange-500")}
            onClick={() => toggleExtra('inkasso')}
            aria-pressed={extra.inkasso}
          >
            <Gavel className="w-3.5 h-3.5" /> Inkasso Intern
          </Button>
        </div>
        {(extra.overdue || extra.anwalt || extra.inkasso) && (
          <span className="text-xs text-muted-foreground">Filter kombinierbar – erneut klicken zum Entfernen</span>
        )}

        {(viewMode === 'list' || viewMode === 'accounts') && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sortierung:</span>
            <Select value={listSort} onValueChange={(v) => setListSortPersist(v as 'number' | 'date' | 'status')}>
              <SelectTrigger className="w-[220px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Datum (absteigend)</SelectItem>
                <SelectItem value="number">Rechnungsnummer (absteigend)</SelectItem>
                <SelectItem value="status">Status (Entwurf → Storniert)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {viewMode === 'highest' && (
          <span className="text-xs text-muted-foreground">Kundenkonten nach Rechnungsvolumen (absteigend)</span>
        )}
        {viewMode === 'oldest' && (
          <span className="text-xs text-muted-foreground">Nur offene Posten – älteste zuerst</span>
        )}
        {viewMode === 'newest' && (
          <span className="text-xs text-muted-foreground">Alle Rechnungen nach Erfassungsdatum (absteigend)</span>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={isAccountView ? displayAccounts.length : flatRows.length}
        visible={Math.min(
          isAccountView ? displayAccounts.length : flatRows.length,
          pageSize === 'all' ? (isAccountView ? displayAccounts.length : flatRows.length) : pageSize,
        )}
        placeholder="Suche: Rechnungsnr., Auftragsnr., Name, Stadt, PLZ, Betrag…"
        searchBelow
      >
        <div className="flex items-center gap-2 flex-1 min-w-[200px] sm:flex-none">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Status:</span>
          <Select value={docStatusFilter} onValueChange={setDocStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="draft">Entwurf</SelectItem>
              <SelectItem value="sent">Versendet</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="teilweise bezahlt">Teilweise bezahlt</SelectItem>
              <SelectItem value="bezahlt">Bezahlt</SelectItem>
              <SelectItem value="überfällig">Überfällig</SelectItem>
              <SelectItem value="anwalt">Anwalt</SelectItem>
              <SelectItem value="inkasso">Inkasso Intern</SelectItem>
              <SelectItem value="void">Storniert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px] sm:flex-none">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Zahlungsstatus:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="Bezahlt">Bezahlt</SelectItem>
              <SelectItem value="Offen">Unbezahlt / Offen (inkl. teilweise)</SelectItem>
              <SelectItem value="Überfällig">Überfällig</SelectItem>
              <SelectItem value="Teilweise bezahlt">Teilweise bezahlt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!mietkaufOnly && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              className="accent-primary"
              checked={includeUnpaid}
              onChange={(e) => setIncludeUnpaidPersist(e.target.checked)}
            />
            inkl. wiederkehrende Rechnungen (Offene Posten)
          </label>
        )}

        <div className="basis-full w-full flex flex-wrap items-center gap-x-4 gap-y-3">


          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px] sm:flex-none">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Zeitraum:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-full sm:w-[150px]"
              aria-label="Rechnungsdatum von"
            />
            <span className="text-xs text-muted-foreground">bis</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-full sm:w-[150px]"
              aria-label="Rechnungsdatum bis"
            />
            {(dateFrom || dateTo) && (
              <Button size="sm" variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Zurücksetzen
              </Button>
            )}
          </div>
        </div>


        {isAccountView && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={expandAll}>Alle öffnen</Button>
            <Button size="sm" variant="outline" onClick={collapseAll}>Alle schließen</Button>
          </div>
        )}
      </ListToolbar>

      {globalHits.length > 0 && (
        <div className="mb-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="text-sm font-medium mb-2">
            Keine Treffer in der aktuellen Ansicht — aber {globalHits.length} Treffer regionsübergreifend:
          </div>
          <div className="space-y-1">
            {globalHits.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{h.invoice_number}</span>
                <span className="text-muted-foreground">{h.customer_name}</span>
                <span className="text-muted-foreground">{h.invoice_date}</span>
                <span className="font-medium">{fmtMoney(Number(h.total ?? 0))}</span>
                <span className="rounded bg-secondary px-1.5 py-0.5">{h.accounting_region ?? 'EU'}</span>
                {h.is_mietkauf && <span className="rounded bg-secondary px-1.5 py-0.5">Mietkauf Geräte</span>}
                {h.accounting_region && h.accounting_region !== region && (
                  <Button size="sm" variant="outline" className="h-6 px-2"
                    onClick={() => setRegion(h.accounting_region)}>
                    Zu {h.accounting_region} wechseln
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {progress && <div className="text-xs text-primary mb-3">{progress}</div>}

      {error && <PageError message={error} onRetry={fetchRows} />}

      {loading ? <DataCard><SkeletonTable rows={8} cols={6} /></DataCard> : isListView ? (
        <DataCard className="overflow-hidden">
          {flatRows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Keine Daten gefunden.</div>
          ) : (
            <div className="overflow-x-auto">
              {isAdmin && selectedIds.length > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-2 bg-violet-500/10 border-b border-violet-500/30">
                  <span className="text-sm">{selectedIds.length} Rechnung(en) markiert</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Auswahl aufheben</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkBusy}
                      className="h-8 px-2 gap-1 border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
                      onClick={bulkMietkauf}
                    >
                      {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
                      {mietkaufOnly ? 'Vermietung lösen' : 'Mietkauf Geräte'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={dunningBusy}
                      className="h-8 px-2 gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                      onClick={runDunningEngine}
                      title="Ausgewählte Kundenkonten an die Mahn-Engine übergeben (nur Entwürfe)"
                    >
                      {dunningBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      An Mahn-Engine
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 gap-1 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                      onClick={() => { setBulkStatusValue(''); setBulkStatusOpen(true); }}
                      title="Zahlungsstatus für alle markierten Rechnungen ändern"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Status ändern
                    </Button>

                  </div>

                </div>
              )}
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    {isAdmin && (
                      <th className="px-3 py-2 w-8">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          aria-label="Alle markieren"
                          checked={(() => {
                            const ids = paginate(flatRows, pageSize).map((x) => x.id);
                            return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
                          })()}
                          onChange={(e) => {
                            const ids = paginate(flatRows, pageSize).map((x) => x.id);
                            setSelectedIds(e.target.checked ? Array.from(new Set([...selectedIds, ...ids])) : selectedIds.filter((id) => !ids.includes(id)));
                          }}
                        />
                      </th>
                    )}
                    <SortableTh label="Datum" sortKey="invoice_date" colSort={colSort} onSort={toggleColSort} />
                    <SortableTh label="Fälligkeit" sortKey="due_date" colSort={colSort} onSort={toggleColSort} />
                    <SortableTh label="Status" sortKey="status" colSort={colSort} onSort={toggleColSort} />
                    <SortableTh label="Kunde" sortKey="customer_name" colSort={colSort} onSort={toggleColSort} />
                    <SortableTh label="Rechnung" sortKey="invoice_number" colSort={colSort} onSort={toggleColSort} />
                    <SortableTh label="Betrag" sortKey="total" align="right" colSort={colSort} onSort={toggleColSort} />
                    <SortableTh label="Saldo" sortKey="balance" align="right" colSort={colSort} onSort={toggleColSort} />
                    <SortableTh label="Referenz" sortKey="reference_number" colSort={colSort} onSort={toggleColSort} />
                    <th className="text-right px-4 py-2 font-medium">Aktion</th>


                  </tr>
                </thead>
                {paginate(flatRows, pageSize).map((r, idx) => (
                  <tbody
                    key={`${r.source}-${r.id}`}
                    className={`group border border-border/60 hover:border-emerald-500 transition-colors [&>tr]:bg-transparent [&>tr>td]:bg-transparent ${idx % 2 === 1 ? 'bg-muted/30 hover:bg-primary/10' : 'bg-transparent hover:bg-primary/10'}`}
                  >
                    <tr
                      className={`cursor-pointer ${openActions[`${r.source}-${r.id}`] ? '[&>td]:pb-0' : ''}`}
                      onClick={() => toggleActions(`${r.source}-${r.id}`)}
                    >
                      <td className="px-2 py-2 w-8">
                        <button
                          type="button"
                          aria-label="Aktionen ein-/ausklappen"
                          onClick={(e) => { e.stopPropagation(); toggleActions(`${r.source}-${r.id}`); }}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {openActions[`${r.source}-${r.id}`]
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="accent-primary"
                            aria-label={`Rechnung ${r.invoice_number ?? ''} markieren`}
                            checked={selectedIds.includes(r.id)}
                            onChange={() => toggleSelect(r.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.invoice_date)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                          <Badge variant="outline" className={statusVariant(r.payment_status)}>
                            {r.payment_status ?? '–'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="truncate max-w-[220px]">{r.customer_name ?? '–'}</div>
                        {(() => {
                          const m = r.invoice_number ? rowMeta[r.invoice_number] : undefined;
                          if (!m) return r.city ? <div className="text-[10px] text-muted-foreground truncate max-w-[260px]">{r.city}</div> : null;
                          return (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[320px] flex items-center gap-2 flex-wrap">
                              {r.city && <span>{r.city}</span>}
                              <span className={m.level ? 'text-amber-400' : ''}>Mahnung: {m.level ? `Stufe ${m.level}` : '–'}</span>
                              <span>Emails versendet: {m.mails}</span>
                              <span>Mahnstufe: {m.level ?? '–'}{m.reminderSent ? ` (${fmtDate(m.reminderSent)})` : ''}</span>
                              <span className={m.opened ? 'text-emerald-400' : ''}>Email gelesen: {m.opened ? `ja (${m.opened})` : 'nein'}</span>
                            </div>
                          );
                        })()}

                      </td>
                      <td className="px-4 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handlePreview(r); }}
                            className="text-primary underline underline-offset-2 hover:text-primary/80"
                            title="Rechnung anzeigen"
                          >
                            {r.invoice_number ?? '–'}
                          </button>
                          <TenantBadge source={r.source_system} />
                          {isDraftInvoice(r) && (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-[10px] uppercase tracking-wide">
                              Entwurf
                            </Badge>
                          )}

                        </div>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.total, r.currency)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.balance, r.currency)}</td>
                      <td className="px-4 py-2">{r.reference_number ?? '–'}</td>

                    </tr>
                    {openActions[`${r.source}-${r.id}`] && (
                      <tr>
                        <td colSpan={isAdmin ? 11 : 10} className="pb-3 pt-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            {r.source === 'recurring' ? (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                <Repeat className="w-3 h-3 mr-1" />Periodisch
                              </Badge>
                            ) : r.source === 'unpaid' ? (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                                <Repeat className="w-3 h-3 mr-1" />Wiederkehrend (OP)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-muted/40">Einmalig</Badge>
                            )}
                            {renderRowActions(r)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))}

              </table>
            </div>
          )}
        </DataCard>
      ) : (
        <div className="space-y-3">
          {displayAccounts.length === 0 ? (
            <DataCard className="p-12 text-center text-muted-foreground">
              Keine Daten gefunden.
            </DataCard>
          ) : paginate(displayAccounts, pageSize).map((a) => {
            const open = !!expanded[a.key];
            return (
              <DataCard key={a.key} className="overflow-hidden">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(a.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(a.key); } }}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/20 text-left cursor-pointer"
                >
                  {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold truncate">{a.customer_name}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                        title="Mahnung im ALIX COLLECT Command Center öffnen"
                        onClick={(e) => { e.stopPropagation(); openDunning(a); }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" /> Mahnung
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={nachtragBusy === a.key}
                          className="h-8 px-2 gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          title="Fehlende periodische Rechnungen rückwirkend erzeugen (ohne Versand)"
                          onClick={(e) => { e.stopPropagation(); nachtragAccount(a); }}
                        >
                          {nachtragBusy === a.key
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Repeat className="w-3.5 h-3.5" />}
                          RECHNUNG NACHTRAG
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                          title="Sofort Rechnung erstellen, festschreiben und diesem Kundenkonto zuordnen"
                          onClick={(e) => { e.stopPropagation(); setSofortAccount(a); }}
                        >
                          <Zap className="w-3.5 h-3.5" /> SOFORT RECHNUNG
                        </Button>
                      )}
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 gap-1 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                          title="Zahlungsstatus für ALLE Rechnungen dieses Kundenkontos ändern"
                          onClick={(e) => {
                            e.stopPropagation();
                            const ids = a.rows.filter((r) => r.source !== 'unpaid').map((r) => r.id);
                            if (ids.length === 0) {
                              toast({ title: 'Keine änderbaren Rechnungen', variant: 'destructive' });
                              return;
                            }
                            setSelectedIds(ids);
                            setBulkStatusValue('');
                            setBulkStatusOpen(true);
                          }}
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> KONTO STATUS ÄNDERN
                        </Button>
                      )}
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                        <AccountStatementActions
                          customerName={a.customer_name}
                          customerNumber={a.customer_id}
                          city={a.city}
                          rows={a.rows as any}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
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
                      <Badge className="bg-destructive text-destructive-foreground border-transparent font-semibold hover:bg-destructive">
                        {a.overdueCount} überfällig
                      </Badge>
                    )}
                  </div>
                  <div className="text-right tabular-nums w-40">
                    <div className="text-sm font-semibold">{fmtMoney(a.totalAmount)}</div>
                    {a.totalOpen > 0 && <div className="text-xs font-medium text-amber-400">offen: {fmtMoney(a.totalOpen)}</div>}
                    {(() => {
                      const mk = Number(mietkaufTotals[a.key] ?? 0);
                      if (mk <= 0) return null;
                      const paid = a.rows.reduce((s, r) => s + (Number(r.total ?? 0) - Number(r.balance ?? 0)), 0);
                      const op = mk - paid;
                      return (
                        <div className={`text-xs font-semibold ${op > 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                          OP Total: {fmtMoney(op)}
                        </div>
                      );
                    })()}

                  </div>
                </div>

                {open && (
                  <div className="border-t border-border overflow-x-auto">
                    {isAdmin && a.rows.some((r) => selectedIds.includes(r.id)) && (
                      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-violet-500/10 border-b border-violet-500/30">
                        <span className="text-sm">{a.rows.filter((r) => selectedIds.includes(r.id)).length} Rechnung(en) markiert</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(selectedIds.filter((id) => !a.rows.some((r) => r.id === id)))}>Auswahl aufheben</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={bulkBusy}
                            className="h-8 px-2 gap-1 border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
                            onClick={bulkMietkauf}
                          >
                            {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
                            {mietkaufOnly ? 'Vermietung lösen' : 'Mietkauf Geräte'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={dunningBusy}
                            className="h-8 px-2 gap-1 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                            onClick={runDunningEngine}
                            title="Ausgewählte Kundenkonten an die Mahn-Engine übergeben (nur Entwürfe)"
                          >
                            {dunningBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            An Mahn-Engine
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 gap-1 border-sky-500/40 text-sky-400 hover:bg-sky-500/10"
                            onClick={() => { setBulkStatusValue(''); setBulkStatusOpen(true); }}
                            title="Zahlungsstatus für alle markierten Rechnungen ändern"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Status ändern
                          </Button>
                        </div>
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-2 w-8"></th>
                          {isAdmin && (
                            <th className="px-3 py-2 w-8">
                              <input
                                type="checkbox"
                                className="accent-primary"
                                aria-label="Alle markieren"
                                checked={a.rows.length > 0 && a.rows.every((r) => selectedIds.includes(r.id))}
                                onChange={(e) => {
                                  const ids = a.rows.map((r) => r.id);
                                  setSelectedIds(e.target.checked
                                    ? Array.from(new Set([...selectedIds, ...ids]))
                                    : selectedIds.filter((id) => !ids.includes(id)));
                                }}
                              />
                            </th>
                          )}
                          <th className="text-left px-4 py-2 font-medium">Typ</th>

                          <th className="text-left px-4 py-2 font-medium">Rechnung</th>
                          <th className="text-left px-4 py-2 font-medium">Referenz</th>
                          <th className="text-left px-4 py-2 font-medium">Datum</th>
                          <th className="text-left px-4 py-2 font-medium">Fällig</th>
                          <th className="text-right px-4 py-2 font-medium">Betrag</th>
                          <th className="text-right px-4 py-2 font-medium">Saldo</th>
                          <th className="text-left px-4 py-2 font-medium">Letzte Zahlung</th>
                          <th className="text-left px-4 py-2 font-medium">Status</th>
                          <th className="text-right px-4 py-2 font-medium">Aktion</th>
                        </tr>
                      </thead>
                      {a.rows.map((r, idx) => (
                        <tbody
                          key={`${r.source}-${r.id}`}
                          className={`group border border-border/60 hover:border-emerald-500 transition-colors [&>tr]:bg-transparent [&>tr>td]:bg-transparent ${idx % 2 === 1 ? 'bg-muted/30 hover:bg-primary/10' : 'bg-transparent hover:bg-primary/10'}`}
                        >
                          <tr
                            className={`cursor-pointer ${openActions[`acc-${r.source}-${r.id}`] ? '[&>td]:pb-0' : ''}`}
                            onClick={() => toggleActions(`acc-${r.source}-${r.id}`)}
                          >
                            <td className="px-2 py-2 w-8">
                              <button
                                type="button"
                                aria-label="Aktionen ein-/ausklappen"
                                onClick={(e) => { e.stopPropagation(); toggleActions(`acc-${r.source}-${r.id}`); }}
                                className="text-muted-foreground hover:text-primary transition-colors"
                              >
                                {openActions[`acc-${r.source}-${r.id}`]
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="accent-primary"
                                  aria-label={`Rechnung ${r.invoice_number ?? ''} markieren`}
                                  checked={selectedIds.includes(r.id)}
                                  onChange={() => toggleSelect(r.id)}
                                />
                              </td>
                            )}



                            <td className="px-4 py-2">
                              {r.source === 'recurring' ? (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                  <Repeat className="w-3 h-3 mr-1" />Periodisch
                                </Badge>
                              ) : r.source === 'unpaid' ? (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                                  <Repeat className="w-3 h-3 mr-1" />Wiederkehrend (OP)
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-muted/40">Einmalig</Badge>
                              )}
                            </td>
                            <td className="px-4 py-2 font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handlePreview(r); }}
                                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                                  title="Rechnung anzeigen"
                                >
                                  {r.invoice_number ?? '–'}
                                </button>
                                {isDraftInvoice(r) && (
                                  <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-[10px] uppercase tracking-wide">
                                    Entwurf
                                  </Badge>
                                )}
                              </div>
                            </td>
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
                            </tr>
                          {openActions[`acc-${r.source}-${r.id}`] && (
                            <tr>
                              <td colSpan={isAdmin ? 12 : 11} className="pb-3 pt-1">
                                {renderRowActions(r)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      ))}

                    </table>
                  </div>
                )}
              </DataCard>
            );
          })}
        </div>
      )}

      {editRow && (
        <div
          className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !editSaving) setEditRow(null); }}
        >
          <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Rechnung {editRow.invoice_number ?? ''} bearbeiten
              </h2>
              <Button variant="ghost" size="sm" onClick={() => !editSaving && setEditRow(null)} disabled={editSaving} aria-label="Schließen">
                <LucideXIcon className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {isSuperAdmin && (
                <>
                  <div>
                    <Label htmlFor="invnr">Rechnungsnummer</Label>
                    <Input id="invnr" value={editForm.invoice_number} onChange={(e) => setEditForm((f) => ({ ...f, invoice_number: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="cust">Kunde</Label>
                    <Input id="cust" value={editForm.customer_name} onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="idate">Rechnungsdatum</Label>
                    <Input id="idate" type="date" value={editForm.invoice_date} onChange={(e) => setEditForm((f) => ({ ...f, invoice_date: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="total">Betrag (€)</Label>
                      <Input id="total" type="number" step="0.01" value={editForm.total} onChange={(e) => setEditForm((f) => ({ ...f, total: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="bal">Saldo (€)</Label>
                      <Input id="bal" type="number" step="0.01" value={editForm.balance} onChange={(e) => setEditForm((f) => ({ ...f, balance: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="ref">Referenz / Auftragsnr.</Label>
                <Input id="ref" value={editForm.reference_number} onChange={(e) => setEditForm((f) => ({ ...f, reference_number: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="due">Fälligkeit</Label>
                <Input id="due" type="date" value={editForm.due_date} onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ps">Zahlungsstatus</Label>
                <select
                  id="ps"
                  value={editForm.payment_status}
                  onChange={(e) => setEditForm((f) => ({ ...f, payment_status: e.target.value }))}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Status wählen</option>
                  <option value="Offen">Offen</option>
                  <option value="Bezahlt">Bezahlt</option>
                  <option value="Teilweise bezahlt">Teilweise bezahlt</option>
                  <option value="Überfällig">Überfällig</option>
                  <option value="Inkasso Intern">Inkasso Intern</option>
                </select>
              </div>
              <div>
                <Label htmlFor="rstatus">Rechnungsstatus</Label>
                <select
                  id="rstatus"
                  value={editForm.status || 'sent'}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="draft">Entwurf (nicht an Finance)</option>
                  <option value="sent">Festgeschrieben (versendet)</option>
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Hinweis: Änderungen wirken lokal in Alix Work. Ein Sync nach Zoho erfolgt hier nicht automatisch.</p>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setEditRow(null)} disabled={editSaving}>Abbrechen</Button>
              <Button onClick={saveEdit} disabled={editSaving} className="gold-gradient text-primary-foreground">
                {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Speichern
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!statusRow} onOpenChange={(o) => !o && !statusSaving && setStatusRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Status Änderung {statusRow?.invoice_number ?? ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="stps">Zahlungsstatus</Label>
              <select
                id="stps"
                value={statusForm.payment_status}
                onChange={(e) => setStatusForm((f) => ({ ...f, payment_status: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Status wählen</option>
                <option value="Offen">Offen</option>
                <option value="Teilweise bezahlt">Teilweise bezahlt</option>
                <option value="Bezahlt">Bezahlt</option>
                <option value="Überfällig">Überfällig</option>
                <option value="Storniert">Storniert</option>
                <option value="Anwalt">Anwalt</option>
                <option value="Inkasso Intern">Inkasso Intern</option>
              </select>
            </div>
            <div>
              <Label htmlFor="strs">Rechnungsstatus</Label>
              <select
                id="strs"
                value={statusForm.status || 'sent'}
                onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="draft">Entwurf</option>
                <option value="sent">Festgeschrieben (versendet)</option>
                <option value="void">Storniert</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Änderung wirkt lokal in Alix Work, kein Zoho-Sync.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusRow(null)} disabled={statusSaving}>Abbrechen</Button>
            <Button onClick={saveStatus} disabled={statusSaving} className="gold-gradient text-primary-foreground">
              {statusSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkStatusOpen} onOpenChange={(o) => !o && !bulkStatusSaving && setBulkStatusOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Status für {selectedIds.length} Rechnung(en)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="bulkps">Zahlungsstatus</Label>
              <select
                id="bulkps"
                value={bulkStatusValue}
                onChange={(e) => setBulkStatusValue(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Status wählen</option>
                <option value="Offen">Offen</option>
                <option value="Teilweise bezahlt">Teilweise bezahlt</option>
                <option value="Bezahlt">Bezahlt</option>
                <option value="Überfällig">Überfällig</option>
                <option value="Storniert">Storniert</option>
                <option value="Anwalt">Anwalt</option>
                <option value="Inkasso Intern">Inkasso Intern</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Wird auf alle markierten Rechnungen angewendet (kein Zoho-Sync).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusOpen(false)} disabled={bulkStatusSaving}>Abbrechen</Button>
            <Button onClick={saveBulkStatus} disabled={bulkStatusSaving || !bulkStatusValue} className="gold-gradient text-primary-foreground">
              {bulkStatusSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={!!emailRow} onOpenChange={(o) => { if (!o && !emailSending) { setEmailRow(null); setEmailStatusAfter(''); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Rechnung {emailRow?.invoice_number ?? ''} per E-Mail versenden
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {emailPreparing && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Kundendaten werden geladen…
              </div>
            )}
            <div>
              <Label htmlFor="mto">Empfänger E-Mail *</Label>
              <Input id="mto" type="email" value={emailForm.to_email} onChange={(e) => setEmailForm((f) => ({ ...f, to_email: e.target.value }))} placeholder="kunde@example.com" />
            </div>
            <div>
              <Label htmlFor="mton">Empfängername</Label>
              <Input id="mton" value={emailForm.to_name} onChange={(e) => setEmailForm((f) => ({ ...f, to_name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="mbcc">BCC (Vertriebspartner / weitere Kopien)</Label>
              <Input id="mbcc" value={emailForm.bcc} onChange={(e) => setEmailForm((f) => ({ ...f, bcc: e.target.value }))} placeholder="vertrieb@example.com, weitere@example.com" />
              <p className="text-[11px] text-muted-foreground mt-1">Mehrere Adressen mit Komma trennen. Wird automatisch aus dem verknüpften Auftrag vorbefüllt.</p>
            </div>
            <div>
              <Label htmlFor="msub">Betreff</Label>
              <Input id="msub" value={emailForm.subject} onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="mbody">Nachricht</Label>
              <Textarea id="mbody" rows={8} value={emailForm.body_text} onChange={(e) => setEmailForm((f) => ({ ...f, body_text: e.target.value }))} />
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <Label htmlFor="mstatus">Status nach Versand ändern</Label>
              <select
                id="mstatus"
                value={emailStatusAfter}
                onChange={(e) => setEmailStatusAfter(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Status unverändert lassen</option>
                <option value="Offen">Offen</option>
                <option value="Teilweise bezahlt">Teilweise bezahlt</option>
                <option value="Bezahlt">Bezahlt</option>
                <option value="Überfällig">Überfällig</option>
                <option value="Storniert">Storniert</option>
                <option value="Anwalt">Anwalt</option>
                <option value="Inkasso Intern">Inkasso Intern</option>
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">Wird erst nach erfolgreichem Versand automatisch gesetzt.</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Absender: <span className="font-mono">noreply@alixlasers.ai</span> (Alix Lasers ®) · Die Rechnung wird automatisch als PDF im Anhang beigefügt.
            </p>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmailRow(null); setEmailStatusAfter(''); }} disabled={emailSending}>Abbrechen</Button>
            <Button onClick={sendEmail} disabled={emailSending || emailPreparing} className="gold-gradient text-primary-foreground">
              {emailSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              {emailSending ? 'Sende…' : 'Senden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {bookRow && (
        <div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-title"
            aria-describedby="book-desc"
            className="grid w-[calc(100dvw-2rem)] max-w-lg gap-4 rounded-lg border border-border bg-background p-6 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="book-title" className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Rechnung {bookRow.invoice_number ?? ''} buchen
                </h2>
                <p id="book-desc" className="mt-2 text-xs text-muted-foreground">Zahlungsart wählen und als bezahlt buchen.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => !bookSaving && setBookRow(null)} disabled={bookSaving} aria-label="Schließen">
                ×
              </Button>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                <div><span className="text-muted-foreground">Kunde:</span> {bookRow.customer_name ?? '–'}</div>
                <div><span className="text-muted-foreground">Betrag:</span> {fmtMoney(bookRow.total ?? 0, bookRow.currency)}</div>
                <div><span className="text-muted-foreground">Offener Saldo:</span> {fmtMoney(bookRow.balance ?? 0, bookRow.currency)}</div>
              </div>
              <div>
                <Label htmlFor="bkm">Zahlungsart</Label>
                <select
                  id="bkm"
                  value={bookMethod}
                  onChange={(e) => setBookMethod(e.target.value as any)}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="Überweisung">Überweisung</option>
                  <option value="Bar">Bar</option>
                  <option value="Lastschrift">Lastschrift</option>
                  <option value="SEPA">SEPA</option>
                </select>
              </div>
              <div>
                <Label htmlFor="bka">Betrag der Zahlung</Label>
                <Input
                  id="bka"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bookAmount}
                  onChange={(e) => setBookAmount(e.target.value)}
                />
              </div>
              {(() => {
                const openBefore = Number(bookRow.balance ?? bookRow.total ?? 0);
                const pay = Math.max(0, Number(String(bookAmount).replace(',', '.')) || 0);
                const remaining = Math.max(0, +(openBefore - pay).toFixed(2));
                const fullyPaid = remaining <= 0.0049;
                return (
                  <div className="rounded-md border border-border bg-muted/10 p-3 text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">Offener Saldo nach Buchung:</span>
                    <span className={fullyPaid ? 'text-emerald-500 font-medium' : 'text-amber-500 font-medium'}>
                      {fmtMoney(remaining, bookRow.currency)}{fullyPaid ? ' – vollständig bezahlt' : ' – Teilzahlung'}
                    </span>
                  </div>
                );
              })()}
              <div>
                <Label htmlFor="bkd">Zahlungsdatum</Label>
                <Input id="bkd" type="date" value={bookDate} onChange={(e) => setBookDate(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Die Rechnung wird entsprechend dem Zahlbetrag als <strong>Bezahlt</strong> oder <strong>Teilweise bezahlt</strong> markiert und im Buchungsjournal verbucht.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setBookRow(null)} disabled={bookSaving}>Abbrechen</Button>
              <Button onClick={submitBook} disabled={bookSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                {bookSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Buchen
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={!!previewRow}
        onOpenChange={(v) => {
          if (!v) {
            setPreviewRow(null);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-3 text-base">
              <span>Rechnung {previewRow?.invoice_number ?? '—'}</span>
              {previewUrl && (
                <span className="ml-auto flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={previewUrl} download={`${previewRow?.invoice_number ?? 'rechnung'}.pdf`}>
                      <Download className="w-4 h-4 mr-1" /> Download
                    </a>
                  </Button>
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-neutral-900/40">
            {!previewUrl ? (
              <div className="h-full flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-5 h-5 animate-spin" /> Rechnung wird geladen…
              </div>
            ) : (
              <iframe src={previewUrl} title="Rechnung" className="w-full h-full border-0 bg-white" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceReturnDebitDialog
        invoice={returnDebitRow ? {
          id: returnDebitRow.id,
          invoice_number: returnDebitRow.invoice_number,
          customer_id: returnDebitRow.customer_id,
          customer_name: returnDebitRow.customer_name,
          total: returnDebitRow.total,
          balance: returnDebitRow.balance,
          currency: returnDebitRow.currency,
          accounting_region: region === 'CH' ? 'CH' : 'EU',
        } : null}
        open={!!returnDebitRow}
        onOpenChange={(v) => { if (!v) setReturnDebitRow(null); }}
        onDone={() => { setReturnDebitRow(null); void fetchRows(); }}
      />

      {sofortAccount && (
        <SofortRechnungDialog
          open={!!sofortAccount}
          onOpenChange={(v) => { if (!v) setSofortAccount(null); }}
          customerId={sofortAccount.customer_id}
          customerName={sofortAccount.customer_name}
          city={sofortAccount.city}
          tenantId={tenantId}
          onCreated={() => { setSofortAccount(null); void fetchRows(); }}
        />
      )}
    </div>

  );
}
