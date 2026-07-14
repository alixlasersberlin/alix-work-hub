import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { sendCustomerShippingNotice } from '@/lib/send-customer-shipping-notice';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, ClipboardList, ArrowUpDown, Loader2, Inbox, CalendarDays, List, Car, Pencil, CalendarClock, MoveRight, CheckCircle2, PackageCheck, FileDown, FileText, Send, Copy, XCircle, Zap } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { createPDF } from '@/lib/pdf-utils';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import OrdersCalendar from '@/components/OrdersCalendar';
import OrderEditDialog from '@/components/OrderEditDialog';
import OrderDeferDialog from '@/components/OrderDeferDialog';
import OrderItemsEditDialog from '@/components/OrderItemsEditDialog';
import { Package } from 'lucide-react';
import OrderStatsBar from '@/components/OrderStatsBar';
import { VipBadge } from '@/components/VipBadge';
import { isOrderVip, vipFirst } from '@/lib/vip';
import { useDrivingTimes } from '@/hooks/useDrivingTimes';
import { DrivingTimeCell } from '@/components/DrivingTimeCell';
import { ViewToggle } from '@/components/ViewToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { OrderCard, OrderCardGrid } from '@/components/OrderCard';
import { ALIX_MODEL_GROUPS } from '@/lib/alix-models';
import { withAt } from '@/lib/atSuffix';
import { useAtOnly } from '@/hooks/useAtOnly';
import { PageHeader } from '@/components/infinity/PageHeader';
import { InfinityStatusBadge } from '@/components/infinity/StatusBadge';

type SortField = 'order_number' | 'order_date' | 'total_amount' | 'created_at';
type SortDir = 'asc' | 'desc';
type PageSize = 20 | 30 | 50 | 'all';

const QUICK_LOAD_LIMIT = 50;
const FULL_LOAD_LIMIT = 500;

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [searchParams] = useSearchParams();
  const atOnly = useAtOnly();
  const initialRegion = (searchParams.get('region') as 'all' | 'de' | 'at' | null) ?? 'all';
  const [regionFilter, setRegionFilter] = useState<'all' | 'de' | 'at'>(
    atOnly ? 'at' : (initialRegion === 'de' || initialRegion === 'at' ? initialRegion : 'all')
  );
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [deferOrder, setDeferOrder] = useState<any>(null);
  const [itemsOrder, setItemsOrder] = useState<any>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const loadRequestRef = useRef(0);

  async function duplicateSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} Auftrag/Aufträge wirklich duplizieren?`)) return;
    setDuplicating(true);
    let ok = 0, failed = 0;
    try {
      const { data: origOrders, error: oerr } = await supabase
        .from('orders').select('*').in('id', ids);
      if (oerr) throw oerr;
      const { data: origItems } = await supabase
        .from('order_items').select('*').in('order_id', ids);
      for (const o of (origOrders ?? [])) {
        try {
          const ts = Date.now().toString(36).toUpperCase();
          const { id, created_at, updated_at, external_order_id, ...rest } = o as any;
          const newOrder = {
            ...rest,
            order_number: `${o.order_number}-COPY-${ts}`,
            internal_number: null,
            external_order_id: null,
            source_system: 'manual',
            order_status: 'offen',
            deposit_ok: false,
            deposit_ok_by: null,
            deposit_ok_at: null,
            deposit_booking_date: null,
            finance_paid_amount: null,
            finance_open_amount: null,
            finance_overdue_amount: null,
            finance_payment_status: null,
            order_date: new Date().toISOString(),
          };
          const { data: inserted, error: ierr } = await supabase
            .from('orders').insert(newOrder).select('id').single();
          if (ierr) throw ierr;
          const items = (origItems ?? []).filter(it => it.order_id === o.id).map(it => {
            const { id: _id, created_at: _c, updated_at: _u, order_id: _o, ...rstI } = it as any;
            return { ...rstI, order_id: inserted!.id };
          });
          if (items.length > 0) {
            const { error: iierr } = await supabase.from('order_items').insert(items);
            if (iierr) throw iierr;
          }
          ok++;
        } catch (e) {
          console.error('Duplicate failed', o.id, e);
          failed++;
        }
      }
      if (ok > 0) toast.success(`${ok} Auftrag/Aufträge dupliziert${failed ? `, ${failed} fehlgeschlagen` : ''}`);
      else toast.error('Duplizieren fehlgeschlagen');
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      toast.error('Fehler: ' + (e?.message ?? e));
    } finally {
      setDuplicating(false);
    }
  }


  async function resendOrderConfirmation(order: any) {
    if (!order?.customer_id) { toast.error('Auftrag hat keinen Kunden'); return; }
    setResendingId(order.id);
    try {
      const { data: sigs } = await supabase
        .from('alix_sign_signatures')
        .select('id, created_at, alix_sign_requests!inner(customer_id, signed_at)')
        .eq('alix_sign_requests.customer_id', order.customer_id)
        .order('created_at', { ascending: false })
        .limit(1);
      const sig = (sigs || [])[0] as any;
      const { data: cust } = await supabase
        .from('customers')
        .select('email')
        .eq('id', order.customer_id)
        .maybeSingle();
      if (!cust?.email) { toast.error('Kunde hat keine E-Mail-Adresse'); return; }
      const payload: any = { order_id: order.id, recipient_email: cust.email };
      if (sig) payload.signature_id = sig.id;
      const { data, error } = await supabase.functions.invoke('send-order-confirmation', {
        body: payload,
      });
      if (error) throw error;
      const failed = (data?.results || []).filter((r: any) => r.status !== 'sent');
      if (failed.length > 0) {
        toast.error(`Versand teilweise fehlgeschlagen: ${failed.map((f: any) => f.to).join(', ')}`);
      } else {
        toast.success(`Auftragsbestätigung an ${cust.email} versendet (BCC: rde@alix-lasers.com)`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Versand fehlgeschlagen');
    } finally {
      setResendingId(null);
    }
  }

  const navigate = useNavigate();
  const { isAdmin, hasRole, user } = useAuth();
  const { drivingTimes, loading: drivingLoading, requestedIds, fetchDrivingTimes, retryFailed } = useDrivingTimes();
  const [viewMode, setViewMode] = useViewMode();

  // Nach Auftragserstellung dürfen nur Admin/Super Admin den Auftrag ändern.
  const canWrite = isAdmin;
  const canEditItems = hasRole('Super Admin');
  const canExportAll = hasRole('Super Admin') || (user?.email?.toLowerCase() === 'jh@alix-operation.de');

  function escCsv(v: any) {
    const s = (v ?? '').toString().replace(/"/g, '""');
    return /[";\n]/.test(s) ? `"${s}"` : s;
  }
  function exportRows() {
    return filtered.map((o: any) => ({
      number: o._displayNumber ?? o.order_number ?? '',
      date: o.order_date ?? '',
      status: o.order_status ?? '',
      customer: o.customers?.company_name || o.customers?.contact_name || '',
      city: resolveCity(o),
      total: o.total_amount ?? '',
      currency: o.currency ?? '',
      source: o.source_system ?? '',
      items: (o.order_items ?? []).map((it: any) => `${it.quantity ?? ''}× ${it.item_name ?? ''}`).join(' | '),
    }));
  }
  function handleExportCsv() {
    const rows = exportRows();
    const header = ['Auftragsnr', 'Datum', 'Status', 'Kunde', 'Ort', 'Betrag', 'Währung', 'Quelle', 'Positionen'];
    const lines = [header.join(';')];
    rows.forEach(r => lines.push([r.number, r.date, r.status, r.customer, r.city, r.total, r.currency, r.source, r.items].map(escCsv).join(';')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Auftraege_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} Aufträge als CSV exportiert`);
  }
  function handleExportPdf() {
    const rows = exportRows();
    const doc = createPDF({ orientation: 'landscape' });
    doc.setFont('Inter', 'bold');
    doc.setFontSize(14);
    doc.text(`Aufträge (${rows.length})`, 14, 14);
    doc.setFont('Inter', 'normal');
    doc.setFontSize(9);
    doc.text(format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de }), 14, 20);
    autoTable(doc, {
      startY: 26,
      head: [['Auftragsnr', 'Datum', 'Status', 'Kunde', 'Ort', 'Betrag', 'Währ.', 'Quelle']],
      body: rows.map(r => [r.number, r.date, r.status, r.customer, r.city, r.total, r.currency, r.source]),
      styles: { font: 'Inter', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(`Auftraege_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success(`${rows.length} Aufträge als PDF exportiert`);
  }

  async function load() {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    const orderSelect = `
        id, customer_id, external_order_id, order_number, source_system, order_status, invoiced_flag,
        currency, total_amount, order_date, expected_shipment_date, salesperson_name,
        internal_number, lawyer_reason, deposit_ok, deposit_ok_by, deposit_ok_at,
        deposit_amount, deposit_additional, deposit_booking_date, is_vip,
        finance_total_amount, finance_deposit_amount, finance_remaining_amount,
        finance_open_amount, finance_paid_amount, finance_overdue_amount,
        finance_payment_status, case_number, billing_address, shipping_address,
        customers(company_name, contact_name, shipping_address, billing_address, is_vip)
      `;
    const fetchOrders = (limit: number) => supabase
      .from('orders')
      .select(orderSelect)
      .order(sortField, { ascending: sortDir === 'asc', nullsFirst: false })
      .limit(limit);

    const expandOrders = (loaded: any[]) => loaded.map(o => ({
        ...o,
        order_items: [],
        _seq: 1,
        _displayNumber: withAt(o.order_number, o.source_system),
        _productionOrderCount: 0,
      }));

    const attachOrderDetails = async (loaded: any[]) => {
      const orderIds = loaded.map(o => o.id).filter(Boolean);
      const orderIdSet = new Set(orderIds);
      const orderNumbers = Array.from(new Set(loaded.map(o => o.order_number).filter(Boolean)));
      if (orderIds.length === 0 && orderNumbers.length === 0) return;

      const [itemsRes, posRes, depRes, zohoInvRes] = await Promise.all([
        orderIds.length > 0
          ? supabase
              .from('order_items')
              .select('id, order_id, item_name, description, sku, quantity, unit, rate, amount')
              .in('order_id', orderIds)
          : Promise.resolve({ data: [] as any[] }),
        orderNumbers.length > 0
          ? supabase
              .from('production_orders')
              .select('order_number')
              .in('order_number', orderNumbers)
          : Promise.resolve({ data: [] as any[] }),
        orderIds.length > 0
          ? supabase
              .from('finance_deposits' as any)
              .select('order_id, invoice_number, issue_date')
              .in('order_id', orderIds)
          : Promise.resolve({ data: [] as any[] }),
        orderNumbers.length > 0
          ? supabase
              .from('zoho_invoices')
              .select('invoice_number, reference_number')
              .in('reference_number', orderNumbers)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (requestId !== loadRequestRef.current) return;

      const itemsByOrder: Record<string, any[]> = {};
      (itemsRes.data || []).forEach((item: any) => {
        if (!item.order_id) return;
        (itemsByOrder[item.order_id] ||= []).push(item);
      });

      const poCountMap: Record<string, number> = {};
      (posRes.data || []).forEach((p: any) => {
        if (!p.order_number) return;
        poCountMap[p.order_number] = (poCountMap[p.order_number] || 0) + 1;
      });

      const azInvoiceByOrder: Record<string, string> = {};
      (depRes.data || []).forEach((d: any) => {
        if (!d?.order_id || !d?.invoice_number) return;
        if (!azInvoiceByOrder[d.order_id]) azInvoiceByOrder[d.order_id] = d.invoice_number;
      });

      const fullInvoiceByOrderNumber: Record<string, string> = {};
      (zohoInvRes.data || []).forEach((z: any) => {
        const num = z?.invoice_number as string | undefined;
        const ref = z?.reference_number as string | undefined;
        if (!num || !ref) return;
        // Nur echte Rechnungen berücksichtigen, keine Anzahlungsrechnungen (AZ-...)
        if (/^AZ/i.test(num)) return;
        if (!fullInvoiceByOrderNumber[ref]) fullInvoiceByOrderNumber[ref] = num;
      });

      setOrders(prev => prev.map(o => orderIdSet.has(o.id) ? ({
        ...o,
        order_items: itemsByOrder[o.id] || o.order_items || [],
        _productionOrderCount: o.order_number ? (poCountMap[o.order_number] || 0) : 0,
        _azInvoiceNumber: azInvoiceByOrder[o.id] || o._azInvoiceNumber || null,
        _fullInvoiceNumber: (o.order_number ? fullInvoiceByOrderNumber[o.order_number] : null) || o._fullInvoiceNumber || null,
      }) : o));
    };

    const { data, error: err } = await fetchOrders(QUICK_LOAD_LIMIT);
    if (requestId !== loadRequestRef.current) return;
    if (err) setError(err.message);
    const loaded = data ?? [];

    setOrders(expandOrders(loaded));
    setLoading(false);
    attachOrderDetails(loaded);

    if (err || loaded.length < QUICK_LOAD_LIMIT) return;
    const { data: fullData, error: fullErr } = await fetchOrders(FULL_LOAD_LIMIT);
    if (requestId !== loadRequestRef.current) return;
    if (fullErr) return;
    const fullLoaded = fullData ?? [];
    setOrders(expandOrders(fullLoaded));
    attachOrderDetails(fullLoaded);
  }

  useEffect(() => { load(); }, [sortField, sortDir]);

  const EXCLUDED_STATUSES: string[] = [];

  const statuses = [...new Set(orders.map(o => o.order_status).filter(Boolean))];


  const resolveCity = (order: any): string => {
    const hasAddr = (a: any) => a && (a.city || a.address || a.street);
    const addr =
      (hasAddr(order.shipping_address) ? order.shipping_address : null) ||
      (hasAddr(order.customers?.shipping_address) ? order.customers?.shipping_address : null) ||
      (hasAddr(order.billing_address) ? order.billing_address : null) ||
      (hasAddr(order.customers?.billing_address) ? order.customers?.billing_address : null);
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    return addr.city || addr.state || '';
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const modelMatch = o.order_items?.some((it: any) =>
      it.item_name?.toLowerCase().includes(q) ||
      it.description?.toLowerCase().includes(q) ||
      it.sku?.toLowerCase().includes(q)
    );
    const matchSearch = !search ||
      o.order_number?.toLowerCase().includes(q) ||
      o._displayNumber?.toLowerCase().includes(q) ||
      o.customers?.company_name?.toLowerCase().includes(q) ||
      o.customers?.contact_name?.toLowerCase().includes(q) ||
      resolveCity(o)?.toLowerCase().includes(q) ||
      modelMatch;
    const matchStatus = statusFilter === 'all' || o.order_status === statusFilter;
    const matchModel = modelFilter === 'all' || o.order_items?.some((it: any) => {
      const m = modelFilter.toLowerCase();
      return it.item_name?.toLowerCase().includes(m) ||
        it.description?.toLowerCase().includes(m) ||
        it.sku?.toLowerCase().includes(m);
    });
    const notExcluded = !EXCLUDED_STATUSES.includes((o.order_status || '').toLowerCase());
    const isAt = o.source_system === 'zoho_eu_2';
    const matchRegion = regionFilter === 'all' || (regionFilter === 'at' ? isAt : !isAt);
    return matchSearch && matchStatus && matchModel && matchRegion && notExcluded;
  });

  // VIP-Kunden und VIP-Aufträge immer an Position 1
  const sorted = vipFirst(filtered, isOrderVip);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(sorted.length / pageSize);
  const paged = pageSize === 'all' ? sorted : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, modelFilter, regionFilter, pageSize]);

  // Only fetch driving times for currently visible (paged) orders to avoid edge function timeout
  useEffect(() => {
    if (paged.length > 0) fetchDrivingTimes(paged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, filtered.length]);

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

  return (
    <div className="p-6 lg:p-8 animate-fade-in min-w-0 max-w-full overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          icon={ClipboardList}
          title="Aufträge"
          subtitle={`${filtered.length} Aufträge`}
          noBreadcrumbs
          meta={<InfinityStatusBadge kind="done" label={`${filtered.length}`} />}
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate('/verkauf/angebot/neu?mode=sofort')}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            title="Neuen Auftrag direkt ohne Angebot anlegen"
          >
            <Zap className="w-4 h-4" /> Sofortauftrag
          </Button>
          {canExportAll && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FileDown className="w-4 h-4" /> Aufträge exportieren
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleExportCsv}>
                  <FileDown className="w-4 h-4 mr-2" /> Als CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPdf}>
                  <FileText className="w-4 h-4 mr-2" /> Als PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

      </div>

      <Tabs defaultValue="list" className="space-y-4 mt-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="list" className="gap-1.5">
            <List className="w-3.5 h-3.5" /> Liste
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Kalender
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <OrderStatsBar
            orders={orders.filter(o => !EXCLUDED_STATUSES.includes((o.order_status || '').toLowerCase()))}
            filteredCount={filtered.length}
            label="Aufträge"
          />
          <div className="flex flex-col gap-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Suche nach Auftrag, Kunde, Ort, Modell, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border w-full" />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-secondary border-border">
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-56 bg-secondary border-border">
                <SelectValue placeholder="Gerät filtern" />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">Alle Geräte</SelectItem>
                {ALIX_MODEL_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
                    {group.models.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {!atOnly && (
              <Select value={regionFilter} onValueChange={(v) => setRegionFilter(v as 'all' | 'de' | 'at')}>
                <SelectTrigger className="w-48 bg-secondary border-border">
                  <SelectValue placeholder="Region filtern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Regionen</SelectItem>
                  <SelectItem value="de">🇩🇪 Alix Deutschland</SelectItem>
                  <SelectItem value="at">🇦🇹 Alix Austria (-AT)</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={String(pageSize)} onValueChange={v => setPageSize(v === 'all' ? 'all' : Number(v) as 20 | 30 | 50)}>
              <SelectTrigger className="w-36 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 pro Seite</SelectItem>
                <SelectItem value="30">30 pro Seite</SelectItem>
                <SelectItem value="50">50 pro Seite</SelectItem>
                <SelectItem value="all">Alle</SelectItem>
              </SelectContent>
            </Select>
            {(() => {
              const failed = paged.filter((o: any) => drivingTimes[o.id] === null);
              if (failed.length === 0) return null;
              return (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5"
                  disabled={drivingLoading}
                  onClick={() => retryFailed(failed)}
                  title="Fehlgeschlagene Fahrzeiten erneut berechnen"
                >
                  {drivingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Car className="w-3.5 h-3.5" />}
                  Fahrzeiten erneut ({failed.length})
                </Button>
              );
            })()}
            {canWrite && (
              <div className="flex items-center gap-2 ml-auto">
                <ViewToggle value={viewMode} onChange={setViewMode} />
                <Button
                  variant={selectionMode ? 'default' : 'outline'}
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setSelectionMode(s => !s);
                    setSelectedIds(new Set());
                  }}
                >
                  {selectionMode ? 'Markierung beenden' : 'Markieren'}
                </Button>
                {selectionMode && (
                  <Button
                    size="sm"
                    className="h-9 gap-1.5"
                    disabled={selectedIds.size === 0}
                    onClick={() => { setBulkStatus(''); setBulkOpen(true); }}
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                    Verschieben ({selectedIds.size})
                  </Button>
                )}
                {selectionMode && hasRole('Super Admin') && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5"
                    disabled={selectedIds.size === 0 || duplicating}
                    onClick={duplicateSelected}
                  >
                    {duplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                    Duplizieren ({selectedIds.size})
                  </Button>
                )}
              </div>
            )}
            {!canWrite && (
              <div className="ml-auto">
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            )}
            </div>
          </div>


          {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          {viewMode === 'cards' ? (
            loading ? (
              <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground">Keine Aufträge gefunden.</p>
              </div>
            ) : (
              <OrderCardGrid>
                {paged.map(o => (
                  <OrderCard
                    key={`${o.id}-${o._seq}`}
                    order={o}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(o.id)}
                    onToggleSelect={() => {
                      const next = new Set(selectedIds);
                      if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                      setSelectedIds(next);
                    }}
                    onClick={() => navigate(`/auftraege/${o.id}`)}
                    footer={
                      <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <DrivingTimeCell value={drivingTimes[o.id]} requested={requestedIds.has(o.id)} loading={drivingLoading} />
                          {o._productionOrderCount > 0 && (
                            <span
                              className="inline-flex items-center gap-1 text-emerald-500 text-xs font-medium"
                              title={`${o._productionOrderCount} Bestellung(en) ausgelöst`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Bestellung getätigt
                            </span>
                          )}
                        </div>
                        {canWrite && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditOrder(o)}>
                              <Pencil className="w-3 h-3 mr-1" /> Ändern
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDeferOrder(o)}>
                              <CalendarClock className="w-3 h-3 mr-1" /> Zurückstellen
                            </Button>
                            {canEditItems && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => setItemsOrder(o)}>
                                <Package className="w-3 h-3 mr-1" /> Artikel
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={resendingId === o.id}
                              onClick={() => resendOrderConfirmation(o)}
                              title="Auftragsbestätigung erneut an Kunde senden (BCC: rde@alix-lasers.com)"
                            >
                              {resendingId === o.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                              AB senden
                            </Button>
                          </div>
                        )}
                      </div>
                    }
                  />
                ))}
              </OrderCardGrid>
            )
          ) : (
          <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
            <div className="overflow-auto max-h-[calc(100vh-260px)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {selectionMode && (
                      <th className="w-10 px-3 py-3">
                        <Checkbox
                          checked={paged.length > 0 && paged.every(o => selectedIds.has(o.id))}
                          onCheckedChange={(v) => {
                            const next = new Set(selectedIds);
                            if (v) paged.forEach(o => next.add(o.id));
                            else paged.forEach(o => next.delete(o.id));
                            setSelectedIds(next);
                          }}
                        />
                      </th>
                    )}
                    <SortHeader field="order_number" label="Auftrag Nr." />
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                    <SortHeader field="order_date" label="Datum" />
                    <SortHeader field="total_amount" label="Betrag" />
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                      <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5" /> Fahrzeit</span>
                    </th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Anzahlung</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Anzahlung OK</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Bestellung</th>
                    {canWrite && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>}
                  </tr>
                </thead>
                {loading ? (
                  <tbody>
                    <tr><td colSpan={(canWrite ? 10 : 9) + (selectionMode ? 1 : 0)} className="px-4 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </td></tr>
                  </tbody>
                ) : filtered.length === 0 ? (
                  <tbody>
                    <tr><td colSpan={(canWrite ? 10 : 9) + (selectionMode ? 1 : 0)} className="px-4 py-12 text-center">
                      <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-muted-foreground">Keine Aufträge gefunden.</p>
                    </td></tr>
                  </tbody>
                ) : (
                  paged.map(o => (
                    <tbody key={`${o.id}-${o._seq}`} className="border-b border-border">
                      <tr
                        className="hover:bg-secondary/30 transition-colors cursor-pointer"
                        onClick={() => {
                          if (selectionMode) {
                            const next = new Set(selectedIds);
                            if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                            setSelectedIds(next);
                          } else {
                            navigate(`/auftraege/${o.id}`);
                          }
                        }}
                      >
                        {selectionMode && (
                          <td className="w-10 px-3 py-3" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(o.id)}
                              onCheckedChange={(v) => {
                                const next = new Set(selectedIds);
                                if (v) next.add(o.id); else next.delete(o.id);
                                setSelectedIds(next);
                              }}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-foreground">
                          <span className="inline-flex items-center gap-2">
                            {isOrderVip(o) && <VipBadge size="sm" iconOnly />}
                            {o._displayNumber || o.order_number}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex flex-col">
                            <span className="text-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</span>
                            {o.salesperson_name && (
                              <span className="text-xs text-muted-foreground">Vertrieb: {o.salesperson_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}</td>
                        <td className="px-4 py-3 text-foreground">
                          {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            <StatusBadge status={o.order_status || 'offen'} />
                            {(o as any)._azInvoiceNumber ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-500/15 text-green-400 border-green-500/30"
                                title={`Anzahlungsrechnung ${(o as any)._azInvoiceNumber} gestellt`}
                              >
                                RE-AZ OK
                              </span>
                            ) : ((o as any).invoiced_flag || (o as any)._fullInvoiceNumber) ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-500/15 text-green-400 border-green-500/30"
                                title={`Rechnung ${(o as any)._fullInvoiceNumber || ''} gestellt`.trim()}
                              >
                                Rechnung
                              </span>
                            ) : (o as any).deposit_ok ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-green-500/15 text-green-400 border-green-500/30"
                                title="Anzahlung bestätigt (ohne separate AZ-Rechnungsnummer)"
                              >
                                Anzahlung OK
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-500/10 text-red-500 border-red-500/30"
                                title="Für diesen Auftrag wurde noch keine Anzahlungsrechnung gestellt"
                              >
                                RE-AZ FEHLT
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs">
                          <DrivingTimeCell
                            value={drivingTimes[o.id]}
                            requested={requestedIds.has(o.id)}
                            loading={drivingLoading}
                          />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {Number(o.deposit_amount) > 0 ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <span className="text-foreground">
                                  {Number(o.deposit_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' })}
                                </span>
                                {o.deposit_ok ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-label="bezahlt" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-500" aria-label="nicht bezahlt" />
                                )}
                              </span>
                              {o.deposit_ok && o._azInvoiceNumber && (
                                <span className="text-[10px] text-muted-foreground" title="Anzahlungsrechnung">
                                  Rg. {o._azInvoiceNumber}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {o.deposit_ok ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                              ✓ {o.deposit_ok_by || 'Ja'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {o._productionOrderCount > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 text-emerald-500 font-medium"
                              title={`${o._productionOrderCount} Bestellung(en) ausgelöst`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Bestellung getätigt
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        {canWrite && (
                          <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setEditOrder(o)}
                              >
                                <Pencil className="w-3 h-3 mr-1" /> Ändern
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setDeferOrder(o)}
                              >
                                <CalendarClock className="w-3 h-3 mr-1" /> Zurückstellen
                              </Button>
                              {canEditItems && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-primary hover:text-primary"
                                  onClick={() => setItemsOrder(o)}
                                >
                                  <Package className="w-3 h-3 mr-1" /> Artikel
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                disabled={resendingId === o.id}
                                onClick={() => resendOrderConfirmation(o)}
                                title="Auftragsbestätigung erneut an Kunde senden (BCC: rde@alix-lasers.com)"
                              >
                                {resendingId === o.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                                AB senden
                              </Button>

                            </div>
                          </td>
                        )}
                      </tr>
                    </tbody>
                  ))
                )}
              </table>
            </div>
          </div>
          )}

          {/* Pagination */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Seite {currentPage} von {totalPages} · {filtered.length} Ergebnisse
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                  Zurück
                </Button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 7) page = i + 1;
                  else if (currentPage <= 4) page = i + 1;
                  else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
                  else page = currentPage - 3 + i;
                  return (
                    <Button key={page} variant={page === currentPage ? 'default' : 'outline'} size="sm" className="h-7 w-7 px-0 text-xs" onClick={() => setCurrentPage(page)}>
                      {page}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                  Weiter
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <OrdersCalendar />
        </TabsContent>
      </Tabs>

      {editOrder && (
        <OrderEditDialog order={editOrder} open onClose={() => setEditOrder(null)} onSaved={load} />
      )}
      {deferOrder && (
        <OrderDeferDialog order={deferOrder} open onClose={() => setDeferOrder(null)} onSaved={load} />
      )}
      {itemsOrder && (
        <OrderItemsEditDialog
          orderId={itemsOrder.id}
          orderNumber={itemsOrder._displayNumber || itemsOrder.order_number}
          open
          onClose={() => setItemsOrder(null)}
          onSaved={load}
        />
      )}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Status für {selectedIds.size} Auftrag/Aufträge ändern</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Wähle den neuen Status für die markierten Aufträge.</p>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Status wählen..." />
              </SelectTrigger>
              <SelectContent>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                <SelectItem value="offen">offen</SelectItem>
                <SelectItem value="in Bearbeitung">in Bearbeitung</SelectItem>
                <SelectItem value="geliefert">geliefert</SelectItem>
                <SelectItem value="teilgeliefert">teilgeliefert</SelectItem>
                <SelectItem value="anwalt">anwalt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkSaving}>Abbrechen</Button>
            <Button
              disabled={!bulkStatus || bulkSaving}
              onClick={async () => {
                setBulkSaving(true);
                const ids = Array.from(selectedIds);
                // Aufträge ermitteln, deren Status sich tatsächlich auf "geliefert" ändert
                const newlyDeliveredIds = bulkStatus === 'geliefert'
                  ? orders.filter(o => ids.includes(o.id) && o.order_status !== 'geliefert').map(o => o.id)
                  : [];
                // Reservierte Geräte je Auftrag VOR dem Status-Update einlesen
                // (Trigger löscht reserved_order_id bei "geliefert").
                const devicesByOrder = new Map<string, Array<{ model_name: string | null; serial_number: string | null }>>();
                if (newlyDeliveredIds.length > 0) {
                  const { data: devs } = await supabase
                    .from('lager_devices')
                    .select('model_name, serial_number, reserved_order_id')
                    .in('reserved_order_id', newlyDeliveredIds);
                  for (const d of devs || []) {
                    const oid = (d as any).reserved_order_id as string;
                    const arr = devicesByOrder.get(oid) || [];
                    arr.push({ model_name: d.model_name, serial_number: d.serial_number });
                    devicesByOrder.set(oid, arr);
                  }
                }
                const { error: err } = await supabase
                  .from('orders')
                  .update({ order_status: bulkStatus })
                  .in('id', ids);
                if (err) {
                  setBulkSaving(false);
                  toast.error('Fehler: ' + err.message);
                  return;
                }
                if (newlyDeliveredIds.length > 0) {
                  let ok = 0, fail = 0;
                  for (const oid of newlyDeliveredIds) {
                    const r = await sendCustomerShippingNotice(oid, undefined, 'automatisch', 'customer_delivered', devicesByOrder.get(oid) || []);
                    if (r.ok) ok++; else fail++;
                    await new Promise(res => setTimeout(res, 1200));
                  }
                  toast.success(`Liefer-E-Mails versendet: ${ok} · Fehler: ${fail}`);
                }

                setBulkSaving(false);
                toast.success(`${ids.length} Auftrag/Aufträge auf "${bulkStatus}" gesetzt.`);
                setBulkOpen(false);
                setSelectedIds(new Set());
                setSelectionMode(false);
                load();
              }}
            >
              {bulkSaving ? 'Speichern...' : 'Verschieben'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
