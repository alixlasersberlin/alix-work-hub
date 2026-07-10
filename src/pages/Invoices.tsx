import { useEffect, useMemo, useState } from 'react';
import { maskRevenueString } from '@/lib/revenue-mask';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { FileText, RefreshCw, ArrowRightLeft, ChevronDown, ChevronRight, Users, Wallet, AlertTriangle, Repeat, Pencil, Printer, Download, Loader2, Trash2, Mail, CheckCircle2, X as LucideXIcon } from 'lucide-react';
import { postPaymentToJournal } from '@/lib/finance/journal';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ListToolbar } from '@/components/finance/ListToolbar';
import { matchesQuery, paginate, type PageSize } from '@/lib/finance/list-filter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  source: 'invoice' | 'recurring';
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

function isDraftInvoice(r: Pick<Row, 'status' | 'payment_status' | 'raw_data'>) {
  const status = String(r.status ?? '').toLowerCase();
  const paymentStatus = String(r.payment_status ?? '').toLowerCase();
  return status === 'draft' || status === 'entwurf' || paymentStatus === 'entwurf' || r.raw_data?.is_draft === true;
}

function flatRowsForKpi(rows: Row[], search: string, statusFilter: string): number {
  let res = rows;
  if (statusFilter !== 'all') {
    res = res.filter((r) => (r.payment_status ?? '').toLowerCase() === statusFilter.toLowerCase());
  }
  res = res.filter((r) => matchesQuery(r, search));
  return res.reduce((s, r) => s + Number(r.balance ?? 0), 0);
}

export default function Invoices() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes('Super Admin');
  const isAdmin = roles.includes('Admin') || isSuperAdmin;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ reference_number: '', due_date: '', payment_status: '', invoice_number: '', customer_name: '', invoice_date: '', total: '', balance: '', status: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [emailRow, setEmailRow] = useState<Row | null>(null);
  const [emailForm, setEmailForm] = useState({ to_email: '', to_name: '', subject: '', body_text: '' });
  const [emailSending, setEmailSending] = useState(false);
  const [emailPreparing, setEmailPreparing] = useState(false);
  const [bookRow, setBookRow] = useState<Row | null>(null);
  const [bookMethod, setBookMethod] = useState<'Überweisung' | 'Bar' | 'Lastschrift' | 'SEPA'>('Überweisung');
  const [bookDate, setBookDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [bookSaving, setBookSaving] = useState(false);
  const [bookAmount, setBookAmount] = useState<string>('0');
  const [viewMode, setViewMode] = useState<'accounts' | 'list'>(() => {
    if (typeof window === 'undefined') return 'accounts';
    return (localStorage.getItem('invoices_view_mode') as 'accounts' | 'list') || 'accounts';
  });
  const [listSort, setListSort] = useState<'number' | 'date'>(() => {
    if (typeof window === 'undefined') return 'date';
    return (localStorage.getItem('invoices_list_sort') as 'number' | 'date') || 'date';
  });
  const setViewModePersist = (m: 'accounts' | 'list') => {
    setViewMode(m); try { localStorage.setItem('invoices_view_mode', m); } catch {}
  };
  const setListSortPersist = (s: 'number' | 'date') => {
    setListSort(s); try { localStorage.setItem('invoices_list_sort', s); } catch {}
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    const cols = 'id, zoho_invoice_id, source_system, invoice_number, reference_number, customer_id, customer_name, city, invoice_date, due_date, total, balance, currency, status, payment_status, last_payment_date, raw_data';
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

  // Realtime: aktualisiere Offene Beträge live, sobald sich Rechnungen ändern
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { fetchRows(); }, 400);
    };
    const channel = supabase
      .channel('invoices-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zoho_invoices' }, trigger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zoho_recurring_invoices' }, trigger)
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, []);

  const accounts = useMemo<Account[]>(() => {
    let res = rows;
    if (statusFilter !== 'all') {
      res = res.filter((r) => (r.payment_status ?? '').toLowerCase() === statusFilter.toLowerCase());
    }
    res = res.filter((r) => matchesQuery(r, search));
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
    // Offene Beträge = Live-Summe der Salden aller aktuell sichtbaren Rechnungen
    totalOpen: flatRowsForKpi(rows, search, statusFilter),
  }), [accounts, rows, search, statusFilter]);

  const flatRows = useMemo<Row[]>(() => {
    let res = rows;
    if (statusFilter !== 'all') {
      res = res.filter((r) => (r.payment_status ?? '').toLowerCase() === statusFilter.toLowerCase());
    }
    res = res.filter((r) => matchesQuery(r, search));
    const sorted = [...res].sort((a, b) => {
      if (listSort === 'number') {
        return String(b.invoice_number ?? '').localeCompare(String(a.invoice_number ?? ''), 'de', { numeric: true });
      }
      return String(b.invoice_date ?? '').localeCompare(String(a.invoice_date ?? ''));
    });
    return sorted;
  }, [rows, search, statusFilter, listSort]);

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
    if (!confirm(`Rechnung ${r.invoice_number ?? ''} unwiderruflich löschen?`)) return;
    try {
      const table = r.source === 'recurring' ? 'zoho_recurring_invoices' : 'zoho_invoices';
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
    const billing = customer?.billing_address || customer?.shipping_address || null;
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
    if (addressLines.length === 0 && full.billing_address) {
      String(full.billing_address).split('\n').forEach((l) => { if (l) { doc.text(l, LEFT, y); y += 4.4; } });
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
        'Alix Lasers GmbH  ·  Buchsbaumweg 53  ·  12357 Berlin  ·  Deutschland  ·  Telefon: +49 30 577 127 45  ·  Fax: +49 30 577 127 46',
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

    return doc.output('blob') as Blob;
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
      return new Blob([bytes], { type: 'application/pdf' });
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

  const commitDraft = async (r: Row) => {
    if (!isDraftInvoice(r)) return;
    try {
      const table = r.source === 'recurring' ? 'zoho_recurring_invoices' : 'zoho_invoices';
      const raw = r.raw_data && typeof r.raw_data === 'object' && !Array.isArray(r.raw_data) ? (r.raw_data as any) : {};
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
    setEditSaving(true);
    try {
      const table = editRow.source === 'recurring' ? 'zoho_recurring_invoices' : 'zoho_invoices';
      const patch: any = {
        reference_number: editForm.reference_number || null,
        due_date: editForm.due_date || null,
        payment_status: editForm.payment_status || null,
      };
      if (editForm.status) {
        patch.status = editForm.status;
        const raw = editRow.raw_data && typeof editRow.raw_data === 'object' && !Array.isArray(editRow.raw_data) ? editRow.raw_data : {};
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

  const openEmail = async (r: Row) => {
    setEmailPreparing(true);
    setEmailRow(r);
    setEmailForm({
      to_email: '',
      to_name: r.customer_name ?? '',
      subject: `Rechnung ${r.invoice_number ?? ''}`.trim(),
      body_text: `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Rechnung ${r.invoice_number ?? ''}${r.reference_number ? ` zum Auftrag ${r.reference_number}` : ''}.\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen\nAlix Lasers`,
    });
    try {
      if (r.customer_id) {
        const { data: c } = await supabase
          .from('customers')
          .select('email, contact_name, company_name')
          .eq('external_customer_id', r.customer_id)
          .maybeSingle();
        if (c) {
          setEmailForm((f) => ({
            ...f,
            to_email: c.email ?? '',
            to_name: c.company_name ?? c.contact_name ?? f.to_name,
          }));
        }
      }
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
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const b64 = btoa(binary);
      const { data, error } = await supabase.functions.invoke('send-mail', {
        body: {
          to_email: emailForm.to_email,
          to_name: emailForm.to_name || null,
          from_email: 'finance@alixwork.de',
          from_name: 'Alix Lasers Finance',
          subject: emailForm.subject,
          body_text: emailForm.body_text,
          body_html: `<pre style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;margin:0">${emailForm.body_text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string))}</pre>`,
          invoice_id: emailRow.zoho_invoice_id ?? null,
          customer_id: emailRow.customer_id ?? null,
          category: 'finance',
          attachments: [{
            filename: `${emailRow.invoice_number ?? 'rechnung'}.pdf`,
            content: b64,
            contentType: 'application/pdf',
          }],
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'E-Mail versendet', description: `Rechnung ${emailRow.invoice_number ?? ''} an ${emailForm.to_email}` });
      setEmailRow(null);
    } catch (e: any) {
      toast({ title: 'Versand fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setEmailSending(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress('Starte Import…');
    try {
      let page = 1;
      let totalImported = 0, totalUpdated = 0, totalFailed = 0, totalSkipped = 0, totalDuplicates = 0;
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
        totalDuplicates += data?.duplicates ?? 0;
        setProgress(`Seite ${page} • Neu: ${totalImported} • Aktualisiert: ${totalUpdated} • Duplikate: ${totalDuplicates} • SEPA übersprungen: ${totalSkipped}`);
        if (!data?.has_more) break;
        page = (data?.last_page ?? page) + 1;
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast({
        title: 'Import abgeschlossen',
        description: `Neu: ${totalImported} • Aktualisiert: ${totalUpdated} • Duplikate übersprungen: ${totalDuplicates} • SEPA übersprungen: ${totalSkipped} • Fehler: ${totalFailed}`,
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
      const table = bookRow.source === 'recurring' ? 'zoho_recurring_invoices' : 'zoho_invoices';
      const patch: any = {
        payment_status: fullyPaid ? 'Bezahlt' : 'Teilweise bezahlt',
        balance: newBalance,
        last_payment_date: bookDate,
      };
      const { error } = await (supabase as any).from(table).update(patch).eq('id', bookRow.id);
      if (error) throw error;

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
        source_id: `${bookRow.id}:${bookDate}:${Date.now()}`,
        vorgang: 'Zahlung',
        payment_method: bookMethod,
      });
      if (!jr.ok) throw new Error(jr.error || 'Journal-Buchung fehlgeschlagen');

      setRows((prev) => prev.map((x) => (x.id === bookRow.id && x.source === bookRow.source
        ? { ...x, payment_status: patch.payment_status, balance: newBalance, last_payment_date: bookDate }
        : x)));
      toast({ title: 'Gebucht', description: `Zahlung ${fmtMoney(gross, bookRow.currency)} für Rechnung ${bookRow.invoice_number ?? ''} verbucht.${fullyPaid ? '' : ` Restsaldo: ${fmtMoney(newBalance, bookRow.currency)}`}` });
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
        title={viewMode === 'accounts' ? 'Rechnungen nach Kundenkonto' : 'Rechnungsliste'}
        subtitle={viewMode === 'accounts' ? 'Konsolidierte Übersicht aller Zoho-Rechnungen (einmalig + periodisch) je Kunde' : 'Alle Rechnungen sortiert nach Datum oder Rechnungsnummer'}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind={loading ? 'progress' : 'done'} label={loading ? 'Lädt' : `${kpi.accounts} Konten`} pulse={loading} />}
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

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-secondary p-0.5">
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
        </div>
        {viewMode === 'list' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sortierung:</span>
            <Select value={listSort} onValueChange={(v) => setListSortPersist(v as 'number' | 'date')}>
              <SelectTrigger className="w-[220px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Datum (absteigend)</SelectItem>
                <SelectItem value="number">Rechnungsnummer (absteigend)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={viewMode === 'accounts' ? accounts.length : flatRows.length}
        visible={Math.min(
          viewMode === 'accounts' ? accounts.length : flatRows.length,
          pageSize === 'all' ? (viewMode === 'accounts' ? accounts.length : flatRows.length) : pageSize,
        )}
        placeholder="Suche: Rechnungsnr., Auftragsnr., Name, Stadt, PLZ, Betrag…"
      >
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
        {viewMode === 'accounts' && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={expandAll}>Alle öffnen</Button>
            <Button size="sm" variant="outline" onClick={collapseAll}>Alle schließen</Button>
          </div>
        )}
      </ListToolbar>
      {progress && <div className="text-xs text-primary mb-3">{progress}</div>}

      {error && <PageError message={error} onRetry={fetchRows} />}

      {loading ? <DataCard><SkeletonTable rows={8} cols={6} /></DataCard> : viewMode === 'list' ? (
        <DataCard className="overflow-hidden">
          {flatRows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Keine Daten gefunden.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Typ</th>
                    <th className="text-left px-4 py-2 font-medium">Rechnung</th>
                    <th className="text-left px-4 py-2 font-medium">Kunde</th>
                    <th className="text-left px-4 py-2 font-medium">Referenz</th>
                    <th className="text-left px-4 py-2 font-medium">Datum</th>
                    <th className="text-left px-4 py-2 font-medium">Fällig</th>
                    <th className="text-right px-4 py-2 font-medium">Betrag</th>
                    <th className="text-right px-4 py-2 font-medium">Saldo</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-right px-4 py-2 font-medium">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {paginate(flatRows, pageSize).map((r) => (
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
                      <td className="px-4 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          <span>{r.invoice_number ?? '–'}</span>
                          {isDraftInvoice(r) && (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/40 text-[10px] uppercase tracking-wide">
                              Entwurf
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="truncate max-w-[220px]">{r.customer_name ?? '–'}</div>
                        {r.city && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{r.city}</div>}
                      </td>
                      <td className="px-4 py-2">{r.reference_number ?? '–'}</td>
                      <td className="px-4 py-2">{fmtDate(r.invoice_date)}</td>
                      <td className="px-4 py-2">{fmtDate(r.due_date)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.total, r.currency)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtMoney(r.balance, r.currency)}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={statusVariant(r.payment_status)}>
                          {r.payment_status ?? '–'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
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
                          <Button
                            size="sm"
                            variant="outline"
                            title="Rechnung per E-Mail versenden"
                            className="h-8 px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                            onClick={() => openEmail(r)}
                          >
                            <Mail className="w-3.5 h-3.5" /> Rechnung/Email
                          </Button>
                          {isSuperAdmin && (
                            <Button size="sm" variant="ghost" title="Löschen" className="text-destructive hover:text-destructive" onClick={() => handleDelete(r)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataCard>
      ) : (
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <DataCard className="p-12 text-center text-muted-foreground">
              Keine Daten gefunden.
            </DataCard>
          ) : paginate(accounts, pageSize).map((a) => {
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
                          <th className="text-right px-4 py-2 font-medium">Aktion</th>
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
                            <td className="px-4 py-2 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{r.invoice_number ?? '–'}</span>
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
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {isAdmin && (
                                  <Button size="sm" variant="ghost" title="Bearbeiten" onClick={(event) => handleEditClick(event, r)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Drucken"
                                  disabled={pdfLoadingId === r.id}
                                  onClick={() => handlePrint(r)}
                                >
                                  {pdfLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Download PDF"
                                  disabled={pdfLoadingId === r.id}
                                  onClick={() => handleDownload(r)}
                                >
                                  {pdfLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                </Button>
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  title="Rechnung per E-Mail versenden"
                                  className="h-8 px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                                  onClick={() => openEmail(r)}
                                >
                                  <Mail className="w-3.5 h-3.5" /> Rechnung/Email
                                </Button>
                                {isAdmin && r.source === 'invoice' && (
                                  <Button size="sm" variant="outline" onClick={() => handleMove(r)}>
                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Ratenzahler
                                  </Button>
                                )}
                                {isSuperAdmin && (
                                  <Button size="sm" variant="ghost" title="Löschen" className="text-destructive hover:text-destructive" onClick={() => handleDelete(r)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
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

      <Dialog open={!!emailRow} onOpenChange={(o) => !o && !emailSending && setEmailRow(null)}>
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
              <Label htmlFor="msub">Betreff</Label>
              <Input id="msub" value={emailForm.subject} onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="mbody">Nachricht</Label>
              <Textarea id="mbody" rows={8} value={emailForm.body_text} onChange={(e) => setEmailForm((f) => ({ ...f, body_text: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              Absender: <span className="font-mono">finance@alixwork.de</span> · Die Rechnung wird automatisch als PDF im Anhang beigefügt.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailRow(null)} disabled={emailSending}>Abbrechen</Button>
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
    </div>
  );
}
