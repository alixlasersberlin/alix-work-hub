import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, NavLink, Outlet } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  LayoutDashboard, Mail, FileText, Receipt, FileCheck2, Wrench,
  LifeBuoy, Star, History, LogOut, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Ctx = { customerId: string; companyName: string | null; email: string | null };

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
        .select('customer_id, customers:customer_id(company_name, email)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (!mounted) return;
      if (link) {
        const c: any = (link as any).customers;
        setCtx({ customerId: link.customer_id, companyName: c?.company_name ?? null, email: c?.email ?? user.email ?? null });
        await supabase.from('customer_portal_users').update({ last_login_at: new Date().toISOString() }).eq('user_id', user.id);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  return { ctx, loading };
}

const tabs = [
  { to: '/kunde', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/kunde/nachrichten', label: 'Nachrichten', icon: Mail },
  { to: '/kunde/dokumente', label: 'Dokumente', icon: FileText },
  { to: '/kunde/rechnungen', label: 'Rechnungen', icon: Receipt },
  { to: '/kunde/angebote', label: 'Angebote', icon: FileCheck2 },
  { to: '/kunde/reparaturen', label: 'Reparaturen', icon: Wrench },
  { to: '/kunde/support', label: 'Support', icon: LifeBuoy },
  { to: '/kunde/bewertungen', label: 'Bewertungen', icon: Star },
  { to: '/kunde/verlauf', label: 'Verlauf', icon: History },
];

export default function CustomerPortalLayout() {
  const navigate = useNavigate();
  const { ctx, loading } = useCustomerPortal();

  useEffect(() => {
    if (!loading && !ctx) navigate('/kunde/login', { replace: true });
  }, [loading, ctx, navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success('Abgemeldet');
    navigate('/kunde/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!ctx) return null;

  return (
    <PortalShell ctx={ctx} logout={logout}>
      <Outlet context={ctx} />
    </PortalShell>
  );
}

function PortalShell({ ctx, logout, children }: { ctx: Ctx; logout: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
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
        <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
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
      <main className="max-w-7xl mx-auto p-4 lg:p-6 animate-fade-in">{children}</main>
    </div>
  );
}
