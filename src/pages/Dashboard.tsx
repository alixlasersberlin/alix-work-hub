import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ClipboardList, Users, MapPin, Banknote, AlertCircle,
  Clock, TrendingUp, FileText, CalendarDays, CircleDot, Inbox, Package, ChevronDown,
  Warehouse, PackageCheck, ShieldAlert, UserCheck, Crown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { VipBadge } from '@/components/VipBadge';

import { SidebarInfoBar } from '@/components/SidebarInfoBar';

interface Stats {
  freePoolDevices: number;
  leihgeraete: number;
  openOrders: number;
  routes: number;
  openFinance: number;
  vipCustomers: number;
  vipOrders: number;
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

interface ActiveSession {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string | null;
  ip_address: string | null;
  device_info: string | null;
  user_profiles?: { full_name: string | null; email: string | null } | null;
}

interface SecurityIncident {
  id: string;
  created_at: string;
  action: string;
  module: string;
  ip_address: string | null;
  details: any;
  user_profiles?: { full_name: string | null; email: string | null } | null;
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
  const [stats, setStats] = useState<Stats>({ freePoolDevices: 0, leihgeraete: 0, openOrders: 0, routes: 0, openFinance: 0, vipCustomers: 0, vipOrders: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [shipmentOrders, setShipmentOrders] = useState<ShipmentOrder[]>([]);
  const [routePlans, setRoutePlans] = useState<RoutePlan[]>([]);
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [securityIncidents, setSecurityIncidents] = useState<SecurityIncident[]>([]);
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
    sessions: false,
    security: false,
  });
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  const canSeeOrders = isAdmin || hasAnyRole(['Auftragsverwaltung', 'Tourenplanung', 'Finance']);
  const canSeeRoutes = isAdmin || hasAnyRole(['Tourenplanung', 'Auftragsverwaltung']);
  const canSeeFinance = isAdmin || hasRole('Finance');
  const canSeeCustomers = isAdmin || hasAnyRole(['Auftragsverwaltung', 'Tourenplanung', 'Finance']);
  const canSeeAudit = isAdmin || hasRole('Read Only Audit');

  useEffect(() => {
    async function load() {
      try {
        setError(null);

        // Lager-Geräte für die KPI-Karten (Freie Pool-Geräte + Leihgeräte gesamt)
        const lagerRes = isAdmin
          ? await supabase.from('lager_devices').select('notes, reserved_order_id')
          : { data: [] as { notes: string | null; reserved_order_id: string | null }[] };

        const getStatus = (n: string | null | undefined) => {
          const m = /\[Status:\s*([^\]]+)\]/.exec(n ?? '');
          return (m?.[1] ?? '').trim();
        };
        const isLeih = (n: string | null | undefined) =>
          (n ?? '').includes('[Typ: Leihgerät]') || (n ?? '').includes('[Leihgerät]');

        let freePoolDevices = 0;
        let leihgeraete = 0;
        for (const d of (lagerRes.data ?? []) as { notes: string | null; reserved_order_id: string | null }[]) {
          if (isLeih(d.notes)) {
            leihgeraete++;
            continue;
          }
          // Pool = alle Nicht-Leihgeräte (Bestand, Transfer, Produktion, Hold, Warehouse).
          // Frei = nicht reserviert und nicht im Status "Hold".
          const status = getStatus(d.notes);
          if (d.reserved_order_id == null && status !== 'Hold') {
            freePoolDevices++;
          }
        }

        const [openOrdersRes, recentOrdersRes] = canSeeOrders
          ? await Promise.all([
              supabase.from('orders').select('id', { count: 'exact', head: true }).eq('order_status', 'offen'),
              supabase.from('orders').select('id, order_number, order_status, total_amount, currency, order_date, expected_shipment_date').order('created_at', { ascending: false }).limit(7),
            ])
          : [{ count: 0 }, { data: [] }];

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

        const sessionsRes = isAdmin
          ? await supabase
              .from('login_sessions')
              .select('id, user_id, created_at, expires_at, ip_address, device_info, user_profiles!login_sessions_user_id_fkey(full_name, email)')
              .eq('is_active', true)
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(20)
          : { data: [] };

        const incidentsRes = canSeeAudit
          ? await supabase
              .from('audit_logs')
              .select('id, created_at, action, module, ip_address, details, user_profiles!audit_logs_user_id_fkey(full_name, email)')
              .or('action.ilike.%fail%,action.ilike.%denied%,action.ilike.%unauthorized%,action.ilike.%block%,action.ilike.%suspicious%,action.ilike.%mfa%,action.ilike.%delete%,action.ilike.%reauth%,module.eq.security,module.eq.auth')
              .order('created_at', { ascending: false })
              .limit(15)
          : { data: [] };

        const [vipCustomersRes, vipOrdersRes] = canSeeCustomers
          ? await Promise.all([
              supabase.from('customers').select('id', { count: 'exact', head: true }).eq('is_vip', true),
              supabase.from('orders').select('id', { count: 'exact', head: true }).eq('is_vip', true),
            ])
          : [{ count: 0 }, { count: 0 }];

        setStats({
          freePoolDevices,
          leihgeraete,
          openOrders: openOrdersRes.count ?? 0,
          routes: routesRes.count ?? 0,
          openFinance: openFinanceRes.count ?? 0,
          vipCustomers: vipCustomersRes.count ?? 0,
          vipOrders: vipOrdersRes.count ?? 0,
        });
        setRecentOrders(recentOrdersRes.data ?? []);
        setShipmentOrders(shipmentOrdersRes.data ?? []);
        setRoutePlans(routePlansRes.data ?? []);
        setFinanceRecords(financeRes.data ?? []);
        setActiveSessions((sessionsRes.data ?? []) as any);
        setSecurityIncidents((incidentsRes.data ?? []) as any);
      } catch (e: any) {
        setError('Daten konnten nicht geladen werden. Bitte versuchen Sie es erneut.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [canSeeOrders, canSeeRoutes, canSeeFinance, isAdmin, canSeeAudit]);

  const kpiCards = [
    { label: 'Freie Geräte (Pool)', value: stats.freePoolDevices, icon: PackageCheck, visible: isAdmin, onClick: () => navigate('/lager/equipment-area') },
    { label: 'Leihgeräte', value: stats.leihgeraete, icon: Warehouse, visible: isAdmin, onClick: () => navigate('/lager/leihgeraete') },
    { label: 'Offene Aufträge', value: stats.openOrders, icon: AlertCircle, visible: canSeeOrders, onClick: () => navigate('/auftraege') },
    { label: 'Geplante Touren', value: stats.routes, icon: MapPin, visible: canSeeRoutes, onClick: () => navigate('/tourenplanung') },
    { label: 'Offene Zahlungen', value: stats.openFinance, icon: Banknote, visible: canSeeFinance, onClick: () => navigate('/finance') },
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
      {/* Info-Leiste (KW, Datum, Uhrzeiten, Wetter) */}
      <div className="rounded-xl border border-border overflow-hidden">
        <SidebarInfoBar />
      </div>





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

      {/* VIP Status */}
      {canSeeCustomers && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => navigate('/kunden')}
            className="text-left rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.04] to-transparent p-5 shadow-[0_0_30px_-12px_hsl(45_100%_50%/0.55)] hover:border-amber-300/70 hover:shadow-[0_0_40px_-10px_hsl(45_100%_50%/0.7)] transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <VipBadge size="md" />
                <span className="text-sm font-medium text-foreground/90">VIP-Kunden</span>
              </div>
              <Crown className="w-5 h-5 fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-4xl font-display font-bold text-foreground tabular-nums">
              {loading ? <Skeleton className="h-10 w-16 inline-block" /> : stats.vipCustomers}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Bevorzugte Kunden – Position 1 in allen Listen</p>
          </button>
          {canSeeOrders && (
            <button
              type="button"
              onClick={() => navigate('/auftraege')}
              className="text-left rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.04] to-transparent p-5 shadow-[0_0_30px_-12px_hsl(45_100%_50%/0.55)] hover:border-amber-300/70 hover:shadow-[0_0_40px_-10px_hsl(45_100%_50%/0.7)] transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <VipBadge size="md" />
                  <span className="text-sm font-medium text-foreground/90">VIP-Aufträge</span>
                </div>
                <Crown className="w-5 h-5 fill-amber-400 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-4xl font-display font-bold text-foreground tabular-nums">
                {loading ? <Skeleton className="h-10 w-16 inline-block" /> : stats.vipOrders}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Als VIP markierte Aufträge mit höchster Priorität</p>
            </button>
          )}
        </div>
      )}


      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
          : kpiCards.map((card, i) => (
              <button
                key={card.label}
                type="button"
                onClick={card.onClick}
                className="text-left rounded-xl border border-border bg-card p-5 card-glow group hover:border-primary/30 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{card.label}</span>
                  <card.icon className={`w-5 h-5 ${kpiColors[i] || 'text-primary'}`} />
                </div>
                <p className="text-3xl font-display font-bold text-foreground">{card.value}</p>
              </button>
            ))}
      </div>

      {/* Data sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Shipment Dates */}
        {canSeeOrders && !isAdmin && (
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
        {canSeeOrders && !isAdmin && (
          <div className="rounded-xl border border-border bg-card card-glow">
            <button
              type="button"
              onClick={() => toggle('recent')}
              className="w-full flex items-center justify-between gap-2 p-5 hover:bg-secondary/30 transition-colors"
              aria-expanded={!collapsed.recent}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="font-display font-semibold text-foreground">Letzte Aufträge</h2>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed.recent ? '' : 'rotate-180'}`} />
            </button>
            {!collapsed.recent && (loading ? (
              <TableSkeleton />
            ) : recentOrders.length === 0 ? (
              <EmptyState icon={Inbox} message="Keine Aufträge vorhanden." />
            ) : (
              <div className="divide-y divide-border border-t border-border">
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
            ))}
          </div>
        )}

        {/* Route Plans */}
        {canSeeRoutes && !isAdmin && (
          <div className="rounded-xl border border-border bg-card card-glow">
            <button
              type="button"
              onClick={() => toggle('routes')}
              className="w-full flex items-center justify-between gap-2 p-5 hover:bg-secondary/30 transition-colors"
              aria-expanded={!collapsed.routes}
            >
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[hsl(var(--success))]" />
                <h2 className="font-display font-semibold text-foreground">Tourenübersicht</h2>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed.routes ? '' : 'rotate-180'}`} />
            </button>
            {!collapsed.routes && (loading ? (
              <TableSkeleton />
            ) : routePlans.length === 0 ? (
              <EmptyState icon={MapPin} message="Keine offenen Touren vorhanden." />
            ) : (
              <div className="divide-y divide-border border-t border-border">
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
            ))}
          </div>
        )}

        {/* Finance Overview */}
        {canSeeFinance && !isAdmin && (
          <div className="rounded-xl border border-border bg-card card-glow xl:col-span-2">
            <button
              type="button"
              onClick={() => toggle('finance')}
              className="w-full flex items-center justify-between gap-2 p-5 hover:bg-secondary/30 transition-colors"
              aria-expanded={!collapsed.finance}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[hsl(var(--warning))]" />
                <h2 className="font-display font-semibold text-foreground">Offene Finance-Vorgänge</h2>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed.finance ? '' : 'rotate-180'}`} />
            </button>
            {!collapsed.finance && (loading ? (
              <TableSkeleton rows={4} />
            ) : financeRecords.length === 0 ? (
              <EmptyState icon={Banknote} message="Keine offenen Finance-Vorgänge." />
            ) : (
              <div className="overflow-x-auto border-t border-border">
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
            ))}
          </div>
        )}
      </div>

      {/* Admin: Active Sessions + Security Incidents */}
      {(isAdmin || canSeeAudit) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {isAdmin && (
            <div className="rounded-xl border border-border bg-card card-glow">
              <button
                type="button"
                onClick={() => toggle('sessions')}
                className="w-full flex items-center justify-between gap-2 p-5 hover:bg-secondary/30 transition-colors"
                aria-expanded={!collapsed.sessions}
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[hsl(var(--success))]" />
                  <h2 className="font-display font-semibold text-foreground">Aktive Sitzungen</h2>
                  <span className="ml-1 text-xs text-muted-foreground">({activeSessions.length})</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed.sessions ? '' : 'rotate-180'}`} />
              </button>
              {!collapsed.sessions && (loading ? (
                <TableSkeleton />
              ) : activeSessions.length === 0 ? (
                <EmptyState icon={UserCheck} message="Aktuell ist niemand eingeloggt." />
              ) : (
                <div className="divide-y divide-border border-t border-border max-h-96 overflow-y-auto">
                  {activeSessions.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {s.user_profiles?.full_name || s.user_profiles?.email || s.user_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {s.user_profiles?.email || '—'}
                        </p>
                        {(s.ip_address || s.device_info) && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {s.ip_address || ''}{s.ip_address && s.device_info ? ' · ' : ''}{s.device_info || ''}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-xs text-muted-foreground">seit</p>
                        <p className="text-xs text-foreground">{new Date(s.created_at).toLocaleString('de-DE')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {canSeeAudit && (
            <div className="rounded-xl border border-border bg-card card-glow">
              <button
                type="button"
                onClick={() => toggle('security')}
                className="w-full flex items-center justify-between gap-2 p-5 hover:bg-secondary/30 transition-colors"
                aria-expanded={!collapsed.security}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                  <h2 className="font-display font-semibold text-foreground">Sicherheitsvorfälle</h2>
                  <span className="ml-1 text-xs text-muted-foreground">({securityIncidents.length})</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${collapsed.security ? '' : 'rotate-180'}`} />
              </button>
              {!collapsed.security && (loading ? (
                <TableSkeleton />
              ) : securityIncidents.length === 0 ? (
                <EmptyState icon={ShieldAlert} message="Keine sicherheitsrelevanten Vorfälle." />
              ) : (
                <div className="divide-y divide-border border-t border-border max-h-96 overflow-y-auto">
                  {securityIncidents.map(i => (
                    <div
                      key={i.id}
                      className="flex items-start justify-between p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate('/logfiles')}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-destructive truncate">{i.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {i.module}{i.user_profiles?.full_name ? ` · ${i.user_profiles.full_name}` : ''}{i.ip_address ? ` · ${i.ip_address}` : ''}
                        </p>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString('de-DE')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
