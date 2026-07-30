import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

type Phase = {
  id: number;
  title: string;
  done: boolean;
  note: string;
  links?: { label: string; to: string }[];
};

const phases: Phase[] = [
  {
    id: 1,
    title: "Foundation & Team Chat",
    done: true,
    note: "Datenbank, RLS, Team-Kanäle, Unified Inbox, Webseitenverwaltung, Cookieless Analytics-Store.",
    links: [
      { label: "Team Chat", to: "/connect/team-chat" },
      { label: "Inbox", to: "/connect/inbox" },
    ],
  },
  {
    id: 2,
    title: "Website LiveChat Widget",
    done: true,
    note: "connect.js Bundle (öffentlich auf alixwork.de), Multi-Domain Branding pro Webseite, Lead Auto-Capture im Chat-Start-Formular, Analytics-Tracker (ac-track, cookieless, DNT-konform).",
    links: [
      { label: "Webseiten & Snippet", to: "/connect/websites" },
      { label: "Analytics", to: "/connect/analytics" },
    ],
  },
  {
    id: 3,
    title: "Social & Twilio Integration",
    done: true,
    note: "WhatsApp Cloud API (ac-webhook-whatsapp), Twilio SMS/Voice (ac-webhook-twilio, ac-send-message), Meta FB/IG Webhooks (ac-webhook-meta). Secrets sind hinterlegt.",
    links: [
      { label: "Telefonie", to: "/connect/telephony" },
      { label: "SMS-Vorlagen", to: "/connect/sms-templates" },
    ],
  },
  {
    id: 4,
    title: "CRM, Segmente & Kampagnen",
    done: true,
    note: "Kundenlisten mit Filtern, Segment-Builder inkl. Live-Vorschau, Kampagnen-Runner (A/B + Tracking), Vorlagen-Manager.",
    links: [
      { label: "Kontakte", to: "/connect/contacts" },
      { label: "Segmente", to: "/connect/segments" },
      { label: "Kampagnen", to: "/connect/campaigns" },
    ],
  },
  {
    id: 5,
    title: "Portal & Management Dashboard",
    done: true,
    note: "Kundenportal-Integration (Self-Service + Portal-Chat), Live-KPIs im Dashboard/Cockpit, SLA-Engine sowie CSAT/NPS-Auswertung.",
    links: [
      { label: "Dashboard", to: "/connect/dashboard" },
      { label: "Portal", to: "/connect/portal" },
      { label: "SLA-Engine", to: "/connect/sla-engine" },
    ],
  },
  {
    id: 6,
    title: "KI-Agenten, Surveys & PWA",
    done: true,
    note: "ALIX SURVEYS (CSAT/NPS/Custom), Autopilot- und autonome KI-Agenten, Mobile PWA mit Web-Push (VAPID konfiguriert).",
    links: [
      { label: "Surveys", to: "/connect/surveys" },
      { label: "KI-Agenten", to: "/connect/ai-agents" },
      { label: "Mobile PWA", to: "/connect/mobile" },
    ],
  },
];

export default function ConnectSettings() {
  const doneCount = phases.filter((p) => p.done).length;

  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">ALIX CONNECT — Rollout Status</h2>
          <p className="text-sm text-muted-foreground">
            Sequenzielle Freischaltung der Phasen 1–6.
          </p>
        </div>
        <Badge variant={doneCount === phases.length ? "default" : "secondary"}>
          {doneCount}/{phases.length} Phasen aktiv
        </Badge>
      </div>

      <div className="grid gap-3">
        {phases.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2 flex-row items-center gap-2">
              {p.done ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              <CardTitle className="text-sm">
                Phase {p.id}: {p.title}
              </CardTitle>
              <Badge variant={p.done ? "default" : "outline"} className="ml-auto text-[10px]">
                {p.done ? "Aktiv" : "Offen"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{p.note}</p>
              {p.links?.length ? (
                <div className="flex flex-wrap gap-2">
                  {p.links.map((l) => (
                    <Button key={l.to} asChild size="sm" variant="outline">
                      <Link to={l.to}>
                        {l.label} <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
