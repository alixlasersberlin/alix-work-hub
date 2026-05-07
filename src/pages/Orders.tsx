import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, ClipboardList, ArrowUpDown, Loader2, Inbox, CalendarDays, List, Car, Pencil, CalendarClock, MoveRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { toast } from 'sonner';
import OrdersCalendar from '@/components/OrdersCalendar';
import OrderEditDialog from '@/components/OrderEditDialog';
import OrderDeferDialog from '@/components/OrderDeferDialog';
import { useDrivingTimes } from '@/hooks/useDrivingTimes';

type SortField = 'order_number' | 'order_date' | 'total_amount' | 'created_at';
type SortDir = 'asc' | 'desc';
type PageSize = 20 | 30 | 50 | 'all';

export default function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [deferOrder, setDeferOrder] = useState<any>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const navigate = useNavigate();
  const { isAdmin, hasRole } = useAuth();
  const { drivingTimes, fetchDrivingTimes } = useDrivingTimes();

  const canWrite = isAdmin || hasRole('Auftragsverwaltung');

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, customers(company_name, contact_name, shipping_address, billing_address), order_items(id, item_name, description, sku, quantity, unit, rate, amount)')
      .order(sortField, { ascending: sortDir === 'asc' })
      .limit(500);
    if (err) setError(err.message);
    const loaded = data ?? [];

    // Anzahl Produktionsbestellungen pro order_number ermitteln
    const orderNumbers = Array.from(new Set(loaded.map(o => o.order_number).filter(Boolean)));
    const poCountMap: Record<string, number> = {};
    if (orderNumbers.length > 0) {
      const { data: pos } = await supabase
        .from('production_orders')
        .select('order_number')
        .in('order_number', orderNumbers);
      (pos || []).forEach(p => {
        if (!p.order_number) return;
        poCountMap[p.order_number] = (poCountMap[p.order_number] || 0) + 1;
      });
    }

    // Anzeige: nur originale Zoho-Auftragsnummer, kein Suffix, keine interne Nummer
    const expanded = loaded.map(o => ({ ...o, _seq: 1, _displayNumber: o.order_number }));

    setOrders(expanded);
    setLoading(false);
    if (loaded.length > 0) fetchDrivingTimes(loaded);
  }

  useEffect(() => { load(); }, [sortField, sortDir, fetchDrivingTimes]);

  const EXCLUDED_STATUSES = ['geliefert', 'teilgeliefert', 'anwalt'];

  const statuses = [...new Set(orders.map(o => o.order_status).filter(Boolean))]
    .filter(s => !EXCLUDED_STATUSES.includes(s.toLowerCase()));

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
    const notExcluded = !EXCLUDED_STATUSES.includes((o.order_status || '').toLowerCase());
    return matchSearch && matchStatus && notExcluded;
  });

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filtered.length / pageSize);
  const paged = pageSize === 'all' ? filtered : filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, pageSize]);

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
    <div className="p-6 lg:p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Aufträge
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} Aufträge</p>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="list" className="gap-1.5">
            <List className="w-3.5 h-3.5" /> Liste
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Kalender
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Suche nach Auftrag, Kunde, Ort, Modell, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-secondary border-border">
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
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
            {canWrite && (
              <div className="flex items-center gap-2 ml-auto">
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
              </div>
            )}
          </div>

          {error && <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

          <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
            <div className="overflow-x-auto">
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
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Quelle</th>
                    {canWrite && <th className="text-right px-4 py-3 text-muted-foreground font-medium">Aktionen</th>}
                  </tr>
                </thead>
                {loading ? (
                  <tbody>
                    <tr><td colSpan={(canWrite ? 8 : 7) + (selectionMode ? 1 : 0)} className="px-4 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </td></tr>
                  </tbody>
                ) : filtered.length === 0 ? (
                  <tbody>
                    <tr><td colSpan={(canWrite ? 8 : 7) + (selectionMode ? 1 : 0)} className="px-4 py-12 text-center">
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
                        <td className="px-4 py-3 font-medium text-foreground">{o._displayNumber || o.order_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">{o.customers?.company_name || o.customers?.contact_name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{o.order_date ? new Date(o.order_date).toLocaleDateString('de-DE') : '—'}</td>
                        <td className="px-4 py-3 text-foreground">
                          {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={o.order_status || 'offen'} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {drivingTimes[o.id] ? (
                            <span className="inline-flex items-center gap-1">
                              <Car className="w-3 h-3" />
                              {drivingTimes[o.id]!.duration_text} ({drivingTimes[o.id]!.distance_text})
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{o.source_system}</td>
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
                const { error: err } = await supabase
                  .from('orders')
                  .update({ order_status: bulkStatus })
                  .in('id', ids);
                setBulkSaving(false);
                if (err) {
                  toast.error('Fehler: ' + err.message);
                  return;
                }
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
