import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ListChecks, FolderKanban, ClipboardCheck, Truck,
  ShieldCheck, Users, LogOut, ArrowLeftRight, FileSearch,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useComplianceProfile } from '@/hooks/useComplianceProfile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NavItem { to: string; label: string; icon: any; show: boolean }

/** Abgeschottete Shell für den Software-&-Compliance-Workspace. */
export default function ComplianceShell() {
  const { user, loading: authLoading, signOut } = useAuth();
  const c = useComplianceProfile();
  const navigate = useNavigate();
  const location = useLocation();

  if (authLoading || c.loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Lädt…</div>;
  }
  if (!user) return <Navigate to="/compliance-login" replace state={{ from: location.pathname }} />;
  if (!c.hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldCheck className="w-10 h-10 text-destructive" />
        <h1 className="text-xl font-semibold">Kein Compliance-Zugang</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Ihr Konto ist nicht für den Bereich Software &amp; Compliance freigeschaltet.
          Bitte wenden Sie sich an den Compliance-Administrator.
        </p>
        <Button variant="outline" onClick={() => signOut()}>Abmelden</Button>
      </div>
    );
  }

  const supplierOnly = c.isSupplier;
  const items: NavItem[] = [
    { to: '/software-compliance', label: 'Dashboard', icon: LayoutDashboard, show: !supplierOnly },
    { to: '/software-compliance/aufgaben', label: 'Meine Aufgaben', icon: ListChecks, show: !supplierOnly },
    { to: '/software-compliance/projekte', label: 'Projekte', icon: FolderKanban, show: !supplierOnly },
    { to: '/software-compliance/reviews', label: 'Reviews', icon: ClipboardCheck, show: !supplierOnly && c.canReview },
    { to: '/software-compliance/lieferanten', label: supplierOnly ? 'Meine Anfragen' : 'Supplier Requests', icon: Truck, show: true },
    { to: '/software-compliance/audit', label: 'Audit Trail', icon: FileSearch, show: c.isComplianceAdmin },
    { to: '/software-compliance/benutzer', label: 'Benutzer', icon: Users, show: c.isComplianceAdmin },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="px-4 py-4 border-b border-border">
          <div className="text-[10px] tracking-[0.3em] text-muted-foreground">ALIXWORK</div>
          <div className="text-sm font-semibold leading-tight mt-1">SOFTWARE &amp; COMPLIANCE</div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {items.filter((i) => i.show).map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/software-compliance'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-[13px] transition-colors',
                  isActive ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )
              }
            >
              <i.icon className="w-4 h-4" />
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 text-[10px] text-muted-foreground/70 border-t border-border">
          Alix Medical · Controlled Compliance Workspace
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="md:hidden text-[12px] font-semibold">SOFTWARE &amp; COMPLIANCE</div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-[12px] font-medium">{c.profile?.full_name || c.profile?.email}</div>
              <div className="text-[10px] text-muted-foreground">{c.role || '—'}</div>
            </div>
            <Badge variant="outline" className="hidden lg:inline-flex">Compliance</Badge>
            {c.isSuperAdmin && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} title="Zu AlixWork wechseln">
                <ArrowLeftRight className="w-4 h-4 mr-1" /> AlixWork
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-1" /> Abmelden
            </Button>
          </div>
        </header>

        <nav className="md:hidden flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
          {items.filter((i) => i.show).map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/software-compliance'}
              className={({ isActive }) =>
                cn('whitespace-nowrap rounded-md px-2.5 py-1 text-[12px]', isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground')
              }
            >
              {i.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
