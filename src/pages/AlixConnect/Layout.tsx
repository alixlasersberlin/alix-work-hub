import { NavLink, Outlet } from "react-router-dom";
import {
  MessageSquare, Inbox, Globe, BarChart3, Users, Settings, Megaphone,
  LayoutDashboard, UserSquare2, Sparkles, ClipboardCheck, Zap, FileBarChart, Shield, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups: { label: string; items: { to: string; label: string; icon: any }[] }[] = [
  {
    label: "Übersicht",
    items: [
      { to: "/connect/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/connect/portal", label: "360°-Portal", icon: UserSquare2 },
    ],
  },
  {
    label: "Kommunikation",
    items: [
      { to: "/connect/team", label: "Team Chat", icon: MessageSquare },
      { to: "/connect/inbox", label: "Unified Inbox", icon: Inbox },
      { to: "/connect/contacts", label: "Kontakte", icon: Users },
      { to: "/connect/campaigns", label: "Kampagnen", icon: Megaphone },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/connect/ai", label: "AI Agents", icon: Sparkles },
      { to: "/connect/surveys", label: "Surveys", icon: ClipboardCheck },
      { to: "/connect/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Roadmap",
    items: [
      { to: "/connect/automation", label: "Automation", icon: Zap },
      { to: "/connect/reporting", label: "Reporting", icon: FileBarChart },
      { to: "/connect/admin", label: "Admin", icon: Shield },
      { to: "/connect/mobile", label: "Mobile / PWA", icon: Smartphone },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/connect/websites", label: "Webseiten", icon: Globe },
      { to: "/connect/settings", label: "Einstellungen", icon: Settings },
    ],
  },
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
            Phase 11 · Web Suite
          </span>
        </div>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {groups.map((g) => (
            <div key={g.label} className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">{g.label}</span>
              {g.items.map((t) => (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
