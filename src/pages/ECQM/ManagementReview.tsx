import { useMemo } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ecqm, ecqmKpis } from "@/lib/ecqm/store";

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function ManagementReview() {
  const k = useMemo(() => ecqmKpis(), []);
  const capas = ecqm.capas.list();
  const risks = ecqm.risks.list();
  const complaints = ecqm.complaints.list();
  const audits = ecqm.audits.list();
  const suppliers = ecqm.suppliers.list();

  const bundle = { generatedAt: new Date().toISOString(), tenant: ecqm.tenant.current(), kpis: k, capas, risks, complaints, audits, suppliers };

  return (
    <>
      <EcqmPageHeader title="Managementbewertung" subtitle="Automatisch zusammengestellter Report für die Geschäftsleitung."
        actions={<Button size="sm" onClick={() => downloadJson(`management-review-${new Date().toISOString().slice(0,10)}.json`, bundle)}><Download className="h-4 w-4 mr-1" /> Export</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(k).map(([key, val]) => (
          <Card key={key}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">{key}</div>
              <div className="text-2xl font-semibold tabular-nums">{val as number}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Top-Risiken</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {risks.sort((a, b) => (b.probability * b.impact) - (a.probability * a.impact)).slice(0, 5).map((r) => (
              <div key={r.id} className="flex justify-between border-b border-border/40 py-1">
                <span>{r.number} · {r.category}</span>
                <span className="text-muted-foreground">Score {r.probability * r.impact}</span>
              </div>
            ))}
            {risks.length === 0 && <p className="text-muted-foreground text-xs">Keine Risiken.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Offene CAPAs</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {capas.filter((c) => c.status !== "geschlossen").slice(0, 5).map((c) => (
              <div key={c.id} className="flex justify-between border-b border-border/40 py-1">
                <span>{c.number}</span>
                <span className="text-muted-foreground">{c.due ?? "-"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
