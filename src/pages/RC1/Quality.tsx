import { useState } from "react";
import { Rc1Header, Rc1Card } from "@/components/rc1/Rc1Section";
import { Button } from "@/components/ui/button";
import { rc1 } from "@/lib/rc1/store";
import { Badge } from "@/components/ui/badge";

export default function Quality() {
  const [state, setState] = useState(rc1.get());
  return (
    <>
      <Rc1Header title="Qualitätsprüfung" subtitle="Automatische Prüfung von Übersetzungen, Links, Icons, Berechtigungen und Routen."
        actions={<Button onClick={() => setState(rc1.runQualityCheck())}>Prüfung starten</Button>} />
      <Rc1Card>
        {state.quality.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Prüfung ausgeführt.</div>}
        <div className="space-y-2">
          {state.quality.map(q => (
            <div key={q.id} className="flex items-center justify-between border border-border/40 rounded-md px-3 py-2">
              <div>
                <div className="text-sm">{q.message}</div>
                <div className="text-xs text-muted-foreground">{q.kind}</div>
              </div>
              <Badge className={
                q.severity === "error" ? "bg-red-500/20 text-red-300 border-red-500/40" :
                q.severity === "warn" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                "bg-sky-500/20 text-sky-300 border-sky-500/40"
              }>{q.severity}</Badge>
            </div>
          ))}
        </div>
      </Rc1Card>
    </>
  );
}
