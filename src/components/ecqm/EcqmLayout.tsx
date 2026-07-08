import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, FileText, BookOpen, GitBranch, ClipboardCheck, MessageSquareWarning,
  AlertTriangle, ShieldCheck, Truck, GraduationCap, UserCheck, RefreshCcw, Link2,
  BarChart3, Signature, Archive, Settings2, Building2, Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ensureEcqmSeed } from "@/lib/ecqm/seed";
import { ecqm } from "@/lib/ecqm/store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NAV = [
  { to: "/ecqm", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/ecqm/dokumente", label: "Dokumente", icon: FileText },
  { to: "/ecqm/sops", label: "SOPs", icon: BookOpen },
  { to: "/ecqm/prozesse", label: "Prozesse", icon: GitBranch },
  { to: "/ecqm/capa", label: "CAPA", icon: ClipboardCheck },
  { to: "/ecqm/reklamationen", label: "Reklamationen", icon: MessageSquareWarning },
  { to: "/ecqm/risiken", label: "Risiken", icon: AlertTriangle },
  { to: "/ecqm/audits", label: "Audits", icon: ShieldCheck },
  { to: "/ecqm/lieferanten", label: "Lieferanten", icon: Truck },
  { to: "/ecqm/schulungen", label: "Schulungen", icon: GraduationCap },
  { to: "/ecqm/qualifikationen", label: "Qualifikationen", icon: UserCheck },
  { to: "/ecqm/change-control", label: "Änderungsmgmt.", icon: RefreshCcw },
  { to: "/ecqm/rueckverfolgbarkeit", label: "Rückverfolgbarkeit", icon: Link2 },
  { to: "/ecqm/managementbewertung", label: "Managementbewertung", icon: BarChart3 },
  { to: "/ecqm/kennzahlen", label: "Kennzahlen", icon: Gauge },
  { to: "/ecqm/freigaben", label: "Freigaben", icon: Signature },
  { to: "/ecqm/archiv", label: "Archiv", icon: Archive },
  { to: "/ecqm/einstellungen", label: "Einstellungen", icon: Settings2 },
];

export default function EcqmLayout() {
  const { pathname } = useLocation();
  const [tenant, setTenant] = useState<string>(() => ecqm.tenant.current());

  useEffect(() => { ensureEcqmSeed(); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block border-r border-border/60 bg-card/40 backdrop-blur-xl">
          <div className="p-5 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">AlixWorks</div>
              <div className="mt-1 text-lg font-semibold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">
                Compliance & Quality
              </div>
              <div className="text-xs text-muted-foreground">ISO 13485 · MDR · MPDG</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Building2 className="h-3 w-3" />Mandant</div>
              <Select value={tenant} onValueChange={(v) => { setTenant(v); ecqm.tenant.set(v); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ecqm.tenant.list().map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <nav className="px-2 pb-6 space-y-0.5">
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
