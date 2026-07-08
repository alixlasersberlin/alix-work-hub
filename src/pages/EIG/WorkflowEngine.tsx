import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { eig } from "@/lib/eig/store";
import { ArrowRight, Zap, GitBranch, Timer, PlayCircle, ClipboardList } from "lucide-react";
import EigCrudPage from "@/components/eig/EigCrudPage";

const STEPS = [
  { icon: Zap, label: "Trigger" },
  { icon: GitBranch, label: "Bedingung" },
  { icon: PlayCircle, label: "Aktion" },
  { icon: Timer, label: "Warten" },
  { icon: PlayCircle, label: "Nächste Aktion" },
];

const ACTIONS = ["E-Mail","SMS","WhatsApp","Webhook","API","Dokument","PDF","Kalender","CRM","Service","Training","Benachrichtigung","AI Analyse"];
const TRIGGERS = ["Termin bestätigt","Ticket","Dokument","Benutzer","Rechnung","Schulung","Gerät"];

export default function WorkflowEngine() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Workflow Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">Vorbereitete grafische Orchestrierung. Trigger → Bedingung → Aktion → Warten → Aktion.</p>
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Standard-Ablauf</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-accent/20 px-3 py-2">
                  <s.icon className="h-4 w-4 text-amber-300" />
                  <span className="text-sm">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Verfügbare Trigger</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{TRIGGERS.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}</CardContent>
        </Card>
        <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
          <CardHeader><CardTitle className="text-sm">Verfügbare Aktionen</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">{ACTIONS.map(a => <Badge key={a}>{a}</Badge>)}</CardContent>
        </Card>
      </div>

      <EigCrudPage title="Workflows" subtitle="Definition der aktiven Automatisierungen"
        section="workflows"
        fields={[
          { key: "name", label: "Name" },
          { key: "trigger", label: "Trigger" },
          { key: "steps", label: "Schritte", type: "number" },
          { key: "status", label: "Status" },
        ]}
        columns={["name","trigger","steps","status"]} />

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" />AI-Vorbereitung</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Architektur vorbereitet für AI-Workflow-Generator, AI-Mapping und AI-Fehleranalyse. Aktivierung erfolgt später über die entsprechenden Plugins.
          <div className="mt-3"><Button variant="outline" size="sm" disabled>AI aktivieren (vorbereitet)</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
