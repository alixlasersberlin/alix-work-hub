import { NavLink, Outlet } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, KeyRound, AlertTriangle, Users, ClipboardList, HardDrive, PlayCircle, ListChecks, ShieldCheck, Radar, ClipboardCheck, PlayCircle as ResumeIcon } from 'lucide-react';

const NAV = [
  { to: '/security-center', end: true, label: 'Übersicht', icon: Shield },
  { to: '/security-center/fortsetzen', label: 'Bereinigung fortsetzen', icon: ResumeIcon },
  { to: '/security-center/inventory', label: 'Sicherheitsprüfung', icon: Database },
  { to: '/security-center/roles', label: 'Rollen', icon: Users },
  { to: '/security-center/permissions', label: 'Berechtigungen', icon: KeyRound },
  { to: '/security-center/policies', label: 'RLS-Status', icon: ListChecks },
  { to: '/security-center/storage', label: 'Storage', icon: HardDrive },
  { to: '/security-center/mfa', label: 'MFA & Sessions', icon: ShieldCheck },
  { to: '/security-center/findings', label: 'Sicherheitsereignisse', icon: AlertTriangle },
  { to: '/security-center/pentest', label: 'Pen-Test', icon: Radar },
  { to: '/security-center/compliance', label: 'Compliance', icon: ClipboardCheck },
  { to: '/security-center/simulate', label: 'Zugriffs-Simulation', icon: PlayCircle },
  { to: '/security-center/plan', label: 'Migrationsplan', icon: ClipboardList },
];

export default function SecurityCenterLayout() {
  return (
    <div className="min-h-screen p-3 sm:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold">Systemsicherheit</h1>
          <p className="text-sm text-muted-foreground">ALIXWORK · Administration</p>
        </div>
        <Badge variant="outline" className="ml-auto bg-primary/10 border-primary/40 text-primary">v1.0 · Kontrollierte Freigaben</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <nav className="flex flex-wrap lg:block gap-1 lg:space-y-1">
          {NAV.map(n => (
            <NavLink
              key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/40 text-muted-foreground'}`}
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

export { default as SecurityCenterOverview } from "./ControlDashboard";
