import { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bug, ClipboardCheck, AlertOctagon, FileSearch, ListChecks, BarChart3, LayoutDashboard, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export const QM_ROLES = ['Admin', 'Super Admin', 'QM'];

export const BUG_STATUS = ['neu', 'analyse', 'in_bearbeitung', 'test', 'erledigt', 'geschlossen'] as const;
export const BUG_PRIORITY = ['niedrig', 'normal', 'hoch', 'dringend'] as const;
export const BUG_CRITICALITY = ['niedrig', 'mittel', 'hoch', 'kritisch'] as const;

export const CAPA_STATUS = [
  'offen', 'bewertung', 'ursachenanalyse', 'massnahmenplanung',
  'umsetzung', 'wirksamkeitspruefung', 'freigabe', 'geschlossen',
] as const;

export const ACTION_STATUS = ['offen', 'in_bearbeitung', 'erledigt', 'verworfen'] as const;

export const FINDING_TYPES = ['beobachtung', 'abweichung_minor', 'abweichung_major', 'kritisch'] as const;

const tabs = [
  { to: '/bug-capa', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bug-capa/bugs', label: 'Bugs', icon: Bug },
  { to: '/bug-capa/capa', label: 'CAPA', icon: ClipboardCheck },
  { to: '/bug-capa/reklamationen', label: 'Reklamationen', icon: AlertOctagon },
  { to: '/bug-capa/audit', label: 'Audit-Feststellungen', icon: FileSearch },
  { to: '/bug-capa/massnahmen', label: 'Maßnahmen', icon: ListChecks },
  { to: '/bug-capa/berichte', label: 'Berichte', icon: BarChart3 },
];

export function BugCapaLayout() {
  const loc = useLocation();
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Bugs &amp; CAPA ISO 13485</h1>
          <p className="text-muted-foreground text-sm">Qualitätsmanagement – Bugs, Reklamationen, Audits und CAPA nach ISO 13485.</p>
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

export function statusLabel(s: string | null | undefined) {
  if (!s) return '—';
  return s.replace(/_/g, ' ');
}
