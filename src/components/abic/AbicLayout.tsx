import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, TrendingUp, Wrench, GraduationCap, Wallet, Users2, Activity,
  Megaphone, Cpu, UserSquare2, MapPin, LineChart, Sparkles, FileText, Compass, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/abic", label: "Executive Dashboard", icon: LayoutDashboard, end: true },
  { to: "/abic/sales", label: "Sales Analytics", icon: TrendingUp },
  { to: "/abic/service", label: "Service Analytics", icon: Wrench },
  { to: "/abic/training", label: "Training Analytics", icon: GraduationCap },
  { to: "/abic/finance", label: "Finance Analytics", icon: Wallet },
  { to: "/abic/customers", label: "Customer Analytics", icon: Users2 },
  { to: "/abic/operations", label: "Operations", icon: Activity },
  { to: "/abic/marketing", label: "Marketing", icon: Megaphone },
  { to: "/abic/devices", label: "Geräte", icon: Cpu },
  { to: "/abic/employees", label: "Mitarbeiter", icon: UserSquare2 },
  { to: "/abic/locations", label: "Standorte", icon: MapPin },
  { to: "/abic/forecast", label: "Forecast", icon: LineChart },
  { to: "/abic/kpi-designer", label: "KPI Designer", icon: Sparkles },
  { to: "/abic/reports", label: "Reports", icon: FileText },
  { to: "/abic/explorer", label: "Data Explorer", icon: Compass },
  { to: "/abic/dashboards", label: "Dashboards", icon: LayoutDashboard },
  { to: "/abic/goals", label: "Zielverfolgung", icon: Target },
];

export default function AbicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block border-r border-border/60 bg-card/40 backdrop-blur-xl">
          <div className="p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">AlixWorks</div>
            <div className="mt-1 text-lg font-semibold bg-gradient-to-r from-amber-300 to-yellow-500 bg-clip-text text-transparent">
              Enterprise Analytics
            </div>
            <div className="text-xs text-muted-foreground">Business Intelligence Center</div>
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
          {/* Mobile top nav */}
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
