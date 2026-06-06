import { NavLink, Outlet } from 'react-router-dom';
import {
  Mail, LayoutDashboard, PenSquare, FileText, Megaphone, Workflow,
  Activity, Globe, BarChart3, Settings, MailX,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/mailcenter', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/mailcenter/schreiben', label: 'E-Mail schreiben', icon: PenSquare },
  { to: '/mailcenter/vorlagen', label: 'Vorlagen', icon: FileText },
  { to: '/mailcenter/kampagnen', label: 'Kampagnen', icon: Megaphone },
  { to: '/mailcenter/automationen', label: 'Automationen', icon: Workflow },
  { to: '/mailcenter/tracking', label: 'Tracking', icon: Activity },
  { to: '/mailcenter/abmeldungen', label: 'Abmeldungen', icon: MailX },
  { to: '/mailcenter/domains', label: 'Domains', icon: Globe },
  { to: '/mailcenter/berichte', label: 'Berichte', icon: BarChart3 },
  { to: '/mailcenter/einstellungen', label: 'Einstellungen', icon: Settings },
];

export default function MailCenterLayout() {
  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <Mail className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">Alix MailCenter</h1>
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
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
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
