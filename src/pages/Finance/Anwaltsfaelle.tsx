import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Gavel, Search, Loader2, Inbox, ArrowUpDown, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';
import { useAtOnly } from '@/hooks/useAtOnly';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';

type SortField = 'order_number' | 'order_date' | 'expected_shipment_date' | 'total_amount';
type SortDir = 'asc' | 'desc';
type PageSize = 20 | 50 | 100 | 'all';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const SOURCE_LABEL: Record<string, string> = {
  zoho_eu_1: 'Alix Deutschland 🇩🇪',
  zoho_eu_2: 'Alix Austria 🇦🇹',
};

/**
 * Reine Übersichtsseite (read-only) aller Aufträge mit Status „Anwalt".
 * Untermenü von BUCHHALTUNG.
 */
export default function FinanceAnwaltsfaelle() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [salesFilter, setSalesFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const navigate = useNavigate();
  const atOnly = useAtOnly();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      let q = supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, source_system, lawyer_reason, salesperson_name, internal_number, customers(company_name, contact_name, city, zip_code)')
        .ilike('order_status', 'anwalt')
        .order(sortField, { ascending: sortDir === 'asc' })
        .limit(1000);
      if (atOnly) q = q.eq('source_system', 'zoho_eu_2');
      const { data, error: err } = await q;
      if (cancelled) return;
      if (err) setError(err.message);
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [sortField, sortDir, atOnly]);

  const reasons = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => { if (o.lawyer_reason) s.add(o.lawyer_reason); });
    return Array.from(s).sort();
  }, [orders]);

  const salespeople = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => { if (o.salesperson_name) s.add(o.salesperson_name); });
    return Array.from(s).sort();
  }, [orders]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    orders.forEach((o) => { if (o.source_system) s.add(o.source_system); });
    return Array.from(s).sort();
  }, [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    if (reasonFilter !== 'all') {
      if (reasonFilter === '__none__') { if (o.lawyer_reason) return false; }
      else if (o.lawyer_reason !== reasonFilter) return false;
    }
    if (sourceFilter !== 'all' && o.source_system !== sourceFilter) return false;
    if (salesFilter !== 'all') {
      if (salesFilter === '__none__') { if (o.salesperson_name) return false; }
      else if (o.salesperson_name !== salesFilter) return false;
    }
    if (dateFrom && (!o.order_date || o.order_date < dateFrom)) return false;
    if (dateTo && (!o.order_date || o.order_date > dateTo)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      o.order_number, o.internal_number, o.lawyer_reason, o.salesperson_name,
      o.customers?.company_name, o.customers?.contact_name, o.customers?.city, o.customers?.zip_code,
      o.total_amount != null ? String(o.total_amount) : '',
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }), [orders, search, reasonFilter, sourceFilter, salesFilter, dateFrom, dateTo]);

  const visible = useMemo(() => (pageSize === 'all' ? filtered : filtered.slice(0, pageSize)), [filtered, pageSize]);
  const sum = useMemo(() => filtered.reduce((a, o) => a + (Number(o.total_amount) || 0), 0), [filtered]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="text-left px-4 py-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && <ArrowUpDown className="w-3 h-3 text-primary" />}
      </span>
    </th>
  );

  const downloadCSV = () => {
    const headers = ['Auftragsnr.', 'Grund', 'Kunde', 'Kontakt', 'PLZ', 'Stadt', 'Verkäufer', 'Auftragsdatum', 'Lieferdatum', 'Betrag', 'Währung', 'Quelle'];
    const lines = [headers.join(';')];
    filtered.forEach((o) => {
      const cells = [
        o.order_number || '', o.lawyer_reason || '',
        o.customers?.company_name || '', o.customers?.contact_name || '',
        o.customers?.zip_code || '', o.customers?.city || '',
        o.salesperson_name || '',
        formatDate(o.order_date), formatDate(o.expected_shipment_date),
        o.total_amount != null ? Number(o.total_amount).toFixed(2).replace('.', ',') : '',
        o.currency || '', SOURCE_LABEL[o.source_system] || o.source_system || '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(';'));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anwaltsfaelle_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const doc = createPDF({ orientation: 'landscape' });
    doc.setFont('Inter', 'bold');
    doc.setFontSize(14);
    doc.text('Anwaltsfälle', 14, 14);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    doc.text(`${filtered.length} Aufträge · Summe ${sum.toLocaleString('de-DE', { minimumFractionDigits: 2 })} € · ${new Date().toLocaleDateString('de-DE')}`, 14, 20);
    autoTable(doc, {
      startY: 24,
      styles: { font: 'Inter', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      head: [['Auftragsnr.', 'Grund', 'Kunde', 'Kontakt', 'Ort', 'Verkäufer', 'Auftragsdatum', 'Betrag']],
      body: filtered.map((o) => [
        o.order_number || '', o.lawyer_reason || '—',
        o.customers?.company_name || '—', o.customers?.contact_name || '—',
        [o.customers?.zip_code, o.customers?.city].filter(Boolean).join(' ') || '—',
        o.salesperson_name || '—',
        formatDate(o.order_date),
        o.total_amount != null ? `${Number(o.total_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—',
      ]),
    });
    doc.save(`anwaltsfaelle_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <PageHeader
        icon={Gavel}
        title="Anwaltsfälle"
        subtitle={`Übersicht aller Aufträge mit Status „Anwalt" · ${filtered.length} von ${orders.length}`}
        noBreadcrumbs
        meta={<InfinityStatusBadge kind="warning" label={`${filtered.length}`} />}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default">
                <Download className="w-4 h-4 mr-2" /> Export ({filtered.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={downloadCSV}><FileSpreadsheet className="w-4 h-4 mr-2" /> Als CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPDF}><FileText className="w-4 h-4 mr-2" /> Als PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Fälle</div>
          <div className="text-2xl font-semibold">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Volumen gesamt</div>
          <div className="text-2xl font-semibold">{sum.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">Gründe</div>
          <div className="text-2xl font-semibold">{reasons.length}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche: Auftragsnr., Kunde, Kontakt, PLZ, Stadt, Grund, Verkäufer, Betrag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-secondary border-border"
            />
          </div>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-full lg:w-[210px] bg-secondary border-border"><SelectValue placeholder="Grund" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Gründe</SelectItem>
              <SelectItem value="__none__">Ohne Grund</SelectItem>
              {reasons.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={salesFilter} onValueChange={setSalesFilter}>
            <SelectTrigger className="w-full lg:w-[190px] bg-secondary border-border"><SelectValue placeholder="Verkäufer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Verkäufer</SelectItem>
              <SelectItem value="__none__">Ohne Verkäufer</SelectItem>
              {salespeople.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full lg:w-[190px] bg-secondary border-border"><SelectValue placeholder="Quelle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Mandanten</SelectItem>
              {sources.map((s) => <SelectItem key={s} value={s}>{SOURCE_LABEL[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Auftragsdatum von</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-secondary border-border w-[160px]" />
            <span className="text-xs text-muted-foreground">bis</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-secondary border-border w-[160px]" />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Anzeige:</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'all' ? 'all' : (Number(v) as PageSize))}>
              <SelectTrigger className="w-[110px] bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setReasonFilter('all'); setSourceFilter('all'); setSalesFilter('all'); setDateFrom(''); setDateTo(''); }}
            >
              Filter zurücksetzen
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <SortHeader field="order_number" label="Auftragsnr." />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Grund</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kontakt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Ort</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Verkäufer</th>
                <SortHeader field="order_date" label="Auftragsdatum" />
                <SortHeader field="expected_shipment_date" label="Lieferdatum" />
                <SortHeader field="total_amount" label="Betrag" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Anwaltsfälle gefunden.</p>
                </td></tr>
              ) : visible.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/auftraege/${o.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{o.order_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.lawyer_reason || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.customers?.contact_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{[o.customers?.zip_code, o.customers?.city].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.salesperson_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(o.order_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_shipment_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.total_amount != null ? `${Number(o.total_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.order_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageSize !== 'all' && filtered.length > visible.length && (
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border bg-secondary/20">
            Zeige {visible.length} von {filtered.length} Fällen
          </div>
        )}
      </div>
    </div>
  );
}
