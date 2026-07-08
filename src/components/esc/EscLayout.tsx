import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, Building2, Users, Boxes, Globe, CheckCircle2, Settings, Calendar, Truck, Cpu, DoorOpen, Map, Gauge, ListChecks, Sparkles, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/esc',                label: 'Übersicht',      icon: LayoutDashboard, end: true },
  { to: '/esc/kalender',       label: 'Kalender',       icon: CalendarDays },
  { to: '/esc/ressourcen',     label: 'Ressourcen',     icon: Boxes },
  { to: '/esc/mitarbeiter',    label: 'Mitarbeiter',    icon: Users },
  { to: '/esc/abteilungen',    label: 'Abteilungen',    icon: Building2 },
  { to: '/esc/buchungen',      label: 'Buchungsportal', icon: Globe },
  { to: '/esc/bestaetigungen', label: 'Bestätigungen',  icon: CheckCircle2 },
  { to: '/esc/ai',             label: 'Alix AI',        icon: Sparkles },
  { to: '/esc/ech',            label: 'Comm Hub',       icon: Radio },
  { to: '/esc/einstellungen',  label: 'Einstellungen',  icon: Settings },
];

const RM_TABS = [
  { to: '/esc/rm',                label: 'Disposition',     icon: LayoutDashboard, end: true },
  { to: '/esc/rm/mitarbeiter',    label: 'Mitarbeiter',     icon: Users },
  { to: '/esc/rm/fahrzeuge',      label: 'Fahrzeuge',       icon: Truck },
  { to: '/esc/rm/geraete',        label: 'Geräte',          icon: Cpu },
  { to: '/esc/rm/raeume',         label: 'Räume',           icon: DoorOpen },
  { to: '/esc/rm/aussendienst',   label: 'Außendienst',     icon: Map },
  { to: '/esc/rm/kapazitaeten',   label: 'Kapazitäten',     icon: Gauge },
  { to: '/esc/rm/einsatzplanung', label: 'Einsatzplanung',  icon: ListChecks },
];

export default function EscLayout() {
  return (
    <div className="min-h-full">
      <div className="border-b bg-card/30 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Calendar className="w-5 h-5 text-primary" />
          <div className="text-[15px] font-semibold">Teamkalender · Enterprise Scheduling Center</div>
          <div className="ml-auto text-[11px] text-muted-foreground">AlixWorks · ESC</div>
        </div>
        <nav className="flex items-center gap-1 px-4 pt-2 pb-1 overflow-x-auto">
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
        <nav className="flex items-center gap-1 px-4 pb-2 overflow-x-auto border-t border-border/40 pt-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground pr-2">Ressourcen &amp; Disposition</span>
          {RM_TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2 py-1 text-[11.5px] rounded-md whitespace-nowrap transition-colors border border-transparent',
                  isActive
                    ? 'bg-primary/15 text-primary border-primary/20'
                    : 'text-foreground/70 hover:text-primary hover:bg-primary/10',
                )
              }
            >
              <t.icon className="w-3.5 h-3.5" />
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
