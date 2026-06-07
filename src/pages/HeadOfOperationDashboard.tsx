import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, ClipboardList, Factory, Banknote, Ticket, Wrench, Warehouse,
  ShieldAlert, Activity, TrendingUp, Globe, AlertTriangle, MapPin, Bug,
  Package, ShieldCheck, AlertCircle, Mail, Clock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Counts {
  usersTotal: number;
  usersActive: number;
  sessionsActive: number;
  customersTotal: number;
  customersDe: number;
  customersAt: number;
  ordersTotal: number;
  ordersDe: number;
  ordersAt: number;
  ordersOpen: number;
  ordersOverdue: number;
  revenueDe: number;
  revenueAt: number;
  production: number;
  productionPending: number;
  productionReclamation: number;
  financeOpen: number;
  financeAmountOpen: number;
  ticketsOpen: number;
  repairsOpen: number;
  routes: number;
  routesToday: number;
  lagerDevices: number;
  itemsTotal: number;
  stockOnHand: number;
  bugsOpen: number;
  capasOpen: number;
  warrantyActive: number;
  audits24h: number;
  securityIncidents24h: number;
}

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  module: string;
  user_profiles?: { full_name: string | null; email: string | null } | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  ip_address: string | null;
  user_profiles?: { full_name: string | null; email: string | null } | null;
}

const fmtEur = (n: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function HeadOfOperationDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [c, setC] = useState<Counts>({
    usersTotal: 0, usersActive: 0, sessionsActive: 0,
    customersTotal: 0, customersDe: 0, customersAt: 0,
    ordersTotal: 0, ordersDe: 0, ordersAt: 0, ordersOpen: 0, ordersOverdue: 0,
    revenueDe: 0, revenueAt: 0,
    production: 0, productionPending: 0, productionReclamation: 0,
    financeOpen: 0, financeAmountOpen: 0,
    ticketsOpen: 0, repairsOpen: 0,
    routes: 0, routesToday: 0,
    lagerDevices: 0, itemsTotal: 0, stockOnHand: 0,
    bugsOpen: 0, capasOpen: 0, warrantyActive: 0,
    audits24h: 0, securityIncidents24h: 0,
  });
  const [recentAudits, setRecentAudits] = useState<AuditRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setError(null);
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const since24 = new Date(Date.now() - 86400000).toISOString();

        const headOpts = { count: 'exact' as const, head: true };
        const [
          usersTotalR, usersActiveR, sessionsR,
          customersR, customersDeR, customersAtR,
          ordersR, ordersDeR, ordersAtR, ordersOpenR, ordersOverdueR,
          revenueDeR, revenueAtR,
          prodR, prodPendR, prodReclR,
          financeOpenR, financeListR,
          ticketsOpenR, repairsOpenR,
          routesR, routesTodayR,
          lagerR, itemsR, stockR,
          bugsR, capasR, warrantyR,
          audits24R, securityIncidentsR,
          recentAuditsR, activeSessionsR,
        ] = await Promise.all([
          supabase.from('user_profiles').select('id', headOpts),
          supabase.from('user_profiles').select('id', headOpts).eq('is_active', true),
          supabase.from('login_sessions').select('id', headOpts).eq('is_active', true).gt('expires_at', new Date().toISOString()),
          supabase.from('customers').select('id', headOpts),
          supabase.from('customers').select('id', headOpts).eq('source_system', 'zoho_eu_1'),
          supabase.from('customers').select('id', headOpts).eq('source_system', 'zoho_eu_2'),
          supabase.from('orders').select('id', headOpts),
          supabase.from('orders').select('id', headOpts).eq('source_system', 'zoho_eu_1'),
          supabase.from('orders').select('id', headOpts).eq('source_system', 'zoho_eu_2'),
          supabase.from('orders').select('id', headOpts).in('order_status', ['offen', 'Offen', 'open', 'Open', 'approved', 'Approved', 'invoiced', 'Invoiced']),
          supabase.from('orders').select('id', headOpts).not('expected_shipment_date', 'is', null).lt('expected_shipment_date', today).not('order_status', 'in', '("geliefert","storniert","cancelled")'),
          supabase.from('orders').select('total_amount').eq('source_system', 'zoho_eu_1'),
          supabase.from('orders').select('total_amount').eq('source_system', 'zoho_eu_2'),
          supabase.from('production_orders').select('id', headOpts),
          supabase.from('production_orders').select('id', headOpts).eq('approval_status', 'pending'),
          supabase.from('production_orders').select('id', headOpts).eq('is_reclamation', true),
          supabase.from('finance_records').select('id', headOpts).eq('payment_status', 'offen'),
          supabase.from('finance_records').select('amount_due, amount_paid').or('payment_status.eq.offen,payment_status.eq.teilweise bezahlt,payment_status.eq.überfällig'),
          supabase.from('tickets').select('id', headOpts).not('status', 'in', '("closed","geschlossen","erledigt")'),
          supabase.from('repair_orders').select('id', headOpts).not('repair_status', 'in', '("Abgeschlossen","abgeschlossen","Ausgeliefert","ausgeliefert","Storniert","storniert")'),
          supabase.from('route_plans').select('id', headOpts),
          supabase.from('route_plans').select('id', headOpts).gte('planned_date', today).lt('planned_date', tomorrow),
          supabase.from('lager_devices').select('id', headOpts),
          supabase.from('zoho_items').select('id', headOpts),
          supabase.from('zoho_items').select('stock_on_hand'),
          supabase.from('bugs').select('id', headOpts).not('status', 'in', '("closed","geschlossen")'),
          supabase.from('capas').select('id', headOpts).not('status', 'in', '("closed","geschlossen")'),
          supabase.from('warranty_records').select('id', headOpts).eq('warranty_status', 'Aktiv'),
          supabase.from('audit_logs').select('id', headOpts).gte('created_at', since24),
          supabase.from('audit_logs').select('id', headOpts).gte('created_at', since24).or('action.ilike.%fail%,action.ilike.%denied%,action.ilike.%unauthorized%,action.ilike.%block%,action.ilike.%suspicious%'),
          supabase.from('audit_logs').select('id, created_at, action, module, user_profiles!audit_logs_user_id_fkey(full_name, email)').order('created_at', { ascending: false }).limit(10),
          supabase.from('login_sessions').select('id, user_id, created_at, ip_address, user_profiles!login_sessions_user_id_fkey(full_name, email)').eq('is_active', true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(8),
        ]);

        if (!alive) return;

        const revenueDe = (revenueDeR.data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
        const revenueAt = (revenueAtR.data ?? []).reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
        const stockOnHand = (stockR.data ?? []).reduce((s: number, r: any) => s + Number(r.stock_on_hand ?? 0), 0);
        const financeAmountOpen = (financeListR.data ?? []).reduce(
          (s: number, r: any) => s + (Number(r.amount_due ?? 0) - Number(r.amount_paid ?? 0)), 0,
        );

        setC({
          usersTotal: usersTotalR.count ?? 0,
          usersActive: usersActiveR.count ?? 0,
          sessionsActive: sessionsR.count ?? 0,
          customersTotal: customersR.count ?? 0,
          customersDe: customersDeR.count ?? 0,
          customersAt: customersAtR.count ?? 0,
          ordersTotal: ordersR.count ?? 0,
          ordersDe: ordersDeR.count ?? 0,
          ordersAt: ordersAtR.count ?? 0,
          ordersOpen: ordersOpenR.count ?? 0,
          ordersOverdue: ordersOverdueR.count ?? 0,
          revenueDe, revenueAt,
          production: prodR.count ?? 0,
          productionPending: prodPendR.count ?? 0,
          productionReclamation: prodReclR.count ?? 0,
          financeOpen: financeOpenR.count ?? 0,
          financeAmountOpen,
          ticketsOpen: ticketsOpenR.count ?? 0,
          repairsOpen: repairsOpenR.count ?? 0,
          routes: routesR.count ?? 0,
          routesToday: routesTodayR.count ?? 0,
          lagerDevices: lagerR.count ?? 0,
          itemsTotal: itemsR.count ?? 0,
          stockOnHand,
          bugsOpen: bugsR.count ?? 0,
          capasOpen: capasR.count ?? 0,
          warrantyActive: warrantyR.count ?? 0,
          audits24h: audits24R.count ?? 0,
          securityIncidents24h: securityIncidentsR.count ?? 0,
        });
        setRecentAudits((recentAuditsR.data ?? []) as any);
        setSessions((activeSessionsR.data ?? []) as any);
      } catch (e: any) {
        if (alive) setError('Daten konnten nicht geladen werden.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const groups: { title: string; icon: any; items: { label: string; value: any; hint?: string; onClick?: () => void; tone?: 'default' | 'warn' | 'danger' | 'success' }[] }[] = [
    {
      title: 'Mandanten & Umsatz', icon: Globe, items: [
        { label: 'Umsatz Alix Deutschland 🇩🇪', value: fmtEur(c.revenueDe), tone: 'success' },
        { label: 'Umsatz Alix Austria 🇦🇹', value: fmtEur(c.revenueAt), tone: 'success' },
        { label: 'Aufträge -DE', value: c.ordersDe, onClick: () => navigate('/auftraege') },
        { label: 'Aufträge -AT', value: c.ordersAt, onClick: () => navigate('/auftraege-at') },
        { label: 'Kunden -DE', value: c.customersDe },
        { label: 'Kunden -AT', value: c.customersAt },
      ],
    },
    {
      title: 'Operative Auftragslage', icon: ClipboardList, items: [
        { label: 'Offene Aufträge', value: c.ordersOpen, onClick: () => navigate('/auftraege'), tone: 'warn' },
        { label: 'Überfällig', value: c.ordersOverdue, tone: c.ordersOverdue > 0 ? 'danger' : 'default' },
        { label: 'Touren gesamt', value: c.routes, onClick: () => navigate('/tourenplanung') },
        { label: 'Touren heute', value: c.routesToday, onClick: () => navigate('/tourenplanung'), tone: 'warn' },
        { label: 'Reparaturen offen', value: c.repairsOpen, onClick: () => navigate('/reparatur') },
        { label: 'Tickets offen', value: c.ticketsOpen, onClick: () => navigate('/tickets'), tone: c.ticketsOpen > 10 ? 'warn' : 'default' },
      ],
    },
    {
      title: 'Produktion & Lager', icon: Factory, items: [
        { label: 'Produktionsaufträge', value: c.production, onClick: () => navigate('/production') },
        { label: 'Wartet auf Freigabe', value: c.productionPending, tone: c.productionPending > 0 ? 'warn' : 'default' },
        { label: 'Reklamationen', value: c.productionReclamation, tone: c.productionReclamation > 0 ? 'danger' : 'default' },
        { label: 'Lager-Geräte', value: c.lagerDevices, onClick: () => navigate('/lager') },
        { label: 'Artikel (Stamm)', value: c.itemsTotal, onClick: () => navigate('/verkauf/artikel') },
        { label: 'Lagerbestand gesamt', value: c.stockOnHand },
      ],
    },
    {
      title: 'Finance', icon: Banknote, items: [
        { label: 'Offene Zahlungen', value: c.financeOpen, onClick: () => navigate('/finance'), tone: 'warn' },
        { label: 'Offene Summe', value: fmtEur(c.financeAmountOpen), tone: c.financeAmountOpen > 0 ? 'warn' : 'default' },
        { label: 'Aktive Garantien', value: c.warrantyActive, onClick: () => navigate('/garantiecenter') },
      ],
    },
    {
      title: 'Qualität & QM', icon: ShieldCheck, items: [
        { label: 'Offene Bugs', value: c.bugsOpen, onClick: () => navigate('/bug-capa'), tone: c.bugsOpen > 5 ? 'warn' : 'default' },
        { label: 'Offene CAPAs', value: c.capasOpen, onClick: () => navigate('/bug-capa') },
      ],
    },
    {
      title: 'Benutzer & Sicherheit', icon: ShieldAlert, items: [
        { label: 'Benutzer gesamt', value: c.usersTotal, onClick: () => navigate('/operation') },
        { label: 'Aktive Benutzer', value: c.usersActive, tone: 'success' },
        { label: 'Aktive Sessions', value: c.sessionsActive },
        { label: 'Audit-Events (24h)', value: c.audits24h },
        { label: 'Sicherheitsvorfälle (24h)', value: c.securityIncidents24h, tone: c.securityIncidents24h > 0 ? 'danger' : 'success' },
      ],
    },
  ];

  const toneClass = (t?: 'default' | 'warn' | 'danger' | 'success') => {
    switch (t) {
      case 'warn': return 'text-[hsl(var(--warning))]';
      case 'danger': return 'text-destructive';
      case 'success': return 'text-[hsl(var(--success))]';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {groups.map((g) => {
        const Icon = g.icon;
        return (
          <section key={g.title} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
              <Icon className="w-4 h-4 text-primary" />
              <h2 className="font-display font-semibold text-foreground">{g.title}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-border">
              {g.items.map((it) => (
                <button
                  key={it.label}
                  onClick={it.onClick}
                  disabled={!it.onClick}
                  className={`bg-card p-4 text-left transition-colors hover:bg-muted/30 ${it.onClick ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">{it.label}</p>
                  {loading ? (
                    <Skeleton className="h-6 w-16 mt-2" />
                  ) : (
                    <p className={`text-xl font-display font-bold mt-1 truncate ${toneClass(it.tone)}`}>{it.value}</p>
                  )}
                  {it.hint && <p className="text-[11px] text-muted-foreground mt-1">{it.hint}</p>}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Letzte System-Aktivität</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-4"><Skeleton className="h-24" /></div>
            ) : recentAudits.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Keine Aktivität.</p>
            ) : recentAudits.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{fmtDateTime(a.created_at)}</span>
                <span className="font-medium text-foreground truncate flex-1">{a.action}</span>
                <span className="text-xs text-muted-foreground truncate">{a.module}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {a.user_profiles?.full_name || a.user_profiles?.email || '—'}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-foreground">Aktive Sessions</h2>
          </div>
          <div className="divide-y divide-border">
            {loading ? (
              <div className="p-4"><Skeleton className="h-24" /></div>
            ) : sessions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">Keine aktiven Sessions.</p>
            ) : sessions.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center gap-3 text-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--success))] flex-shrink-0" />
                <span className="font-medium text-foreground truncate flex-1">
                  {s.user_profiles?.full_name || s.user_profiles?.email || '—'}
                </span>
                <span className="text-xs text-muted-foreground">{s.ip_address || '—'}</span>
                <span className="text-xs text-muted-foreground w-24 text-right">{fmtDateTime(s.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
