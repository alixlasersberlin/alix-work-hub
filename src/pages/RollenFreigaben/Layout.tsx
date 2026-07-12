import { NavLink, Outlet } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, Grid3x3, Users2, ShieldCheck, ClipboardCheck,
  UserCog, FileClock, GitCompare, Eye, Shield,
} from 'lucide-react';

const NAV = [
  { to: '/admin/rollen-freigaben', end: true, label: 'Übersicht', icon: LayoutDashboard },
  { to: '/admin/rollen-freigaben/matrix', label: 'Rollenmatrix', icon: Grid3x3 },
  { to: '/admin/rollen-freigaben/rollen', label: 'Rollen', icon: ShieldCheck },
  { to: '/admin/rollen-freigaben/mitarbeiter', label: 'Mitarbeiter', icon: Users2 },
  { to: '/admin/rollen-freigaben/effektiv', label: 'Effektiver Zugriff', icon: Eye },
  { to: '/admin/rollen-freigaben/vergleich', label: 'Rollen-Vergleich', icon: GitCompare },
  { to: '/admin/rollen-freigaben/antraege', label: 'Freigabeanträge', icon: UserCog },
  { to: '/admin/rollen-freigaben/pruefung', label: 'Sicherheitsprüfung', icon: ClipboardCheck },
  { to: '/admin/rollen-freigaben/protokoll', label: 'Änderungsprotokoll', icon: FileClock },
];

export default function RollenFreigabenLayout() {
  return (
    <div className="min-h-screen p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold">Rollen & Freigaben</h1>
          <p className="text-sm text-muted-foreground">
            Visuelle Rollenverwaltung, Vier-Augen-Freigaben, effektive Rechte — nur Super Admin
          </p>
        </div>
        <Badge variant="outline" className="ml-auto bg-amber-500/10 border-amber-500/40 text-amber-500">
          Read-only-Erweiterung · bestehende RBAC unverändert
        </Badge>
      </div>

      <div className="grid grid-cols-[240px_1fr] gap-6">
        <nav className="space-y-1 sticky top-4 self-start">
          {NAV.map(n => (
            <NavLink
              key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium border border-primary/30'
                    : 'hover:bg-muted/40 text-muted-foreground'
                }`
              }
            >
              <n.icon className="w-4 h-4" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </div>
  );
}
