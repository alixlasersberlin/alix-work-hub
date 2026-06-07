import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  ClipboardList, Users, Banknote, AlertCircle, Clock, TrendingUp,
  Package, Crown, CheckCircle2, Factory, Truck, FileText, Calendar, ChevronDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const AT = 'zoho_eu_2';

interface Kpi {
  label: string;
  value: number | string;
  icon: any;
  onClick?: () => void;
  hint?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  order_status: string | null;
  total_amount: number | null;
  currency: string | null;
  order_date: string | null;
  expected_shipment_date: string | null;
  is_vip: boolean | null;
  customers?: { company_name: string | null; contact_name: string | null } | null;
}

interface CustomerRow {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  is_vip: boolean | null;
  revenue: number;
  orders: number;
}

interface ProductionRow {
  id: string;
  production_order_number: string | null;
  approval_status: string | null;
  is_reclamation: boolean | null;
  liefertermin: string | null;
  modellname: string | null;
  orders?: { order_number: string | null; source_system: string | null } | null;
}

interface FinanceRow {
  id: string;
  payment_status: string | null;
  invoice_status: string | null;
  due_date: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency: string | null;
  orders?: { order_number: string | null; source_system: string | null } | null;
}

const fmtEur = (n: number | null | undefined, cur = 'EUR') =>
  new Intl.NumberFormat('de-AT', { style: 'currency', currency: cur || 'EUR' }).format(n ?? 0);

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function AtDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [counts, setCounts] = useState({
    customers: 0, customersVip: 0,
    orders: 0, ordersOpen: 0, ordersDelivered: 0, ordersOverdue: 0,
    revenue: 0, openInvoiceAmount: 0,
    production: 0, productionPending: 0, productionReclamation: 0,
    upcomingShipments: 0,
  });

  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [upcoming, setUpcoming] = useState<OrderRow[]>([]);
  const [topCustomers, setTopCustomers] = useState<CustomerRow[]>([]);
  const [production, setProduction] = useState<ProductionRow[]>([]);
  const [finance, setFinance] = useState<FinanceRow[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    upcoming: false, recent: true, top: true, prod: true, finance: true, status: true,
  });
  const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setError(null);
        const today = new Date().toISOString().slice(0, 10);
        const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

        const [
          customersRes, customersVipRes,
          ordersAllRes, ordersOpenRes, ordersDeliveredRes,
          allOrderAmounts, orderStatusBreakdown,
          recentRes, upcomingRes, overdueRes,
          prodAllRes, prodPendingRes, prodReclamRes, prodListRes,
          financeListRes,
          topCustomersRaw,
        ] = await Promise.all([
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('source_system', AT),
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('source_system', AT).eq('is_vip', true),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('source_system', AT),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('source_system', AT).in('order_status', ['offen', 'Offen', 'open', 'Open', 'approved', 'Approved', 'invoiced', 'Invoiced']),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('source_system', AT).eq('order_status', 'geliefert'),
          supabase.from('orders').select('total_amount, currency, order_status').eq('source_system', AT),
          supabase.from('orders').select('order_status').eq('source_system', AT),
          supabase.from('orders').select('id, order_number, order_status, total_amount, currency, order_date, expected_shipment_date, is_vip, customers(company_name, contact_name)').eq('source_system', AT).order('created_at', { ascending: false }).limit(8),
          supabase.from('orders').select('id, order_number, order_status, total_amount, currency, order_date, expected_shipment_date, is_vip, customers(company_name, contact_name)').eq('source_system', AT).not('expected_shipment_date', 'is', null).gte('expected_shipment_date', today).lte('expected_shipment_date', in14).order('expected_shipment_date', { ascending: true }).limit(20),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('source_system', AT).not('expected_shipment_date', 'is', null).lt('expected_shipment_date', today).not('order_status', 'in', '("geliefert","storniert","cancelled")'),
          supabase.from('production_orders').select('id, orders!inner(source_system)', { count: 'exact', head: true }).eq('orders.source_system', AT),
          supabase.from('production_orders').select('id, orders!inner(source_system)', { count: 'exact', head: true }).eq('orders.source_system', AT).eq('approval_status', 'pending'),
          supabase.from('production_orders').select('id, orders!inner(source_system)', { count: 'exact', head: true }).eq('orders.source_system', AT).eq('is_reclamation', true),
          supabase.from('production_orders').select('id, production_order_number, approval_status, is_reclamation, liefertermin, modellname, orders!inner(order_number, source_system)').eq('orders.source_system', AT).order('created_at', { ascending: false }).limit(8),
          supabase.from('finance_records').select('id, payment_status, invoice_status, due_date, amount_due, amount_paid, currency, orders!inner(order_number, source_system)').eq('orders.source_system', AT).or('payment_status.eq.offen,payment_status.eq.teilweise bezahlt,payment_status.eq.überfällig').order('due_date', { ascending: true }).limit(10),
          supabase.from('orders').select('customer_id, total_amount, customers(id, company_name, contact_name, is_vip)').eq('source_system', AT),
        ]);

        if (!alive) return;

        // Revenue + status breakdown
        const revenue = (allOrderAmounts.data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
        const sbreak: Record<string, number> = {};
        for (const r of (orderStatusBreakdown.data ?? []) as any[]) {
          const k = r.order_status ?? 'unbekannt';
          sbreak[k] = (sbreak[k] ?? 0) + 1;
        }

        // Top customers aggregation
        const agg = new Map<string, CustomerRow>();
        for (const r of (topCustomersRaw.data ?? []) as any[]) {
          const c = r.customers;
          if (!c) continue;
          const cur = agg.get(c.id) ?? {
            id: c.id, company_name: c.company_name, contact_name: c.contact_name,
            is_vip: !!c.is_vip, revenue: 0, orders: 0,
          };
          cur.revenue += Number(r.total_amount ?? 0);
          cur.orders += 1;
          agg.set(c.id, cur);
        }
        const top = Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

        // Open invoice amount
        const openInvoiceAmount = (financeListRes.data ?? []).reduce(
          (s: number, r: any) => s + (Number(r.amount_due ?? 0) - Number(r.amount_paid ?? 0)),
          0,
        );

        setCounts({
          customers: customersRes.count ?? 0,
          customersVip: customersVipRes.count ?? 0,
          orders: ordersAllRes.count ?? 0,
          ordersOpen: ordersOpenRes.count ?? 0,
          ordersDelivered: ordersDeliveredRes.count ?? 0,
          ordersOverdue: overdueRes.count ?? 0,
          revenue,
          openInvoiceAmount,
          production: prodAllRes.count ?? 0,
          productionPending: prodPendingRes.count ?? 0,
          productionReclamation: prodReclamRes.count ?? 0,
          upcomingShipments: (upcomingRes.data ?? []).length,
        });
        setRecentOrders((recentRes.data ?? []) as any);
        setUpcoming((upcomingRes.data ?? []) as any);
        setProduction((prodListRes.data ?? []) as any);
        setFinance((financeListRes.data ?? []) as any);
        setTopCustomers(top);
        setStatusBreakdown(sbreak);
      } catch (e: any) {
        if (alive) setError('Daten konnten nicht geladen werden.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const kpis: Kpi[] = useMemo(() => [
    { label: 'Kunden -AT', value: counts.customers, icon: Users, onClick: () => navigate('/kunden') },
    { label: 'VIP-Kunden -AT', value: counts.customersVip, icon: Crown },
    { label: 'Aufträge -AT', value: counts.orders, icon: ClipboardList, onClick: () => navigate('/auftraege-at') },
    { label: 'Offene Aufträge', value: counts.ordersOpen, icon: AlertCircle, onClick: () => navigate('/auftraege-at') },
    { label: 'Gelieferte Aufträge', value: counts.ordersDelivered, icon: CheckCircle2 },
    { label: 'Überfällig', value: counts.ordersOverdue, icon: Clock },
    { label: 'Produktion -AT', value: counts.production, icon: Factory, hint: `${counts.productionPending} ausstehende Freigabe` },
    { label: 'Reklamationen', value: counts.productionReclamation, icon: AlertCircle },
    { label: 'Umsatz gesamt', value: fmtEur(counts.revenue), icon: TrendingUp },
    { label: 'Offene Rechnungen', value: fmtEur(counts.openInvoiceAmount), icon: Banknote },
    { label: 'Versand (14 Tage)', value: counts.upcomingShipments, icon: Truck },
  ], [counts, navigate]);

  return (
    <div className="p-6 lg:p-8 animate-fade-in space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🇦🇹</span>
          <h1 className="text-2xl font-display font-bold text-foreground">
            <span className="gold-text">Alix Austria</span> – Dashboard
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Willkommen zurück, {profile?.full_name || 'Benutzer'}. Übersicht aller -AT Aufträge, Kunden und Finanzen.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.label}
              onClick={k.onClick}
              disabled={!k.onClick}
              className={`group rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-lg ${k.onClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</p>
                  {loading ? (
                    <Skeleton className="h-7 w-20 mt-2" />
                  ) : (
                    <p className="text-2xl font-display font-bold text-foreground mt-1 truncate">{k.value}</p>
                  )}
                  {k.hint && <p className="text-[11px] text-muted-foreground mt-1">{k.hint}</p>}
                </div>
                <Icon className="w-5 h-5 text-primary flex-shrink-0" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Status Breakdown */}
      <Section title="Auftrags-Status (Alix Austria)" open={!collapsed.status} onToggle={() => toggle('status')} icon={ClipboardList}>
        {loading ? (
          <Skeleton className="h-20" />
        ) : Object.keys(statusBreakdown).length === 0 ? (
          <EmptyHint text="Keine Aufträge gefunden." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
              <div key={s} className="rounded-lg border border-border bg-background/40 p-3">
                <p className="text-xs text-muted-foreground truncate">{s}</p>
                <p className="text-xl font-display font-bold text-foreground">{n}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Upcoming shipments */}
      <Section title="Kommende Lieferungen (14 Tage)" open={!collapsed.upcoming} onToggle={() => toggle('upcoming')} icon={Truck}>
        <OrderTable rows={upcoming} loading={loading} navigate={navigate} dateField="expected_shipment_date" emptyText="Keine geplanten Lieferungen." />
      </Section>

      {/* Recent orders */}
      <Section title="Aktuelle Aufträge" open={!collapsed.recent} onToggle={() => toggle('recent')} icon={ClipboardList}>
        <OrderTable rows={recentOrders} loading={loading} navigate={navigate} dateField="order_date" emptyText="Keine Aufträge." />
      </Section>

      {/* Top customers */}
      <Section title="Top Kunden -AT (nach Umsatz)" open={!collapsed.top} onToggle={() => toggle('top')} icon={Users}>
        {loading ? (
          <Skeleton className="h-24" />
        ) : topCustomers.length === 0 ? (
          <EmptyHint text="Keine Kunden gefunden." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Kunde</th>
                  <th className="text-right px-3 py-2">Aufträge</th>
                  <th className="text-right px-3 py-2">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/kunden/${c.id}`)}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {c.is_vip && <Crown className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />}
                        <span className="font-medium text-foreground truncate">
                          {c.company_name || c.contact_name || '—'}
                        </span>
                        <span className="text-xs text-muted-foreground">-AT</span>
                      </div>
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums">{c.orders}</td>
                    <td className="text-right px-3 py-2 tabular-nums font-medium">{fmtEur(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Production */}
      <Section title="Produktion -AT" open={!collapsed.prod} onToggle={() => toggle('prod')} icon={Factory}>
        {loading ? (
          <Skeleton className="h-24" />
        ) : production.length === 0 ? (
          <EmptyHint text="Keine Produktionsaufträge." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Produktions-Nr.</th>
                  <th className="text-left px-3 py-2">Auftrag</th>
                  <th className="text-left px-3 py-2">Modell</th>
                  <th className="text-left px-3 py-2">Liefertermin</th>
                  <th className="text-left px-3 py-2">Freigabe</th>
                  <th className="text-left px-3 py-2">Typ</th>
                </tr>
              </thead>
              <tbody>
                {production.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{p.production_order_number || '—'}</td>
                    <td className="px-3 py-2">{p.orders?.order_number ? `${p.orders.order_number}-AT` : '—'}</td>
                    <td className="px-3 py-2">{p.modellname || '—'}</td>
                    <td className="px-3 py-2">{fmtDate(p.liefertermin)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={p.approval_status} kind="approval" />
                    </td>
                    <td className="px-3 py-2">
                      {p.is_reclamation
                        ? <span className="text-xs text-destructive font-medium">Reklamation</span>
                        : <span className="text-xs text-muted-foreground">Standard</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Finance */}
      <Section title="Offene Zahlungen -AT" open={!collapsed.finance} onToggle={() => toggle('finance')} icon={Banknote}>
        {loading ? (
          <Skeleton className="h-24" />
        ) : finance.length === 0 ? (
          <EmptyHint text="Keine offenen Zahlungen." />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Auftrag</th>
                  <th className="text-left px-3 py-2">Fällig</th>
                  <th className="text-left px-3 py-2">Zahlstatus</th>
                  <th className="text-right px-3 py-2">Offen</th>
                </tr>
              </thead>
              <tbody>
                {finance.map((f) => (
                  <tr key={f.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2">{f.orders?.order_number ? `${f.orders.order_number}-AT` : '—'}</td>
                    <td className="px-3 py-2">{fmtDate(f.due_date)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge value={f.payment_status} kind="payment" />
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums font-medium">
                      {fmtEur((Number(f.amount_due ?? 0) - Number(f.amount_paid ?? 0)), f.currency ?? 'EUR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title, open, onToggle, icon: Icon, children,
}: { title: string; open: boolean; onToggle: () => void; icon: any; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">{title}</h2>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}

function OrderTable({
  rows, loading, navigate, dateField, emptyText,
}: {
  rows: OrderRow[];
  loading: boolean;
  navigate: (path: string) => void;
  dateField: 'order_date' | 'expected_shipment_date';
  emptyText: string;
}) {
  if (loading) return <Skeleton className="h-24" />;
  if (rows.length === 0) return <EmptyHint text={emptyText} />;
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2">Auftrag</th>
            <th className="text-left px-3 py-2">Kunde</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">{dateField === 'order_date' ? 'Datum' : 'Liefertermin'}</th>
            <th className="text-right px-3 py-2">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr
              key={o.id}
              className="border-t border-border hover:bg-muted/30 cursor-pointer"
              onClick={() => navigate(`/auftraege/${o.id}`)}
            >
              <td className="px-3 py-2 font-medium">
                <div className="flex items-center gap-1.5">
                  {o.is_vip && <Crown className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />}
                  <span>{o.order_number}-AT</span>
                </div>
              </td>
              <td className="px-3 py-2 truncate max-w-[220px]">
                {o.customers?.company_name || o.customers?.contact_name || '—'}
              </td>
              <td className="px-3 py-2">
                <StatusBadge value={o.order_status} kind="order" />
              </td>
              <td className="px-3 py-2">{fmtDate(o[dateField])}</td>
              <td className="text-right px-3 py-2 tabular-nums">
                {fmtEur(o.total_amount, o.currency ?? 'EUR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ value, kind }: { value: string | null | undefined; kind: 'order' | 'payment' | 'approval' }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const v = value.toLowerCase();
  let cls = 'bg-muted text-muted-foreground';
  if (kind === 'order') {
    if (v.includes('geliefert')) cls = 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]';
    else if (v.includes('offen') || v === 'open') cls = 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]';
    else if (v.includes('invoiced')) cls = 'bg-primary/15 text-primary';
    else if (v.includes('anwalt') || v.includes('hold') || v.includes('zurück')) cls = 'bg-destructive/15 text-destructive';
    else if (v.includes('teil')) cls = 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]';
  } else if (kind === 'payment') {
    if (v.includes('offen')) cls = 'bg-[hsl(var(--info))]/15 text-[hsl(var(--info))]';
    else if (v.includes('teil')) cls = 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]';
    else if (v.includes('überfällig')) cls = 'bg-destructive/15 text-destructive';
    else if (v.includes('bezahlt')) cls = 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]';
  } else if (kind === 'approval') {
    if (v === 'approved' || v.includes('freigegeben')) cls = 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]';
    else if (v === 'pending' || v.includes('warte')) cls = 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]';
    else if (v.includes('reject') || v.includes('abgelehnt')) cls = 'bg-destructive/15 text-destructive';
  }
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${cls}`}>{value}</span>;
}
