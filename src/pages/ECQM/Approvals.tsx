import { useState } from "react";
import { EcqmPageHeader } from "@/components/ecqm/EcqmPageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { ecqm } from "@/lib/ecqm/store";
import { toast } from "sonner";

export default function Approvals() {
  const [docs, setDocs] = useState(() => ecqm.documents.list().filter((d) => d.status === "pruefung" || d.status === "entwurf"));

  const decide = (id: string, ok: boolean) => {
    const d = ecqm.documents.get(id);
    if (!d) return;
    ecqm.documents.upsert({ ...d, status: ok ? "freigegeben" : "entwurf" });
    ecqm.approvals.upsert({
      targetType: "Dokument", targetId: id, step: 1, role: "Freigeber",
      decision: ok ? "ok" : "nein", decidedAt: new Date().toISOString(),
      status: ok ? "freigegeben" : "abgelehnt", approver: "current-user",
    });
    toast.success(ok ? `Freigegeben: ${d.number}` : `Zurückgewiesen: ${d.number}`);
    setDocs(ecqm.documents.list().filter((x) => x.status === "pruefung" || x.status === "entwurf"));
  };

  return (
    <>
      <EcqmPageHeader title="Elektronische Freigaben" subtitle="Mehrstufiger Workflow: Erstellt → Prüfung → Freigabe → Veröffentlichung. Elektronische Signatur vorbereitet." />
      <div className="grid gap-3">
        {docs.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{d.number} · {d.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline">{d.type}</Badge>
                  <Badge variant="secondary">v{d.version}</Badge>
                  <Badge>{d.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Verantwortlich: {d.owner}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide(d.id, true)}><CheckCircle2 className="h-4 w-4 mr-1" /> Freigeben</Button>
                <Button size="sm" variant="outline" onClick={() => decide(d.id, false)}><XCircle className="h-4 w-4 mr-1" /> Zurück</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {docs.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Freigaben.</p>}
      </div>
    </>
  );
}
