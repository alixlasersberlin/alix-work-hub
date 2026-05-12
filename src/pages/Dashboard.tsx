import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ClipboardList, Users, MapPin, Banknote, AlertCircle,
  Clock, TrendingUp, FileText, CalendarDays, CircleDot, Inbox, Package, ChevronDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  customers: number;
  orders: number;
  openOrders: number;
  routes: number;
  openFinance: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  order_status: string | null;
  total_amount: number | null;
  currency: string | null;
  order_date: string | null;
  expected_shipment_date: string | null;
}

interface ShipmentOrder {
  id: string;
  order_number: string;
  expected_shipment_date: string | null;
  order_status: string | null;
  billing_address: any;
  shipping_address: any;
  customers: { company_name: string | null; contact_name: string | null; shipping_address: any; billing_address: any } | null;
  order_items?: { item_name: string | null; sku: string | null; description: string | null }[] | null;
}

interface RoutePlan {
  id: string;
  planned_date: string | null;
  planning_status: string;
  assigned_employee: string | null;
  priority: string | null;
}

interface FinanceRecord {
  id: string;
  payment_status: string | null;
  invoice_status: string | null;
  due_date: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency: string | null;
}

import { StatusBadge } from '@/components/StatusBadge';

function formatCurrency(amount: number | null, currency: string | null) {
  if (amount == null) return '—';
  return Number(amount).toLocaleString('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
  });
}

function formatDate(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
      <Icon className="w-8 h-8 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="h-9 w-16" />
    </div>
  );
}

function TableSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, roles, hasRole, hasAnyRole, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({ customers: 0, orders: 0, openOrders: 0, routes: 0, openFinance: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [shipmentOrders, setShipmentOrders] = useState<ShipmentOrder[]>([]);
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [shipmentFilter, setShipmentFilter] = useState<number | null>(14);
  const [shipmentLimit, setShipmentLimit] = useState<number | null>(10);
  const [shipmentSearch, setShipmentSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    shipment: true,
    recent: true,
    routes: true,
    finance: true,
  });
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  const canSeeOrders = isAdmin || hasAnyRole(['Auftragsverwaltung', 'Tourenplanung', 'Finance']);
  const canSeeRoutes = isAdmin || hasAnyRole(['Tourenplanung', 'Auftragsverwaltung']);
  const canSeeFinance = isAdmin || hasRole('Finance');
  const canSeeCustomers = isAdmin || hasAnyRole(['Auftragsverwaltung', 'Tourenplanung', 'Finance']);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        // Fetch all data in parallel based on role access
        const customersRes = canSeeCustomers
          ? await supabase.from('customers').select('id', { count: 'exact', head: true })
          : { count: 0 };

        const [ordersRes, openOrdersRes, recentOrdersRes] = canSeeOrders
          ? await Promise.all([
              supabase.from('orders').select('id', { count: 'exact', head: true }),
              supabase.from('orders').select('id', { count: 'exact', head: true }).eq('order_status', 'offen'),
              supabase.from('orders').select('id, order_number, order_status, total_amount, currency, order_date, expected_shipment_date').order('created_at', { ascending: false }).limit(7),
            ])
          : [{ count: 0 }, { count: 0 }, { data: [] }];

        const shipmentOrdersRes = canSeeOrders
          ? await supabase.from('orders').select('id, order_number, expected_shipment_date, order_status, shipping_address, billing_address, customers(company_name, contact_name, shipping_address, billing_address), order_items(item_name, sku, description)').not('expected_shipment_date', 'is', null).order('expected_shipment_date', { ascending: true }).limit(500)
          : { data: [] };

        const [routesRes, routePlansRes] = canSeeRoutes
          ? await Promise.all([
              supabase.from('route_plans').select('id', { count: 'exact', head: true }),
              supabase.from('route_plans').select('id, planned_date, planning_status, assigned_employee, priority').or('planning_status.eq.offen,planning_status.eq.geplant,planning_status.eq.in Bearbeitung').order('planned_date', { ascending: true }).limit(7),
            ])
          : [{ count: 0 }, { data: [] }];

        const [openFinanceRes, financeRes] = canSeeFinance
          ? await Promise.all([
              supabase.from('finance_records').select('id', { count: 'exact', head: true }).eq('payment_status', 'offen'),
              supabase.from('finance_records').select('id, payment_status, invoice_status, due_date, amount_due, amount_paid, currency').or('payment_status.eq.offen,payment_status.eq.teilweise bezahlt,payment_status.eq.überfällig').order('due_date', { ascending: true }).limit(7),
            ])
          : [{ count: 0 }, { data: [] }];

        setStats({
          customers: customersRes.count ?? 0,
          orders: ordersRes.count ?? 0,
          openOrders: openOrdersRes.count ?? 0,
          routes: routesRes.count ?? 0,
          openFinance: openFinanceRes.count ?? 0,
        });
        setRecentOrders(recentOrdersRes.data ?? []);
        setShipmentOrders(shipmentOrdersRes.data ?? []);
        setRoutePlans(routePlansRes.data ?? []);
        setFinanceRecords(financeRes.data ?? []);
      } catch (e: any) {
        setError('Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [canSeeOrders, canSeeRoutes, canSeeFinance, canSeeCustomers]);

  const kpiCards = [
    { label: 'Kunden', value: stats.customers, icon: Users, visible: canSeeCustomers },
    { label: 'Aufträge gesamt', value: stats.orders, icon: ClipboardList, visible: canSeeOrders },
    { label: 'Offene Aufträge', value: stats.openOrders, icon: AlertCircle, visible: canSeeOrders },
    { label: 'Geplante Touren', value: stats.routes, icon: MapPin, visible: canSeeRoutes },
    { label: 'Offene Zahlungen', value: stats.openFinance, icon: Banknote, visible: canSeeFinance },
  ].filter(c => c.visible);

  const kpiColors = [
    'text-[hsl(var(--info))]',
    'text-primary',
    'text-[hsl(var(--warning))]',
    'text-[hsl(var(--success))]',
    'text-destructive',
  ];

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Willkommen zurück, <span className="gold-text">{profile?.full_name || 'Benutzer'}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Ihre aktuelle Übersicht</p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
          : kpiCards.map((card, i) => (
              <div key={card.label} className="rounded-xl border border-border bg-card p-5 card-glow group hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <card.icon className={`w-5 h-5 ${kpiColors[i] || 'text-primary'}`} />
                </div>
                <p className="text-3xl font-display font-bold text-foreground">{card.value}</p>
              </div>
            ))}
      </div>

      {/* Data sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Shipment Dates */}
        {canSeeOrders && (
          <div className="rounded-xl border border-border bg-card card-glow">
            <button
              type="button"
              onClick={() => toggle('shipment')}
              className="w-full flex items-center justify-between gap-2 p-5 hover:bg-secondary/30 transition-colors"
              aria-expanded={!collapsed.shipment}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[hsl(var(--warning))]" />
                <h2 className="font-display font-semibold text-foreground">Lieferdatum</h2>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed.shipment ? '' : 'rotate-180'}`} />
            </button>
            {!collapsed.shipment && (
              <>
                <div className="p-5 border-t border-border space-y-3">
                  <div className="flex items-center justify-end gap-3 flex-wrap">
                    <div className="flex gap-1 flex-wrap">
                      {[{ label: '7T', value: 7 }, { label: '14T', value: 14 }, { label: '30T', value: 30 }, { label: 'Alle', value: null }].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setShipmentFilter(opt.value)}
                          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                            shipmentFilter === opt.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={shipmentSearch}
                      onChange={(e) => setShipmentSearch(e.target.value)}
                      placeholder="Suche: Modell, Auftragsnr., Stadt, Name…"
                      className="flex-1 min-w-[200px] h-8 px-3 text-xs rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-1">
                      {[{ label: '10', value: 10 }, { label: '20', value: 20 }, { label: '30', value: 30 }, { label: '50', value: 50 }, { label: 'Alle', value: null }].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => setShipmentLimit(opt.value)}
                          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                            shipmentLimit === opt.value
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {loading ? (
                  <TableSkeleton />
                ) : (() => {
                  const now = new Date();
                  const EXCLUDED_STATUSES = ['geliefert', 'anwalt', 'teilgeliefert'];
                  const statusFiltered = shipmentOrders.filter(o => {
                    const s = (o.order_status || '').toLowerCase().trim();
                    return !EXCLUDED_STATUSES.includes(s);
                  });
                  const dateFiltered = shipmentFilter === null
                    ? statusFiltered
                    : statusFiltered.filter(o => {
                        if (!o.expected_shipment_date) return false;
                        const diff = (new Date(o.expected_shipment_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                        return diff <= shipmentFilter;
                      });
                  const q = shipmentSearch.trim().toLowerCase();
                  const searched = !q ? dateFiltered : dateFiltered.filter(o => {
                    const name = (o.customers?.company_name || '') + ' ' + (o.customers?.contact_name || '');
                    const addr = o.shipping_address || o.customers?.shipping_address || o.billing_address || o.customers?.billing_address || {};
                    const city = (addr.city || addr.state || '').toString();
                    const items = (o.order_items || []).map(i => `${i.item_name || ''} ${i.sku || ''} ${i.description || ''}`).join(' ');
                    const hay = `${o.order_number || ''} ${name} ${city} ${items}`.toLowerCase();
                    return hay.includes(q);
                  });
                  const filtered = shipmentLimit === null ? searched : searched.slice(0, shipmentLimit);
                  return filtered.length === 0 ? (
                    <EmptyState icon={Package} message="Keine Versanddaten im gewählten Zeitraum." />
                  ) : (
                    <div className="divide-y divide-border border-t border-border">
                      {filtered.map(order => {
                        const name = order.customers?.company_name || order.customers?.contact_name || '—';
                        const hasAddr = (a: any) => a && (a.address || a.street || a.city || a.zip || a.postal_code);
                        const addr = (hasAddr(order.shipping_address) ? order.shipping_address : null)
                          || (hasAddr(order.customers?.shipping_address) ? order.customers?.shipping_address : null)
                          || (hasAddr(order.billing_address) ? order.billing_address : null)
                          || (hasAddr(order.customers?.billing_address) ? order.customers?.billing_address : null);
                        const addrStreet = addr?.street || addr?.address || '';
                        const addrZip = addr?.zip || addr?.postal_code || addr?.postcode || '';
                        const addrCity = addr?.city || addr?.state || '';
                        const addrLine = [addrStreet, addrZip, addrCity].filter(Boolean).join(', ');
                        return (
                          <div
                            key={order.id}
                            onClick={() => navigate(`/auftraege/${order.id}`)}
                            className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                          >
                            <div>
                              <p className="text-sm font-medium text-foreground">{name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {order.order_number}
                              </p>
                              {addrLine && (
                                <p className="text-xs text-muted-foreground mt-0.5">📍 {addrLine}</p>
                              )}
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <span className="text-sm font-medium text-foreground">{formatDate(order.expected_shipment_date)}</span>
                              <StatusBadge status={order.order_status || 'offen'} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Recent Orders */}
        {canSeeOrders && (
          <div className="rounded-xl border border-border bg-card card-glow">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-foreground">Letzte Aufträge</h2>
            </div>
            {loading ? (
              <TableSkeleton />
            ) : recentOrders.length === 0 ? (
              <EmptyState icon={Inbox} message="Keine Aufträge vorhanden." />
            ) : (
              <div className="divide-y divide-border">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Bestellt: {formatDate(order.order_date)}
                        {order.expected_shipment_date && (
                          <span className="ml-2">· Lieferung: {formatDate(order.expected_shipment_date)}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <StatusBadge status={order.order_status || 'offen'} />
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(order.total_amount, order.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Route Plans */}
        {canSeeRoutes && (
          <div className="rounded-xl border border-border bg-card card-glow">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <CalendarDays className="w-4 h-4 text-[hsl(var(--success))]" />
              <h2 className="font-display font-semibold text-foreground">Tourenübersicht</h2>
            </div>
            {loading ? (
              <TableSkeleton />
            ) : routePlans.length === 0 ? (
              <EmptyState icon={MapPin} message="Keine offenen Touren vorhanden." />
            ) : (
              <div className="divide-y divide-border">
                {routePlans.map(route => (
                  <div key={route.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {route.assigned_employee || 'Nicht zugewiesen'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(route.planned_date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {route.priority && route.priority !== 'normal' && (
                        <StatusBadge status={route.priority} />
                      )}
                      <StatusBadge status={route.planning_status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Finance Overview */}
        {canSeeFinance && (
          <div className="rounded-xl border border-border bg-card card-glow xl:col-span-2">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <FileText className="w-4 h-4 text-[hsl(var(--warning))]" />
              <h2 className="font-display font-semibold text-foreground">Offene Finance-Vorgänge</h2>
            </div>
            {loading ? (
              <TableSkeleton rows={4} />
            ) : financeRecords.length === 0 ? (
              <EmptyState icon={Banknote} message="Keine offenen Finance-Vorgänge." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left font-medium p-4">Zahlungsstatus</th>
                      <th className="text-left font-medium p-4">Rechnungsstatus</th>
                      <th className="text-left font-medium p-4">Fällig am</th>
                      <th className="text-right font-medium p-4">Offen</th>
                      <th className="text-right font-medium p-4">Bezahlt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {financeRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-4">
                          <StatusBadge status={rec.payment_status || '—'} />
                        </td>
                        <td className="p-4">
                          <StatusBadge status={rec.invoice_status || '—'} />
                        </td>
                        <td className="p-4 text-muted-foreground">{formatDate(rec.due_date)}</td>
                        <td className="p-4 text-right text-foreground font-medium">
                          {formatCurrency(rec.amount_due, rec.currency)}
                        </td>
                        <td className="p-4 text-right text-muted-foreground">
                          {formatCurrency(rec.amount_paid, rec.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
