import { NavLink, Outlet } from "react-router-dom";
import {
  MessageSquare, Inbox, Globe, BarChart3, Users, Settings, Megaphone,
  LayoutDashboard, UserSquare2, Sparkles, ClipboardCheck, Zap, FileBarChart, Shield, Smartphone, PhoneCall, Activity, PhoneForwarded,
  Mail, Ban, Webhook, FileText, Layers, Workflow, Mic, Video, Route as RouteIcon, Bot, FlaskConical, Scale, GraduationCap,
  CalendarClock, BookOpen, GitBranch, LifeBuoy, Brain, Rocket, Euro, HeartPulse, TrendingUp, LayoutGrid, Languages, Handshake, Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups: { label: string; items: { to: string; label: string; icon: any }[] }[] = [
  {
    label: "Übersicht",
    items: [
      { to: "/connect/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/connect/portal", label: "360°-Portal", icon: UserSquare2 },
      { to: "/connect/customer-360", label: "Customer 360°", icon: Sparkles },
    ],
  },
  {
    label: "Kommunikation",
    items: [
      { to: "/connect/team", label: "Team Chat", icon: MessageSquare },
      { to: "/connect/inbox", label: "Unified Inbox", icon: Inbox },
      { to: "/connect/email", label: "Email", icon: Mail },
      { to: "/connect/sms-templates", label: "SMS-Templates", icon: FileText },
      { to: "/connect/opt-out", label: "Opt-out", icon: Ban },
      { to: "/connect/telefonie", label: "Telefonie (3CX)", icon: PhoneCall },
      { to: "/connect/wallboard", label: "Wallboard", icon: Activity },
      { to: "/connect/queues", label: "Warteschlangen", icon: Users },
      { to: "/connect/ivr", label: "IVR & Öffnungszeiten", icon: PhoneCall },
      { to: "/connect/forwarding", label: "Rufumleitung", icon: PhoneForwarded },
      { to: "/connect/journal", label: "Anruf-Journal", icon: PhoneCall },
      { to: "/connect/analytics-anrufe", label: "Call-Analytics", icon: PhoneCall },
      { to: "/connect/compliance", label: "Recording Compliance", icon: PhoneCall },
      { to: "/connect/contacts", label: "Kontakte", icon: Users },
      { to: "/connect/campaigns", label: "Kampagnen", icon: Megaphone },
      { to: "/connect/segmente", label: "Segmente", icon: Layers },
      { to: "/connect/journeys", label: "Journeys", icon: Workflow },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/connect/ai", label: "AI Agents", icon: Sparkles },
      { to: "/connect/copilot", label: "Copilot", icon: Bot },
      { to: "/connect/voice-ai", label: "Voice AI", icon: Mic },
      { to: "/connect/qm", label: "Quality Mgmt", icon: ClipboardCheck },
      { to: "/connect/routing", label: "Routing 2.0", icon: RouteIcon },
      { to: "/connect/routing-sim", label: "Routing-Simulator", icon: FlaskConical },
      { to: "/connect/routing-live", label: "Routing Live", icon: Activity },
      { to: "/connect/qm-kalibrierung", label: "QM Kalibrierung", icon: Scale },
      { to: "/connect/qm-coaching", label: "QM Coaching", icon: GraduationCap },
      { to: "/connect/cockpit", label: "Cockpit", icon: FileBarChart },
      { to: "/connect/meetings", label: "Meetings", icon: Video },
      { to: "/connect/surveys", label: "Surveys", icon: ClipboardCheck },
      { to: "/connect/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/connect/journey", label: "Journey Analytics", icon: GitBranch },
      { to: "/connect/predictive-cx", label: "Predictive CX", icon: Brain },
      { to: "/connect/outreach", label: "Proactive Outreach", icon: Rocket },
      { to: "/connect/revenue-attribution", label: "Revenue Attribution", icon: Euro },
      { to: "/connect/bot-studio", label: "Bot Studio", icon: Bot },
      { to: "/connect/voice-analytics", label: "Voice Analytics", icon: Mic },
      { to: "/connect/customer-health", label: "Customer Health", icon: HeartPulse },
      { to: "/connect/playbooks", label: "Playbook Automation", icon: Rocket },
      { to: "/connect/journey-orchestrator", label: "Journey Orchestrator 2.0", icon: Workflow },
      { to: "/connect/insights-cockpit", label: "Insights Cockpit", icon: FileBarChart },
      { to: "/connect/sla-engine", label: "SLA & Escalation", icon: Shield },
      { to: "/connect/copilot-actions", label: "Copilot Actions", icon: Bot },
      { to: "/connect/revenue-intelligence", label: "Revenue Intelligence", icon: TrendingUp },
      { to: "/connect/quality-coaching", label: "AI Quality & Coaching", icon: GraduationCap },
      { to: "/connect/omnichannel-campaigns", label: "Omnichannel Campaigns", icon: Megaphone },
      { to: "/connect/conv-intel", label: "Conversational Intel 2.0", icon: Mic },
      { to: "/connect/journey-optimizer", label: "Journey AI-Optimizer", icon: GitBranch },
      { to: "/connect/workspace", label: "Agent Workspace", icon: LayoutGrid },
      { to: "/connect/agent-assist-live", label: "Agent Assist Live 2.0", icon: Sparkles },
      { to: "/connect/customer-intelligence", label: "Customer Intelligence Hub", icon: Sparkles },
      { to: "/connect/autonomous-agents", label: "Autonomous Agents", icon: Bot },
      { to: "/connect/omnichannel-orchestrator", label: "Omnichannel Orchestrator", icon: Sparkles },
      { to: "/connect/voice-ai-studio", label: "Voice AI Studio", icon: Mic },
      { to: "/connect/revenue-intel-v2", label: "Revenue Intel 2.0", icon: Sparkles },
      { to: "/connect/predictive-engagement", label: "Predictive Engagement", icon: Brain },
      { to: "/connect/knowledge-rag", label: "Knowledge & RAG 2.0", icon: BookOpen },
      { to: "/connect/translation-hub", label: "Translation Hub", icon: Languages },
      { to: "/connect/sentiment-emotion", label: "Sentiment & Emotion 2.0", icon: HeartPulse },
      { to: "/connect/workflow-studio", label: "Workflow Studio", icon: Workflow },
      { to: "/connect/compliance-governance", label: "Compliance Cockpit", icon: Shield },
      { to: "/connect/inbox-2", label: "Inbox 2.0", icon: Inbox },
      { to: "/connect/knowledge-hub", label: "Knowledge Hub", icon: BookOpen },
      { to: "/connect/partner-portal", label: "Partner Portal", icon: Handshake },
      { to: "/connect/voice-agent-studio", label: "Voice Agent Studio", icon: Mic },
      { to: "/connect/customer-success", label: "Customer Success", icon: HeartPulse },
      { to: "/connect/advanced-bi", label: "Advanced BI", icon: BarChart3 },
      { to: "/connect/field-dispatch", label: "Field Dispatch 2.0", icon: RouteIcon },
      { to: "/connect/realtime-collab", label: "Realtime Collab", icon: Radio },
      { to: "/connect/compliance-automation", label: "Compliance Automation", icon: Shield },
      { to: "/connect/knowledge", label: "Knowledge Base", icon: BookOpen },
      { to: "/connect/wfm", label: "Workforce", icon: CalendarClock },
    ],
  },
  {
    label: "Integrationen",
    items: [
      { to: "/connect/marketplace", label: "Marketplace / API", icon: Webhook },
      { to: "/connect/marketplace-2", label: "Marketplace 2.0", icon: Webhook },
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
            Phase 44 · Compliance Automation 2.0 · DSGVO · ISO 27001
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
