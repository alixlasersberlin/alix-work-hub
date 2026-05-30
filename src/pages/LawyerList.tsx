import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Gavel, Search, Loader2, Inbox, ArrowUpDown, Pencil, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import OrderStatsBar from '@/components/OrderStatsBar';
import OrderEditDialog from '@/components/OrderEditDialog';
import { useAuth } from '@/hooks/useAuth';
import { useAtOnly } from '@/hooks/useAtOnly';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';

type SortField = 'order_number' | 'expected_shipment_date' | 'total_amount';
type SortDir = 'asc' | 'desc';
type PageSize = 10 | 20 | 50 | 'all';

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function LawyerList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('order_number');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole('Admin') || hasRole('Super Admin') || hasRole('Auftragsverwaltung');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: err } = await supabase
        .from('orders')
        .select('id, order_number, order_status, order_date, expected_shipment_date, total_amount, currency, source_system, lawyer_reason, salesperson_name, internal_number, customers(company_name, contact_name)')
        .ilike('order_status', 'anwalt')
        .order(sortField, { ascending: sortDir === 'asc' })
        .limit(500);
      if (err) setError(err.message);
      setOrders(data ?? []);
      setLoading(false);
    }
    load();
  }, [sortField, sortDir, reloadKey]);

  const reasons = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.lawyer_reason) set.add(o.lawyer_reason); });
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => orders.filter(o => {
    if (reasonFilter !== 'all') {
      if (reasonFilter === '__none__') {
        if (o.lawyer_reason) return false;
      } else if (o.lawyer_reason !== reasonFilter) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q)
    );
  }), [orders, search, reasonFilter]);

  const visible = useMemo(() => pageSize === 'all' ? filtered : filtered.slice(0, pageSize), [filtered, pageSize]);

  const allVisibleSelected = visible.length > 0 && visible.every(o => selected.has(o.id));
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach(o => next.delete(o.id));
      else visible.forEach(o => next.add(o.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
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

  const getDownloadRows = () => {
    const sel = selected.size > 0 ? filtered.filter(o => selected.has(o.id)) : filtered;
    return sel;
  };

  const downloadCSV = () => {
    const rows = getDownloadRows();
    const headers = ['Auftragsnr.', 'Grund', 'Kunde', 'Kontakt', 'Auftragsdatum', 'Lieferdatum', 'Betrag', 'Währung', 'Status'];
    const lines = [headers.join(';')];
    rows.forEach(o => {
      const cells = [
        o.order_number || '',
        o.lawyer_reason || '',
        o.customers?.company_name || '',
        o.customers?.contact_name || '',
        formatDate(o.order_date),
        formatDate(o.expected_shipment_date),
        o.total_amount != null ? Number(o.total_amount).toFixed(2).replace('.', ',') : '',
        o.currency || '',
        o.order_status || '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(';'));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anwaltsfaelle_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const rows = getDownloadRows();
    const doc = createPDF({ orientation: 'landscape' });
    doc.setFont('Inter', 'bold');
    doc.setFontSize(14);
    doc.text('Anwaltsfälle', 14, 14);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    doc.text(`${rows.length} Fälle · ${new Date().toLocaleDateString('de-DE')}`, 14, 20);
    autoTable(doc, {
      startY: 24,
      styles: { font: 'Inter', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      head: [['Auftragsnr.', 'Grund', 'Kunde', 'Kontakt', 'Auftragsdatum', 'Lieferdatum', 'Betrag', 'Status']],
      body: rows.map(o => [
        o.order_number || '',
        o.lawyer_reason || '—',
        o.customers?.company_name || '—',
        o.customers?.contact_name || '—',
        formatDate(o.order_date),
        formatDate(o.expected_shipment_date),
        o.total_amount != null ? `${Number(o.total_amount).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—',
        o.order_status || '',
      ]),
    });
    doc.save(`anwaltsfaelle_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const selectionCount = selected.size;

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Gavel className="w-6 h-6 text-primary" />
            Anwaltsliste
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} Fälle mit Status „Anwalt"{selectionCount > 0 && ` · ${selectionCount} ausgewählt`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default">
              <Download className="w-4 h-4 mr-2" />
              Download {selectionCount > 0 ? `(${selectionCount})` : `(${filtered.length})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={downloadCSV}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Als CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={downloadPDF}>
              <FileText className="w-4 h-4 mr-2" /> Als PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-full sm:w-[220px] bg-secondary border-border">
            <SelectValue placeholder="Grund filtern" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Gründe</SelectItem>
            <SelectItem value="__none__">Ohne Grund</SelectItem>
            {reasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(v === 'all' ? 'all' : Number(v) as PageSize)}>
          <SelectTrigger className="w-full sm:w-[140px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 anzeigen</SelectItem>
            <SelectItem value="20">20 anzeigen</SelectItem>
            <SelectItem value="50">50 anzeigen</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        {selectionCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Auswahl leeren</Button>
        )}
      </div>

      <OrderStatsBar orders={orders} filteredCount={filtered.length} label="Anwaltsfälle" />

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Alle auswählen" />
                </th>
                <SortHeader field="order_number" label="Auftragsnr." />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Grund</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kontakt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftragsdatum</th>
                <SortHeader field="expected_shipment_date" label="Lieferdatum" />
                <SortHeader field="total_amount" label="Betrag" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Fälle gefunden.</p>
                </td></tr>
              ) : (
                visible.map(o => (
                  <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleOne(o.id)} aria-label={`Auswahl ${o.order_number}`} />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground cursor-pointer" onClick={() => navigate(`/auftraege/${o.id}`)}>{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.lawyer_reason || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customers?.contact_name || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.order_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(o.expected_shipment_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.total_amount != null ? `${o.total_amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${o.currency || '€'}` : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.order_status} /></td>
                    <td className="px-4 py-3 text-right">
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditOrder(o); }}>
                          <Pencil className="w-3 h-3 mr-1" /> Bearbeiten
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pageSize !== 'all' && filtered.length > visible.length && (
          <div className="px-4 py-3 text-xs text-muted-foreground border-t border-border bg-secondary/20">
            Zeige {visible.length} von {filtered.length} Fällen
          </div>
        )}
      </div>

      {editOrder && (
        <OrderEditDialog
          order={editOrder}
          open={!!editOrder}
          onClose={() => setEditOrder(null)}
          onSaved={() => setReloadKey(k => k + 1)}
        />
      )}
    </div>
  );
}
