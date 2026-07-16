import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Receipt, User2, LogOut, Loader2, Cpu, FileSignature, LifeBuoy,
  FileText, ShieldCheck, Wrench, MessagesSquare, Files, Bell, Shield, Menu, X,
} from 'lucide-react';
import { PORTAL_PHASE } from '@/lib/portal/phase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = {
  customerId: string;
  companyName: string | null;
  email: string | null;
  badges: Record<string, number>;
  refreshBadges: () => void;
};

const IDLE_MS = 30 * 60 * 1000;

export function useCustomerPortal() {
  const [ctx, setCtx] = useState<Omit<Ctx, 'badges' | 'refreshBadges'> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) { setLoading(false); return; }
      const { data: link } = await supabase
        .from('customer_portal_users')
        .select('customer_id, status, customers:customer_id(company_name, email, contact_name)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!mounted) return;
      if (link && link.status === 'active') {
        const c: any = (link as any).customers;
        setCtx({
          customerId: link.customer_id,
          companyName: c?.company_name ?? c?.contact_name ?? null,
          email: c?.email ?? user.email ?? null,
        });
      } else if (link) {
        await supabase.auth.signOut();
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return { ctx, loading };
}

const baseTabs = [
  { to: '/kunde', label: 'Übersicht', icon: LayoutDashboard, end: true, phase: 1, key: 'dashboard' },
  { to: '/kunde/rechnungen', label: 'Rechnungen', icon: Receipt, phase: 1, key: 'invoices' },
  { to: '/kunde/angebote', label: 'Angebote', icon: FileText, phase: 3, key: 'offers' },
  { to: '/kunde/vertraege', label: 'Verträge', icon: FileSignature, phase: 2, key: 'contracts' },
  { to: '/kunde/geraete', label: 'Geräte', icon: Cpu, phase: 2, key: 'devices' },
  { to: '/kunde/garantie', label: 'Garantie', icon: ShieldCheck, phase: 3, key: 'warranty' },
  { to: '/kunde/wartungen', label: 'Wartungen', icon: Wrench, phase: 3, key: 'maintenance' },
  { to: '/kunde/tickets', label: 'Tickets', icon: LifeBuoy, phase: 2, key: 'tickets' },
  { to: '/kunde/nachrichten', label: 'Nachrichten', icon: MessagesSquare, phase: 3, key: 'messages' },
  { to: '/kunde/dokumente', label: 'Dokumente', icon: Files, phase: 3, key: 'documents' },
  { to: '/kunde/benachrichtigungen', label: 'Benachr.', icon: Bell, phase: 3, key: 'notifications' },
  { to: '/kunde/meine-daten', label: 'Meine Daten', icon: User2, phase: 1, key: 'profile' },
  { to: '/kunde/sicherheit', label: 'Sicherheit', icon: Shield, phase: 3, key: 'security' },
];
const tabs = baseTabs.filter((t) => t.phase <= PORTAL_PHASE);

export default function CustomerPortalLayout() {
  const navigate = useNavigate();
  const { ctx, loading } = useCustomerPortal();
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadBadges = async (customerId: string) => {
    const [notif, msgs, tickets, offers] = await Promise.all([
      supabase.from('customer_portal_notifications').select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId).is('read_at', null),
      supabase.from('customer_portal_messages').select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId).eq('from_role', 'staff').is('read_at', null),
      supabase.from('customer_portal_tickets').select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId).in('status', ['open', 'in_progress']),
      supabase.from('offers').select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId).eq('customer_visible', true).eq('status', 'versendet'),
    ]);
    setBadges({
      notifications: notif.count ?? 0,
      messages: msgs.count ?? 0,
      tickets: tickets.count ?? 0,
      offers: offers.count ?? 0,
    });
  };

  useEffect(() => {
    if (!loading && !ctx) navigate('/kunde/login', { replace: true });
    if (ctx?.customerId) void loadBadges(ctx.customerId);
  }, [loading, ctx, navigate]);

  const logout = async (reason: 'user' | 'idle' = 'user') => {
    const user = (await supabase.auth.getUser()).data.user;
    void logPortalAudit({
      action: reason === 'idle' ? 'session_expired' : 'logout',
      authUserId: user?.id ?? null,
      customerId: ctx?.customerId ?? null,
    });
    await supabase.auth.signOut();
    toast.success(reason === 'idle' ? 'Sitzung abgelaufen' : 'Abgemeldet');
    navigate('/kunde/login');
  };

  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ctx) return;
    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void logout('idle'), IDLE_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.customerId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!ctx) return null;

  const totalBadge = (badges.notifications ?? 0) + (badges.messages ?? 0);
  const outletCtx: Ctx = { ...ctx, badges, refreshBadges: () => void loadBadges(ctx.customerId) };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" className="lg:hidden -ml-2" onClick={() => setMobileOpen(true)} aria-label="Menü öffnen">
              <Menu className="w-5 h-5" />
              {totalBadge > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />}
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Kundenportal</p>
              <h1 className="text-lg font-semibold text-foreground truncate max-w-[60vw]">
                {ctx.companyName ?? ctx.email ?? 'Mein Konto'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/kunde/benachrichtigungen" className="relative p-2 rounded-md hover:bg-muted/50" aria-label="Benachrichtigungen">
              <Bell className="w-5 h-5" />
              {badges.notifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                  {badges.notifications}
                </span>
              )}
            </NavLink>
            <Button variant="outline" size="sm" onClick={() => logout('user')}>
              <LogOut className="w-4 h-4 mr-2" /> Abmelden
            </Button>
          </div>
        </div>
        <nav className="hidden lg:flex max-w-6xl mx-auto px-4 gap-1 overflow-x-auto">
          {tabs.map((t) => <TabLink key={t.to} tab={t} badge={badges[t.key]} />)}
        </nav>
      </header>

      {/* Mobile Slide-in */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-xl animate-slide-in-right">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Menü</p>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Menü schließen"><X className="w-5 h-5" /></Button>
            </div>
            <nav className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-60px)]">
              {tabs.map((t) => <TabLink key={t.to} tab={t} badge={badges[t.key]} mobile onNavigate={() => setMobileOpen(false)} />)}
            </nav>
          </aside>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 lg:p-6 animate-fade-in">
        <Outlet context={outletCtx} />
      </main>
    </div>
  );
}

function TabLink({ tab, badge, mobile, onNavigate }: {
  tab: { to: string; label: string; icon: any; end?: boolean };
  badge?: number;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = tab.icon;
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition-colors',
          mobile ? 'rounded-md w-full' : 'rounded-t-md',
          isActive
            ? mobile
              ? 'bg-primary/15 text-primary'
              : 'bg-primary/15 text-primary border-b-2 border-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
        )
      }
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{tab.label}</span>
      {badge ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{badge}</Badge> : null}
    </NavLink>
  );
}
