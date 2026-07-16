import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ShieldCheck, Users, Building2, AppWindow, KeyRound, Activity, Siren, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/id-admin/identities', label: 'Identitäten', icon: Users },
  { to: '/id-admin/organizations', label: 'Organisationen', icon: Building2 },
  { to: '/id-admin/applications', label: 'Applikationen', icon: AppWindow },
  { to: '/id-admin/access', label: 'App-Zugriffe', icon: KeyRound },
  { to: '/id-admin/sessions', label: 'Sitzungen', icon: Activity },
  { to: '/id-admin/security-events', label: 'Security-Log', icon: ShieldCheck },
  { to: '/id-admin/emergency-lock', label: 'Notfall', icon: Siren },
];

export default function IdAdminLayout() {
  const { user, loading, hasAnyRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!hasAnyRole(['Super Admin', 'Admin'])) return <Navigate to="/access-denied" replace />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold leading-none">Alix ID · Administration</div>
              <div className="text-xs text-muted-foreground">Identitäten, Organisationen, App-Zugriffe</div>
            </div>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto flex gap-1 px-4 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink key={t.to} to={t.to} className={({ isActive }) => cn(
                'flex items-center gap-2 px-3 py-2 text-sm border-b-2 whitespace-nowrap',
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}>
                <Icon className="w-4 h-4" /> {t.label}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
