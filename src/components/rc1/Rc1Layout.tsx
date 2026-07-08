import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Compass, Search, Bell, Zap, Database, Shield, KeyRound, Accessibility,
  Smartphone, AlertTriangle, ScrollText, Activity, Package, GitBranch, Rocket, Settings2,
  BookOpen, Code2, TestTube2, CheckCircle2, Palette, Languages, HardDrive, FileCheck2,
  Home, ListChecks, Play, FileBarChart, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/rc1", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/rc1/navigation", label: "Navigation", icon: Compass },
  { to: "/rc1/search", label: "Global Search", icon: Search },
  { to: "/rc1/notifications", label: "Benachrichtigungen", icon: Bell },
  { to: "/rc1/performance", label: "Performance", icon: Zap },
  { to: "/rc1/database", label: "Datenbank", icon: Database },
  { to: "/rc1/security", label: "Sicherheit", icon: Shield },
  { to: "/rc1/permissions", label: "Rechteprüfung", icon: KeyRound },
  { to: "/rc1/accessibility", label: "Accessibility", icon: Accessibility },
  { to: "/rc1/mobile", label: "Mobile", icon: Smartphone },
  { to: "/rc1/errors", label: "Fehlerbehandlung", icon: AlertTriangle },
  { to: "/rc1/logging", label: "Logging", icon: ScrollText },
  { to: "/rc1/monitoring", label: "Monitoring", icon: Activity },
  { to: "/rc1/updates", label: "Update Manager", icon: Package },
  { to: "/rc1/releases", label: "Release Management", icon: GitBranch },
  { to: "/rc1/installer", label: "Installer", icon: Rocket },
  { to: "/rc1/migration", label: "Migration", icon: Settings2 },
  { to: "/rc1/docs", label: "Dokumentation", icon: BookOpen },
  { to: "/rc1/devdocs", label: "Entwicklerdocs", icon: Code2 },
  { to: "/rc1/test-center", label: "Test Center", icon: TestTube2 },
  { to: "/rc1/quality", label: "Qualitätsprüfung", icon: CheckCircle2 },
  { to: "/rc1/design-review", label: "Design Review", icon: Palette },
  { to: "/rc1/i18n", label: "Mehrsprachigkeit", icon: Languages },
  { to: "/rc1/backup", label: "Backup & Recovery", icon: HardDrive },
  { to: "/rc1/license", label: "Lizenz", icon: FileCheck2 },
  { to: "/rc1/startseite", label: "Enterprise Startseite", icon: Home },
  { to: "/rc1/go-live", label: "Go-Live Checkliste", icon: ListChecks },
  { to: "/rc1/production", label: "Produktionsmodus", icon: Play },
  { to: "/rc1/readiness", label: "Readiness Report", icon: FileBarChart },
  { to: "/rc1/future", label: "Zukunftssicherheit", icon: Sparkles },
];

export default function Rc1Layout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block border-r border-border/60 bg-card/40 backdrop-blur-xl">
          <div className="p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">AlixWorks</div>
            <div className="mt-1 text-lg font-semibold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Enterprise RC1
            </div>
            <div className="text-xs text-muted-foreground">Finalisierung · Go-Live · Produktion</div>
          </div>
          <nav className="px-2 pb-6 space-y-0.5 max-h-[calc(100vh-120px)] overflow-y-auto">
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors",
                  isActive && "bg-accent/60 text-foreground shadow-sm",
                )}>
                <item.icon className="h-4 w-4" /><span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-h-screen">
          <div className="lg:hidden overflow-x-auto border-b border-border/60 bg-card/40 backdrop-blur-xl">
            <div className="flex gap-1 p-2 min-w-max">
              {NAV.map(item => (
                <NavLink key={item.to} to={item.to} end={item.end}
                  className={({ isActive }) => cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground",
                    isActive && "bg-accent/60 text-foreground",
                  )}>
                  <item.icon className="h-3.5 w-3.5" />{item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div key={pathname} className="p-4 md:p-8 animate-in fade-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
