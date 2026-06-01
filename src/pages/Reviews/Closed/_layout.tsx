import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MessageSquareOff, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const subTabs = [
  { to: '/bewertungen/geschlossen', label: 'Ohne Bewertung', icon: MessageSquareOff, end: true },
  { to: '/bewertungen/geschlossen/mit-bewertung', label: 'Mit Bewertung', icon: MessageSquare },
];

export default function ClosedLayout() {
  const loc = useLocation();
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2">
        {subTabs.map(t => {
          const active = t.end ? loc.pathname === t.to : loc.pathname.startsWith(t.to);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                active
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}
