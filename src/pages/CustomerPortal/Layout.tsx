import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, Receipt, User2, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { logPortalAudit } from '@/lib/portal/audit';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

const IDLE_MS = 30 * 60 * 1000; // 30 Min Inaktivität → auto-Logout

export function useCustomerPortal() {
  const [ctx, setCtx] = useState<Ctx | null>(null);
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
        // Zugang existiert aber ist nicht aktiv → abmelden
        await supabase.auth.signOut();
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return { ctx, loading };
}

const tabs = [
  { to: '/kunde', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/kunde/rechnungen', label: 'Rechnungen', icon: Receipt },
  { to: '/kunde/meine-daten', label: 'Meine Daten', icon: User2 },
];

export default function CustomerPortalLayout() {
  const navigate = useNavigate();
  const { ctx, loading } = useCustomerPortal();

  useEffect(() => {
    if (!loading && !ctx) navigate('/kunde/login', { replace: true });
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

  // Idle-Auto-Logout
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

  return (
    <PortalShell ctx={ctx} logout={() => logout('user')}>
      <Outlet context={ctx} />
    </PortalShell>
  );
}

function PortalShell({ ctx, logout, children }: { ctx: Ctx; logout: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Kundenportal</p>
            <h1 className="text-lg font-semibold text-foreground truncate max-w-[60vw]">
              {ctx.companyName ?? ctx.email ?? 'Mein Konto'}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" /> Abmelden
          </Button>
        </div>
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-2 rounded-t-md text-sm whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary border-b-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto p-4 lg:p-6 animate-fade-in">{children}</main>
    </div>
  );
}
