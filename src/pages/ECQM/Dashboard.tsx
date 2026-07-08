import { useMemo } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ecqm, ecqmKpis, ecqmTrafficLight } from "@/lib/ecqm/store";
import {
  AlertTriangle, ClipboardCheck, FileText, GraduationCap, MessageSquareWarning,
  ShieldCheck, Truck, Signature,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Tile({ icon: Icon, label, value, to, tone = "default" }: any) {
  const toneCls =
    tone === "warn" ? "text-amber-500" :
    tone === "bad" ? "text-rose-500" :
    tone === "good" ? "text-emerald-500" : "text-foreground";
  return (
    <Link to={to} className="block">
      <Card className="group border-border/60 bg-card/60 backdrop-blur hover:border-primary/40 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Icon className="h-4 w-4" /> {label}
          </div>
          <div className={cn("mt-2 text-3xl font-semibold tabular-nums", toneCls)}>{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function EcqmDashboard() {
  const k = useMemo(() => ecqmKpis(), []);
  const light = ecqmTrafficLight();
  const audits = ecqm.audits.list().slice(0, 5);
  const capas = ecqm.capas.list().filter((c) => c.status !== "geschlossen").slice(0, 5);

  const lightMap = { gruen: "bg-emerald-500", gelb: "bg-amber-500", rot: "bg-rose-500" } as const;
  const lightLbl = { gruen: "Grün – Konform", gelb: "Gelb – Aufmerksamkeit", rot: "Rot – Handlungsbedarf" } as const;

  return (
    <>
      <EcqmPageHeader
        title="Compliance Dashboard"
        subtitle="Managementübersicht – ISO 13485, MDR & MPDG relevante Kennzahlen"
        actions={
          <div className="flex items-center gap-2 rounded-full bg-card/60 backdrop-blur border border-border/60 px-3 py-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", lightMap[light])} />
            <span className="text-xs font-medium">{lightLbl[light]}</span>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={ClipboardCheck} label="Offene CAPAs" value={k.openCapas} to="/ecqm/capa" tone={k.overdueCapas > 0 ? "bad" : "default"} />
        <Tile icon={MessageSquareWarning} label="Offene Reklamationen" value={k.openComplaints} to="/ecqm/reklamationen" tone={k.openComplaints > 3 ? "warn" : "default"} />
        <Tile icon={AlertTriangle} label="Kritische Risiken" value={k.criticalRisks} to="/ecqm/risiken" tone={k.criticalRisks > 0 ? "bad" : "good"} />
        <Tile icon={ShieldCheck} label="Überfällige Audits" value={k.overdueAudits} to="/ecqm/audits" tone={k.overdueAudits > 0 ? "bad" : "good"} />
        <Tile icon={FileText} label="Dokumente zur Freigabe" value={k.docsToApprove} to="/ecqm/freigaben" tone={k.docsToApprove > 0 ? "warn" : "default"} />
        <Tile icon={GraduationCap} label="Ablaufende Schulungen" value={k.expiringTrainings} to="/ecqm/schulungen" tone={k.expiringTrainings > 0 ? "warn" : "default"} />
        <Tile icon={Truck} label="Aktive Lieferanten" value={k.suppliersActive} to="/ecqm/lieferanten" />
        <Tile icon={Signature} label="Ablaufende Dokumente" value={k.docsExpiring} to="/ecqm/dokumente" tone={k.docsExpiring > 0 ? "warn" : "default"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Nächste Audits</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {audits.length === 0 && <p className="text-sm text-muted-foreground">Keine Audits geplant.</p>}
            {audits.map((a) => (
              <Link key={a.id} to="/ecqm/audits" className="flex items-center justify-between rounded-md border border-border/60 p-2 text-sm hover:bg-accent/40">
                <div>
                  <div className="font-medium">{a.number} · {a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.type} · {a.auditor}</div>
                </div>
                <div className="text-xs text-muted-foreground">{a.scheduledFor}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Offene CAPAs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {capas.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen CAPAs.</p>}
            {capas.map((c) => (
              <Link key={c.id} to="/ecqm/capa" className="flex items-center justify-between rounded-md border border-border/60 p-2 text-sm hover:bg-accent/40">
                <div>
                  <div className="font-medium">{c.number}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>
                </div>
                <div className="text-xs text-muted-foreground">{c.due ?? "-"}</div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
