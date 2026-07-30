import { useAccountingRegion } from '@/contexts/AccountingRegionContext';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarIcon, FileText, Loader2, RefreshCw, Pencil, X, BookCheck, CheckCircle2, ChevronDown, Banknote, Building2, Ban, Scale, Undo2, ExternalLink, Users, Download, FileSpreadsheet, FileJson } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';

type WorkflowStatus = 'offen' | 'rueckstellung' | 'in_klaerung' | 'anwalt' | 'inkasso' | 'erledigt';

type OpenItem = {
  id: string;
  source: 'invoice' | 'recurring';
  invoice_number: string | null;
  reference_number: string | null;
  customer_name: string | null;
  city: string | null;
  billing_address: string | null;
  due_date: string | null;
  total: number | null;
  balance: number | null;
  currency: string | null;
  status: string | null;
  zoho_invoice_id: string | null;
  source_system: string | null;
};

type WorkflowState = {
  source: string;
  invoice_key: string;
  workflow_status: WorkflowStatus;
  note: string | null;
  updated_at: string;
};

type Bucket = 'overdue_30' | 'overdue_7' | 'overdue' | 'due_soon' | 'upcoming';

const bucketFor = (due: string | null): Bucket => {
  if (!due) return 'upcoming';
  const days = differenceInCalendarDays(parseISO(due), new Date());
  if (days < -30) return 'overdue_30';
  if (days < -7) return 'overdue_7';
  if (days < 0) return 'overdue';
  if (days <= 7) return 'due_soon';
  return 'upcoming';
};

const bucketStyles: Record<Bucket, { row: string; label: string; badge: string }> = {
  overdue_30: { row: 'bg-destructive/15 hover:bg-destructive/20', label: '> 30 Tage überfällig', badge: 'bg-destructive text-destructive-foreground' },
  overdue_7: { row: 'bg-destructive/10 hover:bg-destructive/15', label: '> 7 Tage überfällig', badge: 'bg-destructive/80 text-destructive-foreground' },
  overdue: { row: 'bg-orange-500/10 hover:bg-orange-500/15', label: 'Überfällig', badge: 'bg-orange-500 text-white' },
  due_soon: { row: 'bg-yellow-500/10 hover:bg-yellow-500/15', label: 'Fällig in ≤ 7 Tagen', badge: 'bg-yellow-500 text-black' },
  upcoming: { row: 'hover:bg-muted/40', label: 'Zukünftig', badge: 'bg-muted text-muted-foreground' },
};

const workflowOptions: { value: WorkflowStatus; label: string; badge: string }[] = [
  { value: 'offen', label: 'Offen', badge: 'bg-muted text-muted-foreground' },
  { value: 'rueckstellung', label: 'Rückstellung', badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' },
  { value: 'in_klaerung', label: 'In Klärung', badge: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  { value: 'anwalt', label: 'Anwalt', badge: 'bg-rose-500/15 text-rose-400 border border-rose-500/30' },
  { value: 'inkasso', label: 'Übergabe Inkasso', badge: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
  { value: 'erledigt', label: 'Erledigt', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
];

const workflowLabel = (s: WorkflowStatus) => workflowOptions.find((o) => o.value === s)?.label ?? s;
const workflowBadge = (s: WorkflowStatus) => workflowOptions.find((o) => o.value === s)?.badge ?? '';

const formatCurrency = (n: number | null, currency: string | null) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(n ?? 0);

export default function OffenePosten() {
  const { region } = useAccountingRegion();
  const [items, setItems] = useState<OpenItem[]>([]);

  const [workflows, setWorkflows] = useState<Record<string, WorkflowState>>({});
  const [bookedRefs, setBookedRefs] = useState<Record<string, { journal_number: string | null; booking_date: string }>>({});
  const [bookingKey, setBookingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [dateFrom, setDateFrom] = useState<Date>(new Date(new Date().getFullYear(), 0, 1));
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [pdfLoadingKey, setPdfLoadingKey] = useState<string | null>(null);
  const pdfCacheRef = useRef<Map<string, string>>(new Map());

  const openInvoicePdf = useCallback(async (item: OpenItem) => {
    if (!item.zoho_invoice_id) {
      toast.error('Für diese Rechnung ist keine Zoho-ID hinterlegt.');
      return;
    }
    const key = `${item.source}-${item.id}`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<!doctype html><html><head><title>Rechnung ${item.invoice_number ?? ''} wird geladen…</title><style>
        body{margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px}
        .spinner{width:42px;height:42px;border:3px solid #333;border-top-color:#d4af37;border-radius:50%;animation:spin 0.8s linear infinite}
        .lbl{font-size:14px;opacity:.75}
        @keyframes spin{to{transform:rotate(360deg)}}
      </style></head><body><div class="spinner"></div><div class="lbl">Rechnung ${item.invoice_number ?? ''} wird von Zoho geladen…</div></body></html>`);
      win.document.close();
    }

    const cached = pdfCacheRef.current.get(key);
    if (cached) {
      if (win) win.location.href = cached;
      return;
    }

    setPdfLoadingKey(key);
    try {
      const { data, error } = await supabase.functions.invoke('zoho-invoice-pdf', {
        body: {
          zoho_invoice_id: item.zoho_invoice_id,
          source_system: item.source_system ?? 'zoho_eu_1',
          recurring: item.source === 'recurring',
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const b64 = (data as any)?.pdf_base64;
      if (!b64) throw new Error('Kein PDF erhalten');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      pdfCacheRef.current.set(key, url);
      if (win) {
        win.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.click();
      }
    } catch (e: any) {
      if (win) win.close();
      toast.error('PDF fehlgeschlagen: ' + (e?.message ?? 'Unbekannter Fehler'));
    } finally {
      setPdfLoadingKey(null);
    }
  }, []);

  const [editItem, setEditItem] = useState<OpenItem | null>(null);
  const [editStatus, setEditStatus] = useState<WorkflowStatus>('offen');
  const [editNote, setEditNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editItem) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditItem(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editItem]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: invoices, error: e1 }, { data: recurring, error: e2 }, { data: wf, error: e3 }, { data: journals, error: e4 }] =
      await Promise.all([
        supabase
          .from('zoho_invoices')
          .select('id, invoice_number, reference_number, customer_name, city, billing_address, due_date, total, balance, currency, status, zoho_invoice_id, source_system')
          .eq('accounting_region', region)
          .gt('balance', 0)
          .order('due_date', { ascending: true })
          .limit(2000),
        supabase
          .from('zoho_recurring_invoices')
          .select('id, invoice_number, reference_number, customer_name, city, billing_address, due_date, total, balance, currency, status, zoho_invoice_id, source_system')
          .gt('balance', 0)
          .order('due_date', { ascending: true })
          .limit(2000),
        supabase
          .from('invoice_workflow_states')
          .select('source, invoice_key, workflow_status, note, updated_at')
          .limit(2000),
        supabase
          .from('finance_journal')
          .select('reference, journal_number, booking_date')
          .eq('source_module', 'offene_posten')
          .like('reference', 'op:%')
          .limit(5000),
      ]);
    if (e1 || e2 || e3 || e4) toast.error('Fehler beim Laden: ' + (e1?.message || e2?.message || e3?.message || e4?.message));
    const merged: OpenItem[] = [
      ...((invoices ?? []).map((i: any) => ({ ...i, source: 'invoice' as const }))),
      ...((recurring ?? []).map((i: any) => ({ ...i, source: 'recurring' as const }))),
    ];
    merged.sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
    setItems(merged);
    const map: Record<string, WorkflowState> = {};
    (wf ?? []).forEach((w: any) => {
      map[`${w.source}-${w.invoice_key}`] = w as WorkflowState;
    });
    setWorkflows(map);
    const booked: Record<string, { journal_number: string | null; booking_date: string }> = {};
    (journals ?? []).forEach((j: any) => {
      // reference format: op:<source>:<id>
      const parts = String(j.reference || '').split(':');
      if (parts.length >= 3) booked[`${parts[1]}-${parts[2]}`] = { journal_number: j.journal_number, booking_date: j.booking_date };
    });
    setBookedRefs(booked);
    setLoading(false);
  }, [region]);

  useEffect(() => { load(); }, [load]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    let totalImported = 0;
    let totalUpdated = 0;
    let page = 1;
    const fromStr = format(dateFrom, 'yyyy-MM-dd');
    const toStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined;
    try {
      for (let i = 0; i < 20; i++) {
        const { data, error } = await supabase.functions.invoke('sync-zoho-invoices', {
          body: { source_system: 'zoho_eu_1', date_from: fromStr, date_to: toStr, page, per_page: 200, max_pages: 5 },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        totalImported += data?.imported ?? 0;
        totalUpdated += data?.updated ?? 0;
        if (!data?.has_more) break;
        page = (data.last_page ?? page) + 1;
      }
      toast.success(`Sync fertig: ${totalImported} neu, ${totalUpdated} aktualisiert`);
      await load();
    } catch (e: any) {
      toast.error('Sync fehlgeschlagen: ' + (e?.message ?? 'Unbekannt'));
    } finally {
      setSyncing(false);
    }
  }, [load, dateFrom, dateTo]);

  const openEdit = (item: OpenItem) => {
    const key = `${item.source}-${item.id}`;
    const existing = workflows[key];
    setEditItem(item);
    setEditStatus(existing?.workflow_status ?? 'offen');
    setEditNote(existing?.note ?? '');
  };

  const closeEdit = () => {
    setEditItem(null);
  };

  const saveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    const payload = {
      source: editItem.source,
      invoice_key: editItem.id,
      invoice_number: editItem.invoice_number,
      workflow_status: editStatus,
      note: editNote || null,
      updated_by: uid,
      created_by: uid,
    };
    const { error } = await supabase
      .from('invoice_workflow_states')
      .upsert(payload, { onConflict: 'source,invoice_key' });
    setSaving(false);
    if (error) {
      toast.error('Speichern fehlgeschlagen: ' + error.message);
      return;
    }
    toast.success('Status gespeichert');
    setWorkflows((prev) => ({
      ...prev,
      [`${editItem.source}-${editItem.id}`]: {
        source: editItem.source,
        invoice_key: editItem.id,
        workflow_status: editStatus,
        note: editNote || null,
        updated_at: new Date().toISOString(),
      },
    }));
    closeEdit();
  };

  type BookingMethod = 'barzahlung' | 'ueberweisung' | 'keine_zahlung' | 'anwalt' | 'storno';

  const bookingMethodConfig: Record<BookingMethod, { label: string; vorgang: string; contra: string | null; status: string; icon: typeof Banknote }> = {
    barzahlung:    { label: 'Barzahlung',    vorgang: 'Zahlung Bar',        contra: '1000', status: 'aktiv',      icon: Banknote },
    ueberweisung:  { label: 'Überweisung',   vorgang: 'Zahlung Überweisung', contra: '1200', status: 'aktiv',      icon: Building2 },
    keine_zahlung: { label: 'Keine Zahlung', vorgang: 'Keine Zahlung',      contra: null,   status: 'aktiv',      icon: Ban },
    anwalt:        { label: 'Anwalt',        vorgang: 'Übergabe Anwalt',    contra: null,   status: 'aktiv',      icon: Scale },
    storno:        { label: 'Storno',        vorgang: 'Storno',             contra: '8400', status: 'storniert',  icon: Undo2 },
  };

  const bookItem = async (item: OpenItem, method: BookingMethod) => {
    const key = `${item.source}-${item.id}`;
    if (bookedRefs[key]) {
      toast.info('Diese Rechnung wurde bereits gebucht.');
      return;
    }
    setBookingKey(key);
    const cfg = bookingMethodConfig[method];
    const reference = `op:${item.source}:${item.id}`;
    const gross = Number(item.total ?? item.balance ?? 0);
    // 19% USt aus brutto extrahieren (Annahme deutscher Standard, ohne Steuerinfo aus Zoho)
    const net = Math.round((gross / 1.19) * 100) / 100;
    const vat = Math.round((gross - net) * 100) / 100;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;

    // Idempotenz: ggf. existierenden Eintrag prüfen
    const { data: existing } = await supabase
      .from('finance_journal')
      .select('id, journal_number, booking_date')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      setBookedRefs((prev) => ({ ...prev, [key]: { journal_number: existing.journal_number, booking_date: existing.booking_date } }));
      setBookingKey(null);
      toast.info('Bereits gebucht: ' + (existing.journal_number ?? existing.id));
      return;
    }

    const payload = {
      source_module: 'offene_posten',
      source_table: item.source === 'recurring' ? 'zoho_recurring_invoices' : 'zoho_invoices',
      source_id: item.id,
      reference,
      invoice_number: item.invoice_number,
      vorgang: cfg.vorgang,
      amount_net: net,
      amount_vat: vat,
      amount_gross: gross,
      account: '1400', // Forderungen aus Lieferungen und Leistungen
      contra_account: cfg.contra,
      description: `${cfg.label} · ${item.customer_name ?? ''} · ${item.invoice_number ?? ''}`.trim(),
      status: cfg.status,
      user_id: uid,
    };

    const { data: inserted, error } = await supabase
      .from('finance_journal')
      .insert(payload)
      .select('id, journal_number, booking_date')
      .single();

    setBookingKey(null);
    if (error) {
      toast.error('Buchen fehlgeschlagen: ' + error.message);
      return;
    }
    setBookedRefs((prev) => ({ ...prev, [key]: { journal_number: inserted?.journal_number ?? null, booking_date: inserted?.booking_date ?? new Date().toISOString().slice(0, 10) } }));
    toast.success(`${cfg.label} gebucht${inserted?.journal_number ? ' · ' + inserted.journal_number : ''}`);
  };

  type WorkflowFilter = WorkflowStatus | 'alle' | 'gebucht';
  const [wfFilter, setWfFilter] = useState<WorkflowFilter>('offen');

  const searched = useMemo(
    () => items.filter((i) => matchesQuery(i, search)),
    [items, search],
  );

  const statusFor = useCallback((i: OpenItem): WorkflowFilter => {
    const key = `${i.source}-${i.id}`;
    const wf = workflows[key]?.workflow_status;
    // Manuell gesetzter Bearbeitungsstand hat Vorrang vor der Buchung
    if (wf && wf !== 'offen') return wf;
    if (bookedRefs[key]) return 'gebucht';
    return wf ?? 'offen';
  }, [workflows, bookedRefs]);

  const counts = useMemo(() => {
    const c: Record<WorkflowFilter, number> = { alle: searched.length, offen: 0, rueckstellung: 0, in_klaerung: 0, anwalt: 0, inkasso: 0, erledigt: 0, gebucht: 0 };
    searched.forEach((i) => { c[statusFor(i)]++; });
    return c;
  }, [searched, statusFor]);

  const filtered = useMemo(() => {
    if (wfFilter === 'alle') return searched;
    return searched.filter((i) => statusFor(i) === wfFilter);
  }, [searched, wfFilter, statusFor]);

  const visible = useMemo(() => paginate(filtered, pageSize), [filtered, pageSize]);

  const totals = useMemo(() => {
    const sum = filtered.reduce((acc, i) => acc + (Number(i.balance) || 0), 0);
    const overdue = filtered
      .filter((i) => bucketFor(i.due_date).startsWith('overdue'))
      .reduce((acc, i) => acc + (Number(i.balance) || 0), 0);
    return { sum, overdue, count: filtered.length };
  }, [filtered]);

  // ===== Ansicht: Kundenkonto vs. Rechnungsliste =====
  const [viewMode, setViewMode] = useState<'accounts' | 'list'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('offene_posten_view_mode') as 'accounts' | 'list') || 'list';
  });
  const setViewModePersist = (m: 'accounts' | 'list') => {
    setViewMode(m);
    try { localStorage.setItem('offene_posten_view_mode', m); } catch { /* ignore */ }
  };
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleAccount = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const accounts = useMemo(() => {
    const map = new Map<string, { key: string; name: string; items: OpenItem[]; total: number; balance: number }>();
    filtered.forEach((i) => {
      const name = i.customer_name?.trim() || 'Ohne Kunde';
      const key = name.toLowerCase();
      const acc = map.get(key) ?? { key, name, items: [], total: 0, balance: 0 };
      acc.items.push(i);
      acc.total += Number(i.total) || 0;
      acc.balance += Number(i.balance) || 0;
      map.set(key, acc);
    });
    return Array.from(map.values()).sort((a, b) => b.balance - a.balance);
  }, [filtered]);

  const visibleAccounts = useMemo(() => paginate(accounts, pageSize), [accounts, pageSize]);

  // ===== Markierung & Export =====
  const keyOf = (i: OpenItem) => `${i.source}-${i.id}`;
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const toggleRow = (i: OpenItem) =>
    setSelected((p) => ({ ...p, [keyOf(i)]: !p[keyOf(i)] }));
  const allSelected = filtered.length > 0 && filtered.every((i) => selected[keyOf(i)]);
  const toggleAll = () => {
    if (allSelected) { setSelected({}); return; }
    setSelected(Object.fromEntries(filtered.map((i) => [keyOf(i), true])));
  };
  const toggleAccountSelection = (accItems: OpenItem[], on: boolean) =>
    setSelected((p) => ({ ...p, ...Object.fromEntries(accItems.map((i) => [keyOf(i), on])) }));

  const exportRows = useCallback(() => {
    const base = selectedCount > 0 ? filtered.filter((i) => selected[keyOf(i)]) : filtered;
    return base.map((i) => {
      const days = i.due_date ? differenceInCalendarDays(parseISO(i.due_date), new Date()) : null;
      const wf = workflows[keyOf(i)];
      return {
        Rechnungsnr: i.invoice_number ?? '',
        Referenz: i.reference_number ?? '',
        Kunde: i.customer_name ?? '',
        Ort: i.city ?? '',
        Typ: i.source === 'recurring' ? 'Abo' : 'Rechnung',
        Faellig_am: i.due_date ? format(parseISO(i.due_date), 'dd.MM.yyyy', { locale: de }) : '',
        Tage_ueberfaellig: days !== null && days < 0 ? Math.abs(days) : 0,
        Status: bucketStyles[bucketFor(i.due_date)].label,
        Bearbeitung: bookedRefs[keyOf(i)] ? 'Gebucht' : workflowLabel(wf?.workflow_status ?? 'offen'),
        Notiz: wf?.note ?? '',
        Waehrung: i.currency || 'EUR',
        Gesamt: Number(i.total) || 0,
        Offen: Number(i.balance) || 0,
      };
    });
  }, [filtered, selected, selectedCount, workflows, bookedRefs]);

  const exportBase = () => `offene-posten-${region}-${new Date().toISOString().slice(0, 10)}`;

  const exportCsv = () => {
    const rows = exportRows();
    if (!rows.length) { toast.error('Keine Datensätze zum Export.'); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${exportBase()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} Datensätze als CSV exportiert`);
  };

  const exportExcel = async () => {
    const rows = exportRows();
    if (!rows.length) { toast.error('Keine Datensätze zum Export.'); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Offene Posten');
    XLSX.writeFile(wb, `${exportBase()}.xlsx`);
    toast.success(`${rows.length} Datensätze als Excel exportiert`);
  };

  const exportPdf = async () => {
    const rows = exportRows();
    if (!rows.length) { toast.error('Keine Datensätze zum Export.'); return; }
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Offene Posten · Buchhaltung ${region}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Stand: ${format(new Date(), 'dd.MM.yyyy', { locale: de })} · ${rows.length} Datensätze`, 14, 20);
    const sum = rows.reduce((a, r) => a + r.Offen, 0);
    autoTable(doc, {
      startY: 25,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 30, 30] },
      head: [['Rechnungsnr.', 'Kunde', 'Typ', 'Fällig am', 'Überf. Tage', 'Status', 'Bearbeitung', 'Gesamt', 'Offen']],
      body: rows.map((r) => [
        r.Rechnungsnr, r.Kunde, r.Typ, r.Faellig_am, String(r.Tage_ueberfaellig),
        r.Status, r.Bearbeitung,
        formatCurrency(r.Gesamt, r.Waehrung), formatCurrency(r.Offen, r.Waehrung),
      ]),
      foot: [['', '', '', '', '', '', 'Summe offen', '', formatCurrency(sum, 'EUR')]],
      footStyles: { fillColor: [45, 45, 45] },
    });
    doc.save(`${exportBase()}.pdf`);
    toast.success(`${rows.length} Datensätze als PDF exportiert`);
  };


  const renderRow = (i: OpenItem) => {
    const b = bucketFor(i.due_date);
    const style = bucketStyles[b];
    const days = i.due_date ? differenceInCalendarDays(parseISO(i.due_date), new Date()) : null;
    const wf = workflows[`${i.source}-${i.id}`];
    const wfStatus: WorkflowStatus = wf?.workflow_status ?? 'offen';
    const rowKey = `${i.source}-${i.id}`;
    const booked = bookedRefs[rowKey];
    const isBooking = bookingKey === rowKey;
    return (
      <TableRow key={rowKey} className={style.row}>
        <TableCell className="font-mono">
          <div className="flex items-center gap-1">
            {i.zoho_invoice_id && i.invoice_number ? (
              <button
                type="button"
                onClick={() => openInvoicePdf(i)}
                disabled={pdfLoadingKey === rowKey}
                title="Rechnung als PDF öffnen"
                className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-60"
              >
                {i.invoice_number}
                {pdfLoadingKey === rowKey
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <ExternalLink className="w-3 h-3 opacity-70" />}
              </button>
            ) : (
              <span>{i.invoice_number ?? '—'}</span>
            )}
            {i.source === 'recurring' && (
              <Badge variant="outline" className="ml-1 text-[10px]">Abo</Badge>
            )}
          </div>
        </TableCell>
        <TableCell>{i.customer_name ?? '—'}</TableCell>
        <TableCell>
          {i.due_date ? format(parseISO(i.due_date), 'dd.MM.yyyy', { locale: de }) : '—'}
          {days !== null && (
            <div className="text-xs text-muted-foreground">
              {days < 0 ? `${Math.abs(days)} Tage überfällig` : days === 0 ? 'heute fällig' : `in ${days} Tagen`}
            </div>
          )}
        </TableCell>
        <TableCell>
          <span className={cn('px-2 py-0.5 rounded text-xs', style.badge)}>{style.label}</span>
        </TableCell>
        <TableCell>
          <span className={cn('px-2 py-0.5 rounded text-xs', workflowBadge(wfStatus))}>
            {workflowLabel(wfStatus)}
          </span>
          {wf?.note && (
            <div className="text-xs text-muted-foreground mt-1 max-w-[220px] truncate" title={wf.note}>
              {wf.note}
            </div>
          )}
          {booked && (
            <div className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Gebucht{booked.journal_number ? ` · ${booked.journal_number}` : ''}
            </div>
          )}
        </TableCell>
        <TableCell className="text-right">{formatCurrency(i.total, i.currency)}</TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(i.balance, i.currency)}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant={booked ? 'outline' : 'default'}
                  disabled={isBooking || !!booked}
                  className="gap-1 relative z-10"
                  title={booked ? 'Bereits in Buchhaltung gebucht' : 'Rechnung in Buchhaltung buchen'}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isBooking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookCheck className="w-3.5 h-3.5" />}
                  {booked ? 'Gebucht' : 'Buchen'}
                  {!booked && <ChevronDown className="w-3.5 h-3.5 opacity-70" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[10001]">
                <DropdownMenuLabel>Zahlungsart wählen</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(bookingMethodConfig) as Array<keyof typeof bookingMethodConfig>).map((m) => {
                  const cfg = bookingMethodConfig[m];
                  const Icon = cfg.icon;
                  return (
                    <DropdownMenuItem
                      key={m}
                      onClick={(e) => { e.stopPropagation(); bookItem(i, m); }}
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" /> {cfg.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); openEdit(i); }}
              className="gap-1 relative z-10"
            >
              <Pencil className="w-3.5 h-3.5" /> Bearbeiten
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };



  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          icon={FileText}
          title="Offene Posten"
          subtitle="Alle fälligen Rechnungen, farblich nach Fälligkeit"
          noBreadcrumbs
          meta={<InfinityStatusBadge kind={totals.overdue > 0 ? 'warning' : 'done'} label={`${totals.count} offen`} />}
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Von</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[160px] justify-start text-left font-normal gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {format(dateFrom, 'dd.MM.yyyy', { locale: de })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Bis (optional)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-[160px] justify-start text-left font-normal gap-2', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="w-4 h-4" />
                  {dateTo ? format(dateTo, 'dd.MM.yyyy', { locale: de }) : 'heute'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn('p-3 pointer-events-auto')} />
                {dateTo && (
                  <div className="p-2 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setDateTo(undefined)}>Zurücksetzen</Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Abgleichen & Importieren
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <Button
            variant={viewMode === 'accounts' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => setViewModePersist('accounts')}
          >
            <Users className="w-3.5 h-3.5" /> Nach Kundenkonto
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5"
            onClick={() => setViewModePersist('list')}
          >
            <FileText className="w-3.5 h-3.5" /> Rechnungsliste
          </Button>
        </div>
        {viewMode === 'accounts' && (
          <>
            <Button variant="outline" size="sm" onClick={() => setExpanded(Object.fromEntries(accounts.map((a) => [a.key, true])))}>Alle aufklappen</Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded({})}>Alle zuklappen</Button>
          </>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={viewMode === 'accounts' ? accounts.length : filtered.length}
        visible={viewMode === 'accounts' ? visibleAccounts.length : visible.length}
        placeholder={viewMode === 'accounts' ? 'Suche: Kunde, Rechnungsnr., Stadt, PLZ, Betrag…' : undefined}
      />



      <div className="flex flex-wrap gap-2">
        {([
          { value: 'offen', label: 'Offen', badge: 'bg-muted text-foreground border-border' },
          { value: 'rueckstellung', label: 'Rückstellung', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
          { value: 'in_klaerung', label: 'In Klärung', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
          { value: 'anwalt', label: 'Anwalt', badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
          { value: 'inkasso', label: 'Übergabe Inkasso', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
          { value: 'erledigt', label: 'Erledigt', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
          { value: 'gebucht', label: 'Gebucht', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
          { value: 'alle', label: 'Alle', badge: 'bg-primary/10 text-primary border-primary/30' },
        ] as { value: WorkflowFilter; label: string; badge: string }[]).map((tab) => {
          const active = wfFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setWfFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                active ? tab.badge + ' ring-2 ring-primary/40 scale-105' : 'bg-card text-muted-foreground border-border hover:bg-muted/50',
              )}
            >
              {tab.label} <span className="ml-1 opacity-70">({counts[tab.value] ?? 0})</span>
            </button>
          );
        })}
      </div>

      {(() => {
        const wfLabels: Record<WorkflowFilter, string> = {
          alle: 'Alle',
          offen: 'Offen',
          rueckstellung: 'Rückstellung',
          in_klaerung: 'In Klärung',
          anwalt: 'Anwalt',
          inkasso: 'Übergabe Inkasso',
          erledigt: 'Erledigt',
          gebucht: 'Gebucht',
        };
        const wfLabel = wfLabels[wfFilter];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Posten · {wfLabel}</div>
              <div className="text-2xl font-semibold mt-1">{totals.count}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Betrag · {wfLabel}</div>
              <div className="text-2xl font-semibold mt-1">{formatCurrency(totals.sum, 'EUR')}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">Davon überfällig · {wfLabel}</div>
              <div className="text-2xl font-semibold mt-1 text-destructive">{formatCurrency(totals.overdue, 'EUR')}</div>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-wrap gap-2 text-xs">

        {(Object.keys(bucketStyles) as Bucket[]).map((b) => (
          <span key={b} className={cn('px-2 py-1 rounded', bucketStyles[b].badge)}>{bucketStyles[b].label}</span>
        ))}
      </div>


      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lade…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Keine offenen Posten gefunden.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rechnung</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Fällig am</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bearbeitung</TableHead>
                <TableHead className="text-right">Gesamt</TableHead>
                <TableHead className="text-right">Offen</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewMode === 'list'
                ? visible.map((i) => renderRow(i))
                : visibleAccounts.map((a) => (
                    <Fragment key={a.key}>
                      <TableRow className="bg-muted/40 cursor-pointer" onClick={() => toggleAccount(a.key)}>
                        <TableCell colSpan={5}>
                          <div className="flex items-center gap-2 font-medium">
                            <ChevronDown className={cn('w-4 h-4 transition-transform', !expanded[a.key] && '-rotate-90')} />
                            <Users className="w-4 h-4 text-primary" />
                            {a.name}
                            <Badge variant="outline" className="text-[10px]">{a.items.length} Rechnungen</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(a.total, 'EUR')}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(a.balance, 'EUR')}</TableCell>
                        <TableCell />
                      </TableRow>
                      {expanded[a.key] && a.items.map((i) => renderRow(i))}
                    </Fragment>
                  ))}
            </TableBody>

          </Table>
        )}
      </div>

      {editItem && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={closeEdit}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-item-edit-title"
            aria-describedby="open-item-edit-description"
            className="relative grid w-full max-w-lg gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Schließen"
              onClick={closeEdit}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={saving}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1.5 pr-10">
              <h2 id="open-item-edit-title" className="text-lg font-semibold leading-none tracking-tight">
                Offenen Posten bearbeiten
              </h2>
              <p id="open-item-edit-description" className="text-sm text-muted-foreground">
                {editItem.invoice_number} · {editItem.customer_name}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="open-item-workflow-status">Bearbeitungsstatus</Label>
                <select
                  id="open-item-workflow-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as WorkflowStatus)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {workflowOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="open-item-workflow-note">Notiz</Label>
                <Textarea
                  id="open-item-workflow-note"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  rows={4}
                  placeholder="Optionale Notiz zur Bearbeitung…"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeEdit} disabled={saving}>Abbrechen</Button>
              <Button onClick={saveEdit} disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}Speichern
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
