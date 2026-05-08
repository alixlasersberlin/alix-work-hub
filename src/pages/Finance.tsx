import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Search, Banknote, ArrowUpDown, Loader2, Inbox, Plus, CalendarIcon, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { PageSizeSelector, usePagination, PaginationControls } from '@/components/PageSizeSelector';

type SortField = 'due_date' | 'amount_due';
type SortDir = 'asc' | 'desc';

interface OrderGroup {
  orderId: string;
  orderNumber: string;
  customerName: string;
  records: any[];
  totalDue: number;
  totalPaid: number;
  hasOverdue: boolean;
}

export default function Finance() {
  const { isAdmin, hasRole } = useAuth();
  const canWrite = isAdmin || hasRole('Finance');
  const navigate = useNavigate();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRecords();
  }, [sortField, sortDir]);

  async function loadRecords() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('finance_records')
      .select('*, orders(order_number, order_status, customers(company_name, contact_name))')
      .order(sortField, { ascending: sortDir === 'asc', nullsFirst: false })
      .limit(500);
    if (err) setError(err.message);
    setRecords(data ?? []);
    setLoading(false);
  }

  const paymentStatuses = useMemo(() => [...new Set(records.map(r => r.payment_status).filter(Boolean))], [records]);
  const invoiceStatuses = useMemo(() => [...new Set(records.map(r => r.invoice_status).filter(Boolean))], [records]);

  const filtered = useMemo(() => records.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      r.orders?.order_number?.toLowerCase().includes(q) ||
      r.orders?.customers?.company_name?.toLowerCase().includes(q) ||
      r.orders?.customers?.contact_name?.toLowerCase().includes(q);
    const matchPayment = paymentFilter === 'all' || r.payment_status === paymentFilter;
    const matchInvoice = invoiceFilter === 'all' || r.invoice_status === invoiceFilter;
    const matchDate = !dueDateFilter || r.due_date === format(dueDateFilter, 'yyyy-MM-dd');
    return matchSearch && matchPayment && matchInvoice && matchDate;
  }), [records, search, paymentFilter, invoiceFilter, dueDateFilter]);

  // Group by order
  const grouped = useMemo(() => {
    const map = new Map<string, OrderGroup>();
    for (const r of filtered) {
      const key = r.order_id;
      if (!map.has(key)) {
        map.set(key, {
          orderId: key,
          orderNumber: r.orders?.order_number || '—',
          customerName: r.orders?.customers?.company_name || r.orders?.customers?.contact_name || '—',
          records: [],
          totalDue: 0,
          totalPaid: 0,
          hasOverdue: false,
        });
      }
      const g = map.get(key)!;
      g.records.push(r);
      g.totalDue += Number(r.amount_due) || 0;
      g.totalPaid += Number(r.amount_paid) || 0;
      if (r.due_date && new Date(r.due_date) < new Date() && r.payment_status !== 'bezahlt') {
        g.hasOverdue = true;
      }
    }
    return Array.from(map.values());
  }, [filtered]);

  const { pageSize, setPageSize, page, setPage, totalPages, paged, total } = usePagination(grouped, 20);

  // KPI summaries
  const totalDue = filtered.reduce((s, r) => s + (Number(r.amount_due) || 0), 0);
  const totalPaid = filtered.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0);
  const overdueCount = filtered.filter(r => r.payment_status === 'überfällig' || (r.due_date && new Date(r.due_date) < new Date() && r.payment_status !== 'bezahlt')).length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const SortHeader = ({ field, label, align }: { field: SortField; label: string; align?: string }) => (
    <th
      className={cn("px-4 py-3 text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors", align === 'right' ? 'text-right' : 'text-left')}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortField === field && <ArrowUpDown className="w-3 h-3 text-primary" />}
      </span>
    </th>
  );

  const fmt = (amount: number | null, currency?: string | null) =>
    amount != null ? Number(amount).toLocaleString('de-DE', { style: 'currency', currency: currency || 'EUR' }) : '—';

  return (
    <div className="p-6 lg:p-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" /> Finance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{grouped.length} Aufträge · {filtered.length} Positionen</p>
        </div>
        {canWrite && (
          <Button onClick={() => navigate('/finance/neu')} className="gold-gradient text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Neuer Eintrag
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-xs text-muted-foreground mb-1">Fällig gesamt</p>
          <p className="text-xl font-display font-bold text-foreground">{totalDue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-xs text-muted-foreground mb-1">Bezahlt gesamt</p>
          <p className="text-xl font-display font-bold text-success">{totalPaid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 card-glow">
          <p className="text-xs text-muted-foreground mb-1">Überfällig</p>
          <p className="text-xl font-display font-bold flex items-center gap-2">
            {overdueCount > 0 && <AlertTriangle className="w-5 h-5 text-destructive" />}
            <span className={overdueCount > 0 ? 'text-destructive' : 'text-foreground'}>{overdueCount}</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Zahlungsstatus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Zahlungen</SelectItem>
            {paymentStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Rechnungsstatus" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Rechnungen</SelectItem>
            {invoiceStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-44 justify-start text-left bg-secondary border-border", !dueDateFilter && "text-muted-foreground")}>
              <CalendarIcon className="w-4 h-4 mr-2" />
              {dueDateFilter ? format(dueDateFilter, 'dd.MM.yyyy') : 'Fälligkeitsdatum'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dueDateFilter} onSelect={setDueDateFilter} locale={de} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {dueDateFilter && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDueDateFilter(undefined)}>Filter zurücksetzen</Button>
        )}
        <PageSizeSelector value={pageSize} onChange={setPageSize} />
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Table grouped by order */}
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="w-10 px-3 py-3" />
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftrag</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">Raten</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Gesamt fällig</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Gesamt bezahlt</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
              ) : grouped.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-muted-foreground">Keine Finance-Einträge gefunden.</p>
                </td></tr>
              ) : (
                grouped.map(g => {
                  const expanded = expandedOrders.has(g.orderId);
                  const paidCount = g.records.filter(r => r.payment_status === 'bezahlt').length;
                  return (
                    <React.Fragment key={g.orderId}>
                      {/* Order group header row */}
                      <tr
                        className={cn(
                          "hover:bg-secondary/30 transition-colors cursor-pointer",
                          g.hasOverdue && "bg-destructive/5"
                        )}
                        onClick={() => toggleExpand(g.orderId)}
                      >
                        <td className="px-3 py-3 text-muted-foreground">
                          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{g.orderNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">{g.customerName}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          <span className="text-foreground font-medium">{paidCount}</span>/{g.records.length}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground font-medium">{fmt(g.totalDue)}</td>
                        <td className="px-4 py-3 text-right text-success font-medium">{fmt(g.totalPaid)}</td>
                        <td className="px-4 py-3">
                          {g.hasOverdue ? (
                            <span className="inline-flex items-center gap-1 text-destructive text-xs font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> Überfällig
                            </span>
                          ) : paidCount === g.records.length ? (
                            <StatusBadge status="bezahlt" />
                          ) : (
                            <StatusBadge status="offen" />
                          )}
                        </td>
                      </tr>
                      {/* Expanded individual installments */}
                      {expanded && g.records.map((r, idx) => {
                        const isOverdue = r.due_date && new Date(r.due_date) < new Date() && r.payment_status !== 'bezahlt';
                        return (
                          <tr
                            key={r.id}
                            className={cn(
                              "bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer border-t border-border/50",
                              isOverdue && "bg-destructive/5"
                            )}
                            onClick={(e) => { e.stopPropagation(); navigate(`/finance/${r.id}`); }}
                          >
                            <td className="px-3 py-2" />
                            <td className="px-4 py-2 text-muted-foreground text-xs pl-8">
                              {r.finance_note || `Rate ${idx + 1}`}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">
                              <span className={cn(isOverdue && "text-destructive font-medium")}>
                                {r.due_date ? new Date(r.due_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'}
                              </span>
                            </td>
                            <td className="px-4 py-2" />
                            <td className="px-4 py-2 text-right text-foreground text-xs">{fmt(r.amount_due, r.currency)}</td>
                            <td className="px-4 py-2 text-right text-foreground text-xs">{fmt(r.amount_paid, r.currency)}</td>
                            <td className="px-4 py-2">
                              <StatusBadge status={r.payment_status || 'offen'} />
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
