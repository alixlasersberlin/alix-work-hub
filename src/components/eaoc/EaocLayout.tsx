import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Building2, Layers, MapPin, Users, Shield, KeyRound, UsersRound,
  Palette, Plug, Webhook, BadgeCheck, Lock, Settings2, Wrench, ScrollText, Server,
  Bell, DownloadCloud, UploadCloud, Timer, Search as SearchIcon, ShieldAlert, HardDrive,
  Network, Code2, Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ensureEaocSeed } from "@/lib/eaoc/seed";
import { eaoc } from "@/lib/eaoc/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NAV = [
  { to: "/eaoc", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/eaoc/companies", label: "Gesellschaften", icon: Building2 },
  { to: "/eaoc/tenants", label: "Mandanten", icon: Layers },
  { to: "/eaoc/locations", label: "Standorte", icon: MapPin },
  { to: "/eaoc/departments", label: "Abteilungen", icon: Building },
  { to: "/eaoc/teams", label: "Teams", icon: UsersRound },
  { to: "/eaoc/users", label: "Benutzer", icon: Users },
  { to: "/eaoc/roles", label: "Rollen", icon: Shield },
  { to: "/eaoc/permissions", label: "Berechtigungen", icon: KeyRound },
  { to: "/eaoc/orgchart", label: "Organigramm", icon: Network },
  { to: "/eaoc/branding", label: "Branding", icon: Palette },
  { to: "/eaoc/integrations", label: "Integrationen", icon: Plug },
  { to: "/eaoc/api-keys", label: "API-Schlüssel", icon: KeyRound },
  { to: "/eaoc/webhooks", label: "Webhooks", icon: Webhook },
  { to: "/eaoc/licenses", label: "Lizenzen", icon: BadgeCheck },
  { to: "/eaoc/security", label: "Sicherheit", icon: Lock },
  { to: "/eaoc/backups", label: "Backup", icon: HardDrive },
  { to: "/eaoc/monitoring", label: "Systemüberwachung", icon: Server },
  { to: "/eaoc/maintenance", label: "Wartungsmodus", icon: Wrench },
  { to: "/eaoc/notifications", label: "Benachrichtigungen", icon: Bell },
  { to: "/eaoc/export", label: "Export", icon: DownloadCloud },
  { to: "/eaoc/import", label: "Import", icon: UploadCloud },
  { to: "/eaoc/jobs", label: "Aufgabenplanung", icon: Timer },
  { to: "/eaoc/search", label: "Enterprise Suche", icon: SearchIcon },
  { to: "/eaoc/privacy", label: "Datenschutz", icon: ShieldAlert },
  { to: "/eaoc/audit", label: "Audit", icon: ScrollText },
  { to: "/eaoc/settings", label: "Systemeinstellungen", icon: Settings2 },
  { to: "/eaoc/developer", label: "Developer Center", icon: Code2 },
];

export default function EaocLayout() {
  const { pathname } = useLocation();
  const [tenant, setTenant] = useState<string>(() => eaoc.tenant.current());

  useEffect(() => { ensureEaocSeed(); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block border-r border-border/60 bg-card/40 backdrop-blur-xl">
          <div className="p-5 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">AlixWorks</div>
              <div className="mt-1 text-lg font-semibold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">
                Administration
              </div>
              <div className="text-xs text-muted-foreground">Organisation · Mandanten · Sicherheit</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="h-3 w-3" />Mandant</div>
              <Select value={tenant} onValueChange={(v) => { setTenant(v); eaoc.tenant.set(v); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {eaoc.tenant.list().map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <nav className="px-2 pb-6 space-y-0.5 max-h-[calc(100vh-160px)] overflow-y-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors",
                    isActive && "bg-accent/60 text-foreground shadow-sm",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-h-screen">
          <div className="lg:hidden overflow-x-auto border-b border-border/60 bg-card/40 backdrop-blur-xl">
            <div className="flex gap-1 p-2 min-w-max">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs text-muted-foreground",
                      isActive && "bg-accent/60 text-foreground",
                    )
                  }
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
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
