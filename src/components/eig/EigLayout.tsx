import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Cable, Compass, Webhook, Radio, Workflow, Plug, ArrowRightLeft,
  Database, Timer, RefreshCcw, Code2, Activity, ScrollText, KeyRound, Puzzle, Bug, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ensureEigSeed } from "@/lib/eig/seed";
import { eig } from "@/lib/eig/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NAV = [
  { to: "/eig", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/eig/api", label: "API Gateway", icon: Cable },
  { to: "/eig/explorer", label: "API Explorer", icon: Compass },
  { to: "/eig/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/eig/events", label: "Event Bus", icon: Radio },
  { to: "/eig/workflows", label: "Workflow Engine", icon: Workflow },
  { to: "/eig/integrations", label: "Integrationen", icon: Plug },
  { to: "/eig/mappings", label: "Datenmapping", icon: ArrowRightLeft },
  { to: "/eig/import-export", label: "Import & Export", icon: Database },
  { to: "/eig/jobs", label: "Hintergrundjobs", icon: Timer },
  { to: "/eig/queues", label: "Queues", icon: RefreshCcw },
  { to: "/eig/sync", label: "Synchronisation", icon: RefreshCcw },
  { to: "/eig/plugins", label: "Plugins", icon: Puzzle },
  { to: "/eig/api-keys", label: "API-Schlüssel", icon: KeyRound },
  { to: "/eig/errors", label: "Fehlerverwaltung", icon: Bug },
  { to: "/eig/monitoring", label: "Monitoring", icon: Activity },
  { to: "/eig/logs", label: "Logs", icon: ScrollText },
  { to: "/eig/developer", label: "Entwicklerportal", icon: Code2 },
];

export default function EigLayout() {
  const { pathname } = useLocation();
  const [tenant, setTenant] = useState(() => eig.tenant.current());
  useEffect(() => { ensureEigSeed(); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block border-r border-border/60 bg-card/40 backdrop-blur-xl">
          <div className="p-5 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">AlixWorks</div>
              <div className="mt-1 text-lg font-semibold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">
                Integration Gateway
              </div>
              <div className="text-xs text-muted-foreground">APIs · Events · Workflows · Plugins</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="h-3 w-3" />Mandant</div>
              <Select value={tenant} onValueChange={(v) => { setTenant(v); eig.tenant.set(v); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{eig.tenant.list().map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <nav className="px-2 pb-6 space-y-0.5 max-h-[calc(100vh-160px)] overflow-y-auto">
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
