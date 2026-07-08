import { NavLink, Outlet } from 'react-router-dom';
import { Sparkles, LayoutDashboard, CalendarClock, Boxes, Map, Gauge, LineChart, Lightbulb, ScrollText, Settings, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/esc/ai',                label: 'AI Dashboard',        icon: LayoutDashboard, end: true },
  { to: '/esc/ai/terminassistent',label: 'Terminassistent',     icon: CalendarClock },
  { to: '/esc/ai/ressourcen',     label: 'Ressourcen',          icon: Boxes },
  { to: '/esc/ai/touren',         label: 'Touren',              icon: Map },
  { to: '/esc/ai/kapazitaeten',   label: 'Kapazitäten',         icon: Gauge },
  { to: '/esc/ai/prognosen',      label: 'Prognosen',           icon: LineChart },
  { to: '/esc/ai/empfehlungen',   label: 'Empfehlungen',        icon: Lightbulb },
  { to: '/esc/ai/suche',          label: 'Intelligente Suche',  icon: Search },
  { to: '/esc/ai/protokoll',      label: 'KI-Protokoll',        icon: ScrollText },
  { to: '/esc/ai/einstellungen',  label: 'Einstellungen',       icon: Settings },
];

export default function AiLayout() {
  return (
    <div className="min-h-full">
      <div className="border-b bg-card/30 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <div className="text-[15px] font-semibold">Alix AI · Enterprise Intelligence</div>
          <div className="ml-auto text-[11px] text-muted-foreground">nachvollziehbar · datenbasiert · nicht-automatisch</div>
        </div>
        <nav className="flex items-center gap-1 px-4 pt-2 pb-2 overflow-x-auto">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px] rounded-md whitespace-nowrap transition-colors border border-transparent',
                  isActive
                    ? 'bg-primary/15 text-primary border-primary/20'
                    : 'text-foreground/75 hover:text-primary hover:bg-primary/10',
                )
              }
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="p-4">
        <Outlet />
      </div>
    </div>
  );
}
