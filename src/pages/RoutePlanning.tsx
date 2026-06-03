import { useEffect, useState, useMemo } from 'react';
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
  Search, MapPin, ArrowUpDown, Loader2, Inbox, Plus, CalendarIcon, List, CalendarDays
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { useViewMode } from '@/hooks/useViewMode';
import { ViewToggle } from '@/components/ViewToggle';
import { useAtOnly } from '@/hooks/useAtOnly';

type SortField = 'planned_date' | 'priority';
type SortDir = 'asc' | 'desc';

const PRIORITY_COLORS: Record<string, string> = {
  hoch: 'text-destructive',
  normal: 'text-muted-foreground',
  niedrig: 'text-info',
};

export default function RoutePlanning() {
  const { isAdmin, hasRole } = useAuth();
  const canWrite = isAdmin || hasRole('Tourenplanung');
  const navigate = useNavigate();

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState<'offen' | 'erledigt' | 'alle'>('offen');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<SortField>('planned_date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [pageSize, setPageSize] = useState<20 | 50 | 100 | 'all'>(20);
  const [viewMode, setViewMode] = useViewMode();
  const atOnly = useAtOnly();

  const CLOSED_STATUSES = ['erledigt', 'abgesagt', 'storniert'];

  useEffect(() => {
    loadPlans();
  }, [sortField, sortDir, atOnly]);

  async function loadPlans() {
    setLoading(true);
    setError(null);
    let qb = supabase
      .from('route_plans')
      .select(atOnly
        ? '*, orders!inner(order_number, order_status, source_system, shipping_address, billing_address, customers(company_name, contact_name, shipping_address, billing_address))'
        : '*, orders(order_number, order_status, shipping_address, billing_address, customers(company_name, contact_name, shipping_address, billing_address))')
      .order(sortField === 'priority' ? 'priority' : 'planned_date', { ascending: sortDir === 'asc' })
      .limit(500);
    if (atOnly) qb = qb.eq('orders.source_system', 'zoho_eu_2');
    const { data, error: err } = await qb;
    if (err) setError(err.message);
    const plansData = data ?? [];
    // Fetch reserved devices and order items for these orders
    const orderIds = [...new Set(plansData.map((p: any) => p.order_id).filter(Boolean))];
    let devicesByOrder: Record<string, any[]> = {};
    let itemsByOrder: Record<string, any[]> = {};
    if (orderIds.length > 0) {
      const [{ data: devs }, { data: items }] = await Promise.all([
        supabase.from('lager_devices').select('id, model_name, serial_number, reserved_order_id').in('reserved_order_id', orderIds),
        supabase.from('order_items').select('id, order_id, item_name, quantity, item_order').in('order_id', orderIds).order('item_order', { ascending: true }),
      ]);
      (devs ?? []).forEach((d: any) => {
        if (!devicesByOrder[d.reserved_order_id]) devicesByOrder[d.reserved_order_id] = [];
        devicesByOrder[d.reserved_order_id].push(d);
      });
      (items ?? []).forEach((it: any) => {
        if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
        itemsByOrder[it.order_id].push(it);
      });
    }
    setPlans(plansData.map((p: any) => ({ ...p, reserved_devices: devicesByOrder[p.order_id] || [], order_items: itemsByOrder[p.order_id] || [] })));
    setLoading(false);
  }

  const employees = useMemo(() => [...new Set(plans.map(p => p.assigned_employee).filter(Boolean))], [plans]);
  const statuses = useMemo(() => [...new Set(plans.map(p => p.planning_status).filter(Boolean))], [plans]);

  const filtered = useMemo(() => plans.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      p.orders?.order_number?.toLowerCase().includes(q) ||
      p.orders?.customers?.company_name?.toLowerCase().includes(q) ||
      p.orders?.customers?.contact_name?.toLowerCase().includes(q) ||
      p.assigned_employee?.toLowerCase().includes(q);
    const ps = (p.planning_status || '').toLowerCase();
    const os = (p.orders?.order_status || '').toLowerCase();
    if (os.includes('hold') || os.includes('anwalt')) return false;
    const isClosed = CLOSED_STATUSES.includes(ps);
    const matchCompletion =
      completionFilter === 'alle' ||
      (completionFilter === 'erledigt' && isClosed) ||
      (completionFilter === 'offen' && !isClosed);
    const matchStatus = statusFilter === 'all' || p.planning_status === statusFilter;
    const matchEmployee = employeeFilter === 'all' || p.assigned_employee === employeeFilter;
    const matchDate = !dateFilter || p.planned_date === format(dateFilter, 'yyyy-MM-dd');
    return matchSearch && matchCompletion && matchStatus && matchEmployee && matchDate;
  }), [plans, search, completionFilter, statusFilter, employeeFilter, dateFilter]);

  const paged = useMemo(() => pageSize === 'all' ? filtered : filtered.slice(0, pageSize), [filtered, pageSize]);

  // Group by date for calendar view
  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach(p => {
      const key = p.planned_date || 'Ohne Datum';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-6 h-6 text-primary" />
            Tourenplanung
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} Touren</p>
        </div>
        <div className="flex items-center gap-2">
          {view === 'list' && <ViewToggle value={viewMode} onChange={setViewMode} />}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={cn("px-3 py-2 text-sm transition-colors", view === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setView('list')}
            ><List className="w-4 h-4" /></button>
            <button
              className={cn("px-3 py-2 text-sm transition-colors border-l border-border", view === 'calendar' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setView('calendar')}
            ><CalendarDays className="w-4 h-4" /></button>
          </div>
          {canWrite && (
            <Button onClick={() => navigate('/tourenplanung/neu')} className="gold-gradient text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Neue Tour
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suche nach Auftrag, Kunde, Mitarbeiter..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary border-border" />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['offen', 'erledigt', 'alle'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setCompletionFilter(opt)}
              className={cn(
                "px-3 py-2 text-sm capitalize transition-colors",
                completionFilter === opt
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground',
                opt !== 'offen' && 'border-l border-border'
              )}
            >
              {opt === 'offen' ? 'Offen' : opt === 'erledigt' ? 'Erledigt' : 'Alle'}
            </button>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Mitarbeiter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Mitarbeiter</SelectItem>
            {employees.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-44 justify-start text-left bg-secondary border-border", !dateFilter && "text-muted-foreground")}>
              <CalendarIcon className="w-4 h-4 mr-2" />
              {dateFilter ? format(dateFilter, 'dd.MM.yyyy') : 'Datum'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} locale={de} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {dateFilter && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDateFilter(undefined)}>Filter zurücksetzen</Button>
        )}
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* List View */}
      {view === 'list' && viewMode === 'rows' && (
        <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Auftrag</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Kunde</th>
                  <SortHeader field="planned_date" label="Datum" />
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Stadt</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">PLZ</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Positionen</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Reserviertes Gerät</th>
                  <SortHeader field="priority" label="Priorität" />
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground">Keine Touren gefunden.</p>
                  </td></tr>
                ) : (
                  filtered.map(p => (
                    <tr key={p.id} className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => navigate(`/tourenplanung/${p.id}`)}>
                      <td className="px-4 py-3 font-medium text-foreground">{p.orders?.order_number || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.orders?.customers?.company_name || p.orders?.customers?.contact_name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.planned_date ? new Date(p.planned_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(() => {
                          const sources = [
                            p.orders?.shipping_address,
                            p.orders?.billing_address,
                            p.orders?.customers?.shipping_address,
                            p.orders?.customers?.billing_address,
                          ];
                          for (const a of sources) {
                            const c = a?.city || a?.Stadt;
                            if (c && String(c).trim()) return c;
                          }
                          return '—';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(() => {
                          const sources = [
                            p.orders?.shipping_address,
                            p.orders?.billing_address,
                            p.orders?.customers?.shipping_address,
                            p.orders?.customers?.billing_address,
                          ];
                          for (const a of sources) {
                            const z = a?.zip || a?.zipcode || a?.postal_code || a?.PLZ || a?.plz;
                            if (z && String(z).trim()) return z;
                          }
                          return '—';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.order_items && p.order_items.length > 0 ? (
                          <div className="space-y-0.5">
                            {p.order_items.map((it: any) => (
                              <div key={it.id}>
                                {it.quantity ? <span className="text-foreground">{Number(it.quantity)}× </span> : null}
                                {it.item_name || '—'}
                              </div>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {p.reserved_devices && p.reserved_devices.length > 0 ? (
                          <div className="space-y-0.5">
                            {p.reserved_devices.map((d: any) => (
                              <div key={d.id} className="text-yellow-600 dark:text-yellow-300">
                                {d.model_name} <span className="text-muted-foreground">· {d.serial_number}</span>
                              </div>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-sm capitalize", PRIORITY_COLORS[p.priority] || 'text-muted-foreground')}>{p.priority || 'normal'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.planning_status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'list' && viewMode === 'cards' && (
        loading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center card-glow">
            <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground">Keine Touren gefunden.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(p => {
              const sources = [
                p.orders?.shipping_address,
                p.orders?.billing_address,
                p.orders?.customers?.shipping_address,
                p.orders?.customers?.billing_address,
              ];
              const city = sources.map(a => a?.city || a?.Stadt).find(v => v && String(v).trim()) || '—';
              const zip = sources.map(a => a?.zip || a?.zipcode || a?.postal_code || a?.PLZ || a?.plz).find(v => v && String(v).trim()) || '';
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/tourenplanung/${p.id}`)}
                  className="rounded-xl border border-border bg-card card-glow p-4 cursor-pointer hover:border-primary/40 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-sm text-foreground truncate">{p.orders?.order_number || '—'}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.orders?.customers?.company_name || p.orders?.customers?.contact_name || '—'}
                      </div>
                    </div>
                    <StatusBadge status={p.planning_status} />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {p.planned_date ? new Date(p.planned_date + 'T00:00:00').toLocaleDateString('de-DE') : '—'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{zip} {city}</span>
                    </div>
                  </div>
                  {p.order_items && p.order_items.length > 0 && (
                    <div className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                      {p.order_items.slice(0, 3).map((it: any) => (
                        <div key={it.id} className="truncate">
                          {it.quantity ? <span className="text-foreground">{Number(it.quantity)}× </span> : null}
                          {it.item_name || '—'}
                        </div>
                      ))}
                      {p.order_items.length > 3 && <div className="text-[10px]">+ {p.order_items.length - 3} weitere</div>}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className={cn("text-xs capitalize", PRIORITY_COLORS[p.priority] || 'text-muted-foreground')}>{p.priority || 'normal'}</span>
                    <span className="text-xs text-muted-foreground truncate">{p.assigned_employee || '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Calendar / Grouped View */}
      {view === 'calendar' && (
        <div className="space-y-6">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
          ) : groupedByDate.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center card-glow">
              <Inbox className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground">Keine Touren gefunden.</p>
            </div>
          ) : (
            groupedByDate.map(([date, items]) => (
              <div key={date} className="rounded-xl border border-border bg-card card-glow overflow-hidden">
                <div className="px-5 py-3 bg-secondary/50 border-b border-border flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-bold text-foreground">
                    {date === 'Ohne Datum' ? date : new Date(date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </h3>
                  <span className="text-xs text-muted-foreground ml-auto">{items.length} {items.length === 1 ? 'Tour' : 'Touren'}</span>
                </div>
                <div className="divide-y divide-border">
                  {items.map(p => (
                    <div
                      key={p.id}
                      className="px-5 py-3 flex items-center gap-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tourenplanung/${p.id}`)}
                    >
                      <div className="flex-shrink-0 text-center w-16">
                        <p className="text-sm font-medium text-foreground">
                          {p.time_window_start ? p.time_window_start.slice(0, 5) : '—'}
                        </p>
                        {p.time_window_end && <p className="text-xs text-muted-foreground">bis {p.time_window_end.slice(0, 5)}</p>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{p.orders?.order_number || '—'} · {p.orders?.customers?.company_name || p.orders?.customers?.contact_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{p.assigned_employee || 'Kein Mitarbeiter'} {p.assigned_team ? `· ${p.assigned_team}` : ''} {p.vehicle_info ? `· ${p.vehicle_info}` : ''}</p>
                      </div>
                      <span className={cn("text-xs capitalize", PRIORITY_COLORS[p.priority] || 'text-muted-foreground')}>{p.priority}</span>
                      <StatusBadge status={p.planning_status} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
