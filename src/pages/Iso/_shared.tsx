import { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ShieldCheck, ClipboardList, GraduationCap, Factory,
  GitBranch, AlertTriangle, LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const ISO_ROLES = ['Admin', 'Super Admin', 'QM'];

const tabs = [
  { to: '/iso', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/iso/audits', label: 'Audits', icon: ClipboardList },
  { to: '/iso/trainings', label: 'Schulungen', icon: GraduationCap },
  { to: '/iso/suppliers', label: 'Lieferantenbewertung', icon: Factory },
  { to: '/iso/changes', label: 'Change Control', icon: GitBranch },
  { to: '/iso/vigilance', label: 'MDR Vigilanz', icon: AlertTriangle },
];

export function IsoLayout() {
  const loc = useLocation();
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">ISO 13485 / MDR Audit Center</h1>
          <p className="text-muted-foreground text-sm">
            Audits, Schulungen, Lieferantenbewertung, Änderungsmanagement und MDR-Vigilanz.
          </p>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map(t => {
          const active = t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors',
                active
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
