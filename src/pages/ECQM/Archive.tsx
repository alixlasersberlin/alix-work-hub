import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";

/** Alle weichgelöschten Objekte zentral einsehbar. Wiederherstellbar. */
export default function Archive() {
  const [tick, setTick] = useState(0);
  const buckets = [
    { key: "documents", label: "Dokumente", items: ecqm.documents.listAll().filter((x) => x.deletedAt) },
    { key: "capas", label: "CAPAs", items: ecqm.capas.listAll().filter((x) => x.deletedAt) },
    { key: "complaints", label: "Reklamationen", items: ecqm.complaints.listAll().filter((x) => x.deletedAt) },
    { key: "risks", label: "Risiken", items: ecqm.risks.listAll().filter((x) => x.deletedAt) },
    { key: "audits", label: "Audits", items: ecqm.audits.listAll().filter((x) => x.deletedAt) },
    { key: "suppliers", label: "Lieferanten", items: ecqm.suppliers.listAll().filter((x) => x.deletedAt) },
    { key: "changes", label: "Changes", items: ecqm.changes.listAll().filter((x) => x.deletedAt) },
    { key: "trainings", label: "Schulungen", items: ecqm.trainings.listAll().filter((x) => x.deletedAt) },
  ] as const;

  const restore = (bucket: string, id: string) => {
    (ecqm as any)[bucket].restore(id);
    setTick((t) => t + 1);
  };

  return (
    <>
      <EcqmPageHeader title="Archiv" subtitle="Soft-Delete-Historie – qualitätsrelevante Daten werden nicht physisch gelöscht." />
      <div className="grid gap-3">
        {buckets.map((b) => (
          <Card key={b.key}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">{b.label}</div>
                <Badge variant="outline">{b.items.length}</Badge>
              </div>
              {b.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nichts archiviert.</p>
              ) : (
                <div className="space-y-1">
                  {b.items.map((x: any) => (
                    <div key={x.id} className="flex items-center justify-between text-xs border-b border-border/40 py-1.5">
                      <span className="truncate">{x.number ?? x.name ?? x.employee ?? x.id}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">gelöscht {x.deletedAt?.slice(0, 10)}</span>
                        <Button size="sm" variant="ghost" onClick={() => restore(b.key, x.id)}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Wiederherstellen</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
