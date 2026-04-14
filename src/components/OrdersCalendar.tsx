import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Truck, Package, Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';

interface OrderRow {
  id: string;
  order_number: string;
  order_date: string | null;
  expected_shipment_date: string | null;
  order_status: string | null;
  total_amount: number | null;
  currency: string | null;
}

interface DeliveryRow {
  id: string;
  planned_date: string | null;
  planning_status: string;
  order_id: string;
  orders: { order_number: string; order_status: string | null } | null;
}

type ViewMode = 'week' | 'month';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function formatDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const jan4 = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const firstDay = (first.getDay() + 6) % 7; // Mon=0
  const start = addDays(first, -firstDay);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

interface DayCellData {
  orders: number;
  deliveries: number;
  shipments: number;
}

export default function OrdersCalendar() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<'orders' | 'deliveries' | 'shipments'>('orders');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [ordersRes, deliveriesRes] = await Promise.all([
        supabase.from('orders').select('id, order_number, order_date, expected_shipment_date, order_status, total_amount, currency').order('order_date', { ascending: true }).limit(1000),
        supabase.from('route_plans').select('id, planned_date, planning_status, order_id, orders(order_number, order_status)').order('planned_date', { ascending: true }).limit(1000),
      ]);
      setOrders(ordersRes.data ?? []);
      setDeliveries(deliveriesRes.data as any ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const ordersByDate = useMemo(() => {
    const map: Record<string, OrderRow[]> = {};
    orders.forEach(o => {
      if (!o.order_date) return;
      const key = o.order_date.slice(0, 10);
      (map[key] ??= []).push(o);
    });
    return map;
  }, [orders]);

  const shipmentsByDate = useMemo(() => {
    const map: Record<string, OrderRow[]> = {};
    orders.forEach(o => {
      if (!o.expected_shipment_date) return;
      const key = o.expected_shipment_date.slice(0, 10);
      (map[key] ??= []).push(o);
    });
    return map;
  }, [orders]);

  const deliveriesByDate = useMemo(() => {
    const map: Record<string, DeliveryRow[]> = {};
    deliveries.forEach(d => {
      if (!d.planned_date) return;
      const key = d.planned_date.slice(0, 10);
      (map[key] ??= []).push(d);
    });
    return map;
  }, [deliveries]);

  const cellData = useMemo(() => {
    const map: Record<string, DayCellData> = {};
    const allKeys = new Set([...Object.keys(ordersByDate), ...Object.keys(deliveriesByDate), ...Object.keys(shipmentsByDate)]);
    allKeys.forEach(key => {
      map[key] = {
        orders: ordersByDate[key]?.length ?? 0,
        deliveries: deliveriesByDate[key]?.length ?? 0,
        shipments: shipmentsByDate[key]?.length ?? 0,
      };
    });
    return map;
  }, [ordersByDate, deliveriesByDate, shipmentsByDate]);

  // Weekly summary
  const weekSummary = useMemo(() => {
    if (view !== 'month') return [];
    const weeks: { weekNum: number; start: Date; end: Date; orders: number; deliveries: number }[] = [];
    const days = getMonthDays(year, month);
    for (let w = 0; w < 6; w++) {
      const wDays = days.slice(w * 7, w * 7 + 7);
      if (wDays[0].getMonth() !== month && wDays[6].getMonth() !== month) continue;
      let oCount = 0, dCount = 0, sCount = 0;
      wDays.forEach(d => {
        const key = formatDateKey(d);
        oCount += cellData[key]?.orders ?? 0;
        dCount += cellData[key]?.deliveries ?? 0;
        sCount += cellData[key]?.shipments ?? 0;
      });
      weeks.push({
        weekNum: getWeekNumber(wDays[3]),
        start: wDays[0],
        end: wDays[6],
        orders: oCount,
        deliveries: dCount,
        shipments: sCount,
      });
    }
    return weeks;
  }, [view, year, month, cellData]);

  const navigateMonth = (dir: number) => {
    setCurrentDate(new Date(year, month + dir, 1));
    setSelectedDate(null);
  };

  const navigateWeek = (dir: number) => {
    const ws = startOfWeek(currentDate);
    setCurrentDate(addDays(ws, dir * 7));
    setSelectedDate(null);
  };

  const today = formatDateKey(new Date());
  const days = view === 'month' ? getMonthDays(year, month) : getWeekDays(startOfWeek(currentDate));

  const selectedOrders = selectedDate ? (ordersByDate[selectedDate] ?? []) : [];
  const selectedDeliveries = selectedDate ? (deliveriesByDate[selectedDate] ?? []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => view === 'month' ? navigateMonth(-1) : navigateWeek(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-display font-semibold text-foreground min-w-[200px] text-center">
            {view === 'month'
              ? `${MONTHS_DE[month]} ${year}`
              : `KW ${getWeekNumber(currentDate)} — ${startOfWeek(currentDate).toLocaleDateString('de-DE')} – ${addDays(startOfWeek(currentDate), 6).toLocaleDateString('de-DE')}`}
          </h2>
          <Button variant="outline" size="icon" onClick={() => view === 'month' ? navigateMonth(1) : navigateWeek(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs ml-2" onClick={() => { setCurrentDate(new Date()); setSelectedDate(null); }}>
            Heute
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dataMode} onValueChange={(v) => setDataMode(v as any)}>
            <SelectTrigger className="w-44 bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orders">
                <span className="flex items-center gap-2"><ClipboardList className="w-3.5 h-3.5" /> Aufträge</span>
              </SelectItem>
              <SelectItem value="deliveries">
                <span className="flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> Auslieferungen</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={v => { setView(v as ViewMode); setSelectedDate(null); }}>
            <TabsList className="bg-secondary">
              <TabsTrigger value="month">Monat</TabsTrigger>
              <TabsTrigger value="week">Woche</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-border bg-secondary/50">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center py-2 text-xs font-medium text-muted-foreground">{d}</div>
          ))}
        </div>

        {/* Days */}
        <div className={`grid grid-cols-7 ${view === 'week' ? '' : 'grid-rows-6'}`}>
          {days.map((day, i) => {
            const key = formatDateKey(day);
            const data = cellData[key];
            const isToday = key === today;
            const isSelected = key === selectedDate;
            const isCurrentMonth = day.getMonth() === month;
            const count = dataMode === 'orders' ? (data?.orders ?? 0) : (data?.deliveries ?? 0);

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(isSelected ? null : key)}
                className={`
                  relative p-2 min-h-[80px] border-b border-r border-border text-left transition-colors
                  ${view === 'month' && !isCurrentMonth ? 'opacity-30' : ''}
                  ${isSelected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-secondary/50'}
                `}
              >
                <span className={`
                  text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full
                  ${isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'}
                `}>
                  {day.getDate()}
                </span>
                {count > 0 && (
                  <div className="mt-1">
                    <span className={`
                      inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md
                      ${dataMode === 'orders' ? 'bg-primary/15 text-primary' : 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]'}
                    `}>
                      {dataMode === 'orders' ? <ClipboardList className="w-2.5 h-2.5" /> : <Truck className="w-2.5 h-2.5" />}
                      {count}
                    </span>
                  </div>
                )}
                {/* Show both if both exist */}
                {dataMode === 'orders' && (data?.deliveries ?? 0) > 0 && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]/70">
                      <Truck className="w-2.5 h-2.5" />{data!.deliveries}
                    </span>
                  </div>
                )}
                {dataMode === 'deliveries' && (data?.orders ?? 0) > 0 && (
                  <div className="mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-primary/10 text-primary/70">
                      <ClipboardList className="w-2.5 h-2.5" />{data!.orders}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weekly Summary (month view only) */}
      {view === 'month' && weekSummary.length > 0 && (
        <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">Wochenübersicht – {MONTHS_DE[month]} {year}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">KW</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Zeitraum</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Aufträge erfasst</th>
                  <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">Auslieferungen geplant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {weekSummary.map(w => (
                  <tr key={w.weekNum} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">KW {w.weekNum}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {w.start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} – {w.end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {w.orders > 0 ? (
                        <span className="inline-flex items-center gap-1 text-primary font-semibold">
                          <ClipboardList className="w-3.5 h-3.5" /> {w.orders}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {w.deliveries > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[hsl(var(--success))] font-semibold">
                          <Truck className="w-3.5 h-3.5" /> {w.deliveries}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Day Detail */}
      {selectedDate && (
        <div className="rounded-xl border border-border bg-card card-glow overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Orders on this day */}
            {selectedOrders.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3" /> Erfasste Aufträge ({selectedOrders.length})
                </h4>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {selectedOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-sm font-medium text-foreground">{o.order_number}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {o.total_amount != null ? Number(o.total_amount).toLocaleString('de-DE', { style: 'currency', currency: o.currency || 'EUR' }) : ''}
                        </span>
                        <StatusBadge status={o.order_status || 'offen'} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Deliveries on this day */}
            {selectedDeliveries.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Truck className="w-3 h-3" /> Geplante Auslieferungen ({selectedDeliveries.length})
                </h4>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {selectedDeliveries.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-sm font-medium text-foreground">
                        {(d.orders as any)?.order_number || '—'}
                      </span>
                      <StatusBadge status={d.planning_status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selectedOrders.length === 0 && selectedDeliveries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Inbox className="w-6 h-6 mb-2 opacity-40" />
                <p className="text-sm">Keine Einträge an diesem Tag.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
