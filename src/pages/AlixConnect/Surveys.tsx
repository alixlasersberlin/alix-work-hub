import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck } from "lucide-react";

export default function AlixConnectSurveys() {
  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" /> ALIX Surveys
          <Badge variant="outline" className="ml-2">MVP</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">NPS-, CSAT- und Ad-hoc-Umfragen über E-Mail, WhatsApp und Website.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { name: "Net Promoter Score", desc: "0-10 Skala nach Auftragsabschluss", trigger: "order.completed" },
          { name: "CSAT Support", desc: "1-5 Sterne nach Ticket-Close", trigger: "ticket.closed" },
          { name: "Onboarding-Feedback", desc: "Nach 14 Tagen Nutzung", trigger: "customer.day14" },
        ].map((s) => (
          <Card key={s.name} className="p-4">
            <div className="text-sm font-semibold">{s.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.desc}</div>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Trigger</div>
            <code className="text-xs">{s.trigger}</code>
          </Card>
        ))}
      </div>
      <Card className="p-4 text-xs text-muted-foreground">
        Vollständige Umfragen-Engine (Fragebogen-Builder, Versand, Auswertung) folgt in Phase 6.5.
      </Card>
    </div>
  );
}
