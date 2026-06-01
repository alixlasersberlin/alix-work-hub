import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Star, Truck, MessageSquare, Monitor, LayoutDashboard, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/bewertungen', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/bewertungen/geliefert', label: 'Aufträge geliefert', icon: Truck },
  { to: '/bewertungen/abgegeben', label: 'Abgegebene Bewertungen', icon: MessageSquare },
  { to: '/bewertungen/geschlossen', label: 'Geschlossen', icon: Lock },
  { to: '/bewertungen/frontend', label: 'Frontend', icon: Monitor },
];

export default function ReviewsLayout() {
  const loc = useLocation();
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Star className="h-7 w-7 text-amber-400" />
        <div>
          <h1 className="text-3xl font-bold">Bewertungen</h1>
          <p className="text-muted-foreground text-sm">Kundenbewertungen, Einladungen und Auswertung.</p>
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
