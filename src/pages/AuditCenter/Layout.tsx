import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Radio, Clock, Users2, GitCompare, ShieldAlert, FileBarChart, Sparkles, ShieldCheck,
} from "lucide-react";

const NAV = [
  { to: "/audit-center", label: "Übersicht", icon: LayoutDashboard, end: true },
  { to: "/audit-center/live", label: "Live-Monitor", icon: Radio },
  { to: "/audit-center/timeline", label: "Timeline", icon: Clock },
  { to: "/audit-center/employees", label: "Mitarbeiter", icon: Users2 },
  { to: "/audit-center/changes", label: "Änderungen", icon: GitCompare },
  { to: "/audit-center/security", label: "Sicherheit", icon: ShieldAlert },
  { to: "/audit-center/ups", label: "UPS-Score", icon: Sparkles },
  { to: "/audit-center/reports", label: "Reports", icon: FileBarChart },
];

export default function AuditCenterLayout() {
  const { roles, loading } = useAuth();
  if (loading) return null;
  if (!roles?.includes("Super Admin")) return <Navigate to="/access-denied" replace />;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block border-r border-border/60 bg-card/40 backdrop-blur-xl">
          <div className="p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">AlixWork</div>
            <div className="mt-1 text-lg font-semibold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Audit Center
            </div>
            <div className="text-xs text-muted-foreground mt-1">Enterprise Audit & Produktivität</div>
          </div>
          <nav className="px-2 pb-6 space-y-0.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors",
                    isActive && "bg-accent/60 text-foreground shadow-sm",
                  )
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-h-screen p-4 md:p-8 animate-in fade-in duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
