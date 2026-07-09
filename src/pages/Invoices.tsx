import { useEffect, useMemo, useState } from 'react';
import { maskRevenueString } from '@/lib/revenue-mask';
import { supabase } from '@/integrations/supabase/client';
import { DataCard, PageError } from '@/components/PageShell';
import { PageHeader } from '@/components/infinity/PageHeader';
import { SkeletonTable } from '@/components/infinity/Skeleton';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { FileText, RefreshCw, ArrowRightLeft, ChevronDown, ChevronRight, Users, Wallet, AlertTriangle, Repeat, Pencil, Printer, Download, Loader2 } from 'lucide-react';
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
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ reference_number: '', due_date: '', payment_status: '' });
  const [editSaving, setEditSaving] = useState(false);
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
    const cols = 'id, zoho_invoice_id, source_system, invoice_number, reference_number, customer_id, customer_name, city, invoice_date, due_date, total, balance, currency, status, payment_status, last_payment_date';
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
    totalOpen: accounts.reduce((s, a) => s + a.totalOpen, 0),
  }), [accounts]);

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
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
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
    });
  };

  const saveEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const table = editRow.source === 'recurring' ? 'zoho_recurring_invoices' : 'zoho_invoices';
      const { error } = await supabase.from(table).update({
        reference_number: editForm.reference_number || null,
        due_date: editForm.due_date || null,
        payment_status: editForm.payment_status || null,
      }).eq('id', editRow.id);
      if (error) throw error;
      setRows((prev) => prev.map((x) => x.id === editRow.id && x.source === editRow.source ? {
        ...x,
        reference_number: editForm.reference_number || null,
        due_date: editForm.due_date || null,
        payment_status: editForm.payment_status || null,
      } : x));
      toast({ title: 'Gespeichert', description: `Rechnung ${editRow.invoice_number ?? ''} aktualisiert.` });
      setEditRow(null);
    } catch (e: any) {
      toast({ title: 'Speichern fehlgeschlagen', description: e?.message ?? 'Unbekannter Fehler', variant: 'destructive' });
    } finally {
      setEditSaving(false);
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
        icon={FileText}
        title="Rechnungen nach Kundenkonto"
        subtitle="Konsolidierte Übersicht aller Zoho-Rechnungen (einmalig + periodisch) je Kunde"
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

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        total={accounts.length}
        visible={Math.min(accounts.length, pageSize === 'all' ? accounts.length : pageSize)}
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={expandAll}>Alle öffnen</Button>
          <Button size="sm" variant="outline" onClick={collapseAll}>Alle schließen</Button>
        </div>
      </ListToolbar>
      {progress && <div className="text-xs text-primary mb-3">{progress}</div>}

      {error && <PageError message={error} onRetry={fetchRows} />}

      {loading ? <DataCard><SkeletonTable rows={8} cols={6} /></DataCard> : (
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
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                {isAdmin && (
                                  <Button size="sm" variant="ghost" title="Bearbeiten" onClick={() => openEdit(r)}>
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
                                {isAdmin && r.source === 'invoice' && (
                                  <Button size="sm" variant="outline" onClick={() => handleMove(r)}>
                                    <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Ratenzahler
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

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechnung {editRow?.invoice_number ?? ''} bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
              <Select value={editForm.payment_status || undefined} onValueChange={(v) => setEditForm((f) => ({ ...f, payment_status: v }))}>
                <SelectTrigger id="ps"><SelectValue placeholder="Status wählen" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Offen">Offen</SelectItem>
                  <SelectItem value="Bezahlt">Bezahlt</SelectItem>
                  <SelectItem value="Teilweise bezahlt">Teilweise bezahlt</SelectItem>
                  <SelectItem value="Überfällig">Überfällig</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Hinweis: Änderungen wirken lokal in Alix Work. Ein Sync nach Zoho erfolgt hier nicht automatisch.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Abbrechen</Button>
            <Button onClick={saveEdit} disabled={editSaving} className="gold-gradient text-primary-foreground">
              {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
