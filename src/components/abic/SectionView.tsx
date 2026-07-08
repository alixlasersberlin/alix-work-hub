import { KpiCard } from "./KpiCard";
import { ChartCard } from "./ChartCard";
import type { AbicSectionConfig } from "@/lib/abic/types";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportCsv } from "@/lib/abic/store";

export function SectionView({ section }: { section: AbicSectionConfig }) {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Enterprise Analytics</div>
          <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">
            {section.title}
          </h1>
          {section.subtitle && <p className="text-sm text-muted-foreground mt-1">{section.subtitle}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportCsv(
              `${section.key}-kpis.csv`,
              section.kpis.map((k) => ({ id: k.id, label: k.label, value: k.value, delta: k.delta ?? "" })),
            )
          }
        >
          <Download className="h-4 w-4 mr-1.5" /> Export CSV
        </Button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {section.kpis.map((k) => (<KpiCard key={k.id} kpi={k} />))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {section.charts.map((c) => (<ChartCard key={c.id} chart={c} />))}
      </div>
    </div>
  );
}
