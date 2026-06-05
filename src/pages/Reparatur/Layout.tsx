import { NavLink, Outlet } from 'react-router-dom';
import { Wrench, LayoutDashboard, FilePlus, ClipboardList, PackageCheck, HardHat, Package, Receipt, MapPin, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/reparatur', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/reparatur/neu', label: 'Neue Reparatur', icon: FilePlus },
  { to: '/reparatur/auftraege', label: 'Reparaturaufträge', icon: ClipboardList },
  { to: '/reparatur/werkstattannahme', label: 'Werkstattannahme', icon: PackageCheck },
  { to: '/reparatur/technik', label: 'Technik-Arbeitsaufträge', icon: HardHat },
  { to: '/reparatur/ersatzteile', label: 'Ersatzteilbedarf', icon: Package },
  { to: '/reparatur/finance', label: 'Übergabe Finance', icon: Receipt },
  { to: '/reparatur/tourenplanung', label: 'Übergabe Tourenplanung', icon: MapPin },
  { to: '/reparatur/archiv', label: 'Reparaturarchiv', icon: Archive },
];

export default function ReparaturLayout() {
  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Wrench className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Reparaturannahme</h1>
      </div>
      <div className="flex gap-2 overflow-x-auto mb-6 border-b border-border pb-1">
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
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )
              }
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </NavLink>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
