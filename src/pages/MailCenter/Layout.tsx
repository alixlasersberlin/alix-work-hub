import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Mail, LayoutDashboard, PenSquare, FileText, Megaphone, Workflow,
  Activity, Globe, BarChart3, Settings, MailX, Inbox, Send, FileEdit, MessageSquare, Sparkles, FileCheck2, Files,
  Phone, ClipboardList, CheckSquare, CalendarClock, ShieldCheck,
  HeartPulse, ScrollText, AlertTriangle, TestTube2, Rocket, TrendingUp, PhoneCall,
  Database, Upload, FileDown, Shield, BadgeCheck, GraduationCap, FileSignature,
  ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';

type Item = { to: string; label: string; icon: any; end?: boolean };
type Group = { label: string; items: Item[] };

const groups: Group[] = [
  {
    label: 'Übersicht',
    items: [
      { to: '/mailcenter', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/mailcenter/executive', label: 'Executive Dashboard', icon: TrendingUp },
      { to: '/mailcenter/berichte', label: 'Berichte', icon: BarChart3 },
    ],
  },
  {
    label: 'Posteingang',
    items: [
      { to: '/mailcenter/posteingang', label: 'Posteingang', icon: Inbox },
      { to: '/mailcenter/gesendet', label: 'Gesendet', icon: Send },
      { to: '/mailcenter/entwuerfe', label: 'Entwürfe', icon: FileEdit },
      { to: '/mailcenter/intern', label: 'Interne Nachrichten', icon: MessageSquare },
      { to: '/mailcenter/schreiben', label: 'E-Mail schreiben', icon: PenSquare },
    ],
  },
  {
    label: 'Telefonie',
    items: [
      { to: '/mailcenter/telefonie', label: 'Telefonie (3CX)', icon: PhoneCall },
      { to: '/mailcenter/telefonnotizen', label: 'Telefonnotizen', icon: Phone },
      { to: '/mailcenter/gespraechsprotokolle', label: 'Gesprächsprotokolle', icon: ClipboardList },
    ],
  },
  {
    label: 'Aufgaben',
    items: [
      { to: '/mailcenter/aufgaben', label: 'Aufgaben', icon: CheckSquare },
      { to: '/mailcenter/wiedervorlagen', label: 'Wiedervorlagen', icon: CalendarClock },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/mailcenter/kampagnen', label: 'Kampagnen', icon: Megaphone },
      { to: '/mailcenter/vorlagen', label: 'Vorlagen', icon: FileText },
      { to: '/mailcenter/automationen', label: 'Automationen', icon: Workflow },
      { to: '/mailcenter/ki-assistent', label: 'KI-Assistent', icon: Sparkles },
      { to: '/mailcenter/tracking', label: 'Tracking', icon: Activity },
      { to: '/mailcenter/abmeldungen', label: 'Abmeldungen', icon: MailX },
    ],
  },
  {
    label: 'Dokumente',
    items: [
      { to: '/mailcenter/dokumente', label: 'Dokumenten-Center', icon: Files },
      { to: '/mailcenter/versandnachweise', label: 'Versandnachweise', icon: FileCheck2 },
      { to: '/mailcenter/dokumente-vorlagen', label: 'Dok.-Vorlagen', icon: FileText },
      { to: '/mailcenter/dokumente-automationen', label: 'Dok.-Automationen', icon: Workflow },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/mailcenter/domains', label: 'Domains', icon: Globe },
      { to: '/mailcenter/berechtigungen', label: 'Berechtigungen', icon: ShieldCheck },
      { to: '/mailcenter/einstellungen', label: 'Einstellungen', icon: Settings },
    ],
  },
  {
    label: 'Betrieb & Monitoring',
    items: [
      { to: '/mailcenter/systemstatus', label: 'Systemstatus', icon: HeartPulse },
      { to: '/mailcenter/audit-log', label: 'Audit-Log', icon: ScrollText },
      { to: '/mailcenter/fehlerprotokoll', label: 'Fehlerprotokoll', icon: AlertTriangle },
      { to: '/mailcenter/backup', label: 'Backup Center', icon: Database },
      { to: '/mailcenter/import', label: 'Import', icon: Upload },
      { to: '/mailcenter/export', label: 'Export', icon: FileDown },
      { to: '/mailcenter/spam', label: 'Spam & Zustellbarkeit', icon: Shield },
    ],
  },
  {
    label: 'Qualität & Rollout',
    items: [
      { to: '/mailcenter/testcenter', label: 'Testcenter', icon: TestTube2 },
      { to: '/mailcenter/qualitaetssicherung', label: 'Qualitätssicherung', icon: BadgeCheck },
      { to: '/mailcenter/systemvalidierung', label: 'Systemvalidierung', icon: FileSignature },
      { to: '/mailcenter/schulungscenter', label: 'Schulungscenter', icon: GraduationCap },
      { to: '/mailcenter/produktivfreigabe', label: 'Produktivfreigabe', icon: Rocket },
    ],
  },
];

export default function MailCenterLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((g) => [g.label, true])),
  );

  const toggleGroup = (label: string) =>
    setOpenGroups((s) => ({ ...s, [label]: !s[label] }));

  return (
    <div className="flex min-h-[calc(100vh-4rem)] animate-fade-in">
      {/* Sidebar */}
      <aside
        className={cn(
          'shrink-0 border-r border-border bg-card/40 transition-all duration-200',
          collapsed ? 'w-14' : 'w-64',
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-3 border-b border-border bg-card/60 backdrop-blur">
          <div className={cn('flex items-center gap-2 overflow-hidden', collapsed && 'justify-center w-full')}>
            <Mail className="w-5 h-5 text-primary shrink-0" />
            {!collapsed && (
              <span className="font-display font-semibold text-sm truncate">MailCenter</span>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Sidebar einklappen"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <div className="flex justify-center py-2 border-b border-border">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Sidebar ausklappen"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        <nav className="overflow-y-auto py-2 px-2 space-y-1 max-h-[calc(100vh-8rem)]">
          {groups.map((g) => {
            const open = openGroups[g.label];
            return (
              <div key={g.label} className="mb-1">
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(g.label)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    <span>{g.label}</span>
                    {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                )}
                {(collapsed || open) && (
                  <div className="space-y-0.5">
                    {g.items.map((t) => {
                      const Icon = t.icon;
                      return (
                        <NavLink
                          key={t.to}
                          to={t.to}
                          end={t.end}
                          title={collapsed ? t.label : undefined}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                              collapsed && 'justify-center',
                              isActive
                                ? 'bg-primary/15 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                            )
                          }
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          {!collapsed && <span className="truncate">{t.label}</span>}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="p-4 lg:p-6">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <Mail className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-display font-bold text-foreground">Alix MailCenter</h1>
            </div>
            <NotificationBell />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
