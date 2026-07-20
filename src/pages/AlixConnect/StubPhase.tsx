import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";

export function makeStub(title: string, phase: string, description: string, features: string[]) {
  return function StubPage() {
    return (
      <div className="h-full overflow-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Construction className="h-4 w-4 text-primary" /> {title}
            <Badge variant="outline" className="ml-2">{phase}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Geplanter Umfang</div>
          <ul className="text-sm space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4 text-xs text-muted-foreground">
          Diese Ansicht ist ein Platzhalter. Aktivierung erfolgt auf Anfrage — die zugrundeliegende DB (ALIX CONNECT)
          und der Router sind vorbereitet.
        </Card>
      </div>
    );
  };
}

export const AutomationPage = makeStub(
  "Automation & Workflows",
  "Phase 7",
  "Regelbasierte Workflows: Auto-Zuweisung, Eskalation, Trigger-Aktionen über alle Kanäle.",
  [
    "Trigger-Aktions-Editor (Wenn/Dann)",
    "SLA-basierte Eskalation an Teamleiter",
    "Auto-Tagging und Auto-Routing nach Sprache/Thema",
    "Verknüpfung mit CRM-Events (neuer Auftrag, Zahlung offen, Reklamation)",
    "Webhook-Aktionen an externe Systeme",
  ],
);

export const ReportingPage = makeStub(
  "Reporting & BI",
  "Phase 8",
  "Erweiterte Auswertungen, exportierbare Berichte und Team-Leaderboards.",
  [
    "Response-Time / First-Reply-Time pro Kanal",
    "Agent-Performance-Leaderboard",
    "CSAT/NPS Trend-Analyse",
    "Export als CSV, PDF, Google Sheets",
    "Geplante Berichte per E-Mail",
  ],
);

export const AdminConsolePage = makeStub(
  "Admin Console",
  "Phase 9",
  "Zentrale Verwaltung von Teams, Rollen, Kanälen, Kontingenten und Compliance.",
  [
    "Team-Management mit granularen Berechtigungen",
    "Kanal-Kontingente (WhatsApp-Templates, SMS-Budget)",
    "Audit-Log für alle Aktionen",
    "DSGVO-Löschanträge & Datenexport",
    "SSO / SCIM-Integration",
  ],
);

export const MobilePage = makeStub(
  "Mobile & PWA",
  "Phase 10",
  "Native-ähnliche Mobile-Erfahrung für Agents unterwegs.",
  [
    "PWA installierbar (manifest bereits vorhanden)",
    "Push-Benachrichtigungen für neue Nachrichten",
    "Offline-Inbox mit Sync",
    "Voice-to-Text für schnelle Antworten",
    "Native Capacitor-Build für iOS/Android",
  ],
);
