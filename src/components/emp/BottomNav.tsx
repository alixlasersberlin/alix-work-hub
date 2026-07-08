import { NavLink } from 'react-router-dom';
import { Home, Calendar, Users, CheckSquare, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/emp', label: 'Home', icon: Home, end: true },
  { to: '/emp/kalender', label: 'Kalender', icon: Calendar },
  { to: '/emp/kunden', label: 'Kunden', icon: Users },
  { to: '/emp/aufgaben', label: 'Aufgaben', icon: CheckSquare },
  { to: '/emp/mehr', label: 'Mehr', icon: MoreHorizontal },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 max-w-2xl mx-auto">
        {items.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <it.icon className="h-5 w-5" aria-hidden />
              <span>{it.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
