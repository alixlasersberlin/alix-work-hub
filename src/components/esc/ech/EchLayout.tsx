import { NavLink, Outlet } from 'react-router-dom';
import {
  Radio, LayoutDashboard, Send, CalendarDays, BellRing, Video,
  MessageSquare, PlugZap, FileText, History, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/esc/ech',                label: 'Übersicht',        icon: LayoutDashboard, end: true },
  { to: '/esc/ech/kommunikation',  label: 'Kommunikation',    icon: Send },
  { to: '/esc/ech/kalender',       label: 'Kalender',         icon: CalendarDays },
  { to: '/esc/ech/erinnerungen',   label: 'Erinnerungen',     icon: BellRing },
  { to: '/esc/ech/meetings',       label: 'Videokonferenzen', icon: Video },
  { to: '/esc/ech/benachrichtigungen', label: 'Benachrichtigungen', icon: MessageSquare },
  { to: '/esc/ech/integrationen',  label: 'Integrationen',    icon: PlugZap },
  { to: '/esc/ech/vorlagen',       label: 'Vorlagen',         icon: FileText },
  { to: '/esc/ech/historie',       label: 'Versandhistorie',  icon: History },
  { to: '/esc/ech/einstellungen',  label: 'Einstellungen',    icon: Settings },
];

export default function EchLayout() {
  return (
    <div className="min-h-full">
      <div className="border-b bg-card/30 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Radio className="w-5 h-5 text-primary" />
          <div className="text-[15px] font-semibold">Enterprise Communication Hub</div>
          <div className="ml-auto text-[11px] text-muted-foreground">E-Mail · SMS · WhatsApp · Push · Meetings · Kalender</div>
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
