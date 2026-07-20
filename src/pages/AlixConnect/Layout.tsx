import { NavLink, Outlet } from "react-router-dom";
import { MessageSquare, Inbox, Globe, BarChart3, Users, Settings, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/connect/team", label: "Team Chat", icon: MessageSquare },
  { to: "/connect/inbox", label: "Unified Inbox", icon: Inbox },
  { to: "/connect/contacts", label: "Kontakte", icon: Users },
  { to: "/connect/campaigns", label: "Kampagnen", icon: Megaphone },
  { to: "/connect/websites", label: "Webseiten", icon: Globe },
  { to: "/connect/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/connect/settings", label: "Einstellungen", icon: Settings },
];

export default function AlixConnectLayout() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-border/60 bg-card/40 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">ALIX CONNECT</h1>
            <p className="text-xs text-muted-foreground">Unified Communication &amp; Customer Intelligence</p>
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            Phase 4 · CRM &amp; Campaigns
          </span>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
