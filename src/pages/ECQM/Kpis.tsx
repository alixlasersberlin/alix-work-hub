import { useMemo } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ecqm, ecqmKpis } from "@/lib/ecqm/store";

export default function Kpis() {
  const k = useMemo(() => ecqmKpis(), []);
  const capas = ecqm.capas.list();
  const complaints = ecqm.complaints.list();
  const suppliers = ecqm.suppliers.list();
  const trainings = ecqm.trainings.list();

  const capaAvgDays = capas.filter((c) => c.status === "geschlossen").length
    ? Math.round(capas.filter((c) => c.status === "geschlossen").reduce((a, c) => a + Math.max(1, (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000), 0) / Math.max(1, capas.filter((c) => c.status === "geschlossen").length))
    : 0;
  const complaintsRate = complaints.length ? Math.round((complaints.filter((c) => c.status === "geschlossen").length / complaints.length) * 100) : 0;
  const supplierAvg = suppliers.length ? +(suppliers.reduce((a, s) => a + (s.performance ?? 0), 0) / suppliers.length).toFixed(1) : 0;
  const trainingsRate = trainings.length ? Math.round((trainings.filter((t) => t.status === "absolviert").length / trainings.length) * 100) : 0;

  const tiles = [
    { label: "Offene CAPAs", value: k.openCapas },
    { label: "Überfällige CAPAs", value: k.overdueCapas },
    { label: "Ø CAPA-Bearbeitung (Tage)", value: capaAvgDays },
    { label: "Reklamationsschließungsquote", value: `${complaintsRate} %` },
    { label: "Lieferantenperformance Ø", value: `${supplierAvg} %` },
    { label: "Schulungsquote", value: `${trainingsRate} %` },
    { label: "Dokumente zur Freigabe", value: k.docsToApprove },
    { label: "Kritische Risiken", value: k.criticalRisks },
  ];

  return (
    <>
      <EcqmPageHeader title="Qualitätskennzahlen" subtitle="ISO 13485 / MDR relevante KPIs auf Basis der ECQM-Datenbasis." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">{t.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
