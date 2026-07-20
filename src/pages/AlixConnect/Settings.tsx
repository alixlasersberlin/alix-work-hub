import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

const phases = [
  { id: 1, title: "Foundation & Team Chat", done: true, note: "Datenbank, RLS, Team-Kanäle, Unified Inbox-Skelett, Webseitenverwaltung, Cookieless Analytics-Store." },
  { id: 2, title: "Website LiveChat Widget", done: false, note: "connect.js Bundle, Multi-Domain Branding, Lead Auto-Capture, Analytics-Tracker." },
  { id: 3, title: "Social & Twilio Integration", done: false, note: "WhatsApp Cloud API, Twilio SMS/Voice, Meta (FB/IG) Webhooks — Secrets werden vor Start abgefragt." },
  { id: 4, title: "CRM, Segmente & Kampagnen", done: false, note: "Kundenlisten-Filter, Segment-Builder, Kampagnen-Runner, Vorlagen-Manager." },
  { id: 5, title: "Portal & Management Dashboard", done: false, note: "Kundenportal-Integration, Live-KPIs, SLA & CSAT/NPS." },
  { id: 6, title: "KI-Agenten, Surveys & PWA", done: false, note: "ALIX SURVEYS, Autopilot-Agenten, Mobile PWA mit Push." },
];

export default function ConnectSettings() {
  return (
    <div className="p-6 space-y-4 overflow-y-auto h-full">
      <div>
        <h2 className="text-lg font-semibold">ALIX CONNECT — Rollout Status</h2>
        <p className="text-sm text-muted-foreground">Sequenzielle Freischaltung der Phasen 1–6.</p>
      </div>
      <div className="grid gap-3">
        {phases.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2 flex-row items-center gap-2">
              {p.done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
              <CardTitle className="text-sm">Phase {p.id}: {p.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{p.note}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
