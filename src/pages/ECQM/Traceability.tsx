import { useMemo, useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";

/**
 * Rückverfolgbarkeit: nach Gerät/SN, Kunde, Charge oder Nummer suchen
 * und alle verknüpften Elemente (Reklamation, CAPA, Change, Dokumente) anzeigen.
 */
export default function Traceability() {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    const complaints = ecqm.complaints.list().filter((c) =>
      [c.number, c.customerRef, c.deviceRef, c.serviceRef, c.batch].some((v) => v?.toLowerCase().includes(s))
    );
    const capas = ecqm.capas.list().filter((c) => c.number.toLowerCase().includes(s) || c.description.toLowerCase().includes(s));
    const changes = ecqm.changes.list().filter((c) => c.number.toLowerCase().includes(s) || c.description.toLowerCase().includes(s));
    const docs = ecqm.documents.list().filter((d) => `${d.number} ${d.title}`.toLowerCase().includes(s));
    const trainings = ecqm.trainings.list().filter((t) => `${t.employee} ${t.training}`.toLowerCase().includes(s));
    return { complaints, capas, changes, docs, trainings };
  }, [q]);

  return (
    <>
      <EcqmPageHeader title="Rückverfolgbarkeit" subtitle="Lückenlose Historie über Gerät, Seriennummer, Kunde, Charge, CAPA, Reklamation, Dokumente." />
      <Card className="mb-4">
        <CardContent className="p-3">
          <Input placeholder="Seriennummer, Kunde, Chargen-Nr., CAPA-Nr. …" value={q} onChange={(e) => setQ(e.target.value)} />
        </CardContent>
      </Card>

      {!results ? (
        <p className="text-sm text-muted-foreground">Suchbegriff eingeben, um verknüpfte Vorgänge anzuzeigen.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Reklamationen", results.complaints.map((r) => `${r.number} · ${r.description}`)],
            ["CAPAs", results.capas.map((r) => `${r.number} · ${r.description}`)],
            ["Änderungen", results.changes.map((r) => `${r.number} · ${r.description}`)],
            ["Dokumente", results.docs.map((r) => `${r.number} · ${r.title}`)],
            ["Schulungen", results.trainings.map((r) => `${r.employee} · ${r.training}`)],
          ].map(([title, arr]) => (
            <Card key={title as string}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Link className="h-4 w-4 text-amber-400" /><span className="text-sm font-medium">{title}</span><Badge variant="outline">{(arr as string[]).length}</Badge></div>
                {(arr as string[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Treffer.</p>
                ) : (
                  <ul className="text-xs space-y-1">
                    {(arr as string[]).map((line, i) => (<li key={i} className="truncate">{line}</li>))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
