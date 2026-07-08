import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw } from "lucide-react";

const MODES = [
  { name: "Echtzeit", desc: "Sofortige Zustellung über Event Bus · Push · Streaming (vorbereitet)" },
  { name: "Zeitgesteuert", desc: "Cron-basiert · Delta · Voll · Zeitzonen-sicher" },
  { name: "Manuell", desc: "Adhoc-Trigger durch Admin oder Workflow-Aktion" },
  { name: "Delta", desc: "Nur Änderungen · Änderungszeitpunkte pro Ressource" },
  { name: "Konflikterkennung", desc: "Version + Timestamp · Merge- oder Review-Strategie" },
];

export default function Sync() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Synchronisation</h1>
        <p className="text-sm text-muted-foreground mt-1">Vorbereitete Strategien für alle Datenflüsse.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {MODES.map(m => (
          <Card key={m.name} className="border-border/60 bg-card/40 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><RefreshCcw className="h-4 w-4 text-amber-300" />{m.name}</CardTitle>
              <Badge variant="secondary">vorbereitet</Badge>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{m.desc}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
