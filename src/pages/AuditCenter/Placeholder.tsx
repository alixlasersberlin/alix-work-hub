import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function AuditPlaceholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Erscheint in {phase}.</p>
      </div>
      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
          <Sparkles className="h-8 w-8 text-amber-400" />
          <div className="text-sm text-muted-foreground max-w-md">
            Dieses Modul wird in {phase} des Audit-Center-Rollouts freigeschaltet. Das Fundament (Sitzungen, Timeline,
            Geräte, IPs, Änderungen) wird bereits erfasst und ist ab sofort in „Übersicht" und „Timeline" sichtbar.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
