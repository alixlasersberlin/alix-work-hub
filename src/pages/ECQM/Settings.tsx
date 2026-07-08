import { useMemo, useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";

export default function Settings() {
  const [tenant, setTenant] = useState<string>(() => ecqm.tenant.current());
  const auditLog = useMemo(() => ecqm.auditlog.list().slice(0, 100), []);

  const exportAll = () => {
    const dump = {
      tenant, exportedAt: new Date().toISOString(),
      documents: ecqm.documents.listAll(), processes: ecqm.processes.listAll(),
      capas: ecqm.capas.listAll(), complaints: ecqm.complaints.listAll(),
      risks: ecqm.risks.listAll(), audits: ecqm.audits.listAll(),
      suppliers: ecqm.suppliers.listAll(), changes: ecqm.changes.listAll(),
      trainings: ecqm.trainings.listAll(), approvals: ecqm.approvals.listAll(),
      auditLog: ecqm.auditlog.list(),
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ecqm-export-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <EcqmPageHeader title="Einstellungen" subtitle="Mandant, Audit-Trail, Export – Grundlage für Regulatory Affairs & AI-Erweiterungen."
        actions={<Button size="sm" onClick={exportAll}><Download className="h-4 w-4 mr-1" /> Gesamtexport</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium">Mandant</div>
            <Select value={tenant} onValueChange={(v) => { setTenant(v); ecqm.tenant.set(v); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ecqm.tenant.list().map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Alle ECQM-Daten sind pro Mandant trennbar (Vorbereitung Mehrmandantenmodus).</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-medium">Vorbereitet für</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Regulatory Affairs", "Technische Dokumentation", "UDI", "Produktakten",
                "Benannte Stellen", "Behördenkommunikation", "Clinical Evaluation",
                "PMS", "PMCF", "Vigilance", "FSCA",
                "AI Audit Assistant", "AI SOP Search", "AI CAPA Analysis",
                "AI Risk Assistant", "AI Document Classification",
              ].map((x) => (<Badge key={x} variant="outline">{x}</Badge>))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-2">Audit-Trail (letzte 100 Einträge)</div>
          {auditLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">Noch keine Einträge.</p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto text-xs">
              {auditLog.map((e) => (
                <div key={e.id} className="flex gap-3 border-b border-border/40 py-1">
                  <span className="text-muted-foreground w-40 shrink-0">{new Date(e.ts).toLocaleString("de-DE")}</span>
                  <span className="w-24 shrink-0">{e.action}</span>
                  <span className="w-20 shrink-0 text-muted-foreground">{e.targetType}</span>
                  <span className="truncate">{e.targetId}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
