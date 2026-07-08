import { Rc1Header, Rc1Card } from "@/components/rc1/Rc1Section";
import { Button } from "@/components/ui/button";
import { rc1 } from "@/lib/rc1/store";
import { toast } from "sonner";
import { useState } from "react";

export default function ProductionMode() {
  const [state, setState] = useState(rc1.get());
  const activate = () => {
    try { setState(rc1.activateProduction()); toast.success("Produktionsmodus aktiviert"); }
    catch (e: any) { toast.error(e.message); }
  };
  const deactivate = () => { setState(rc1.deactivateProduction()); toast("Produktionsmodus deaktiviert"); };
  return (
    <>
      <Rc1Header title="Produktionsmodus" subtitle="Aktivierung erst nach vollständiger Go-Live Checkliste." />
      <Rc1Card>
        <div className="text-sm mb-4">
          Aktueller Status: <span className={state.productionMode ? "text-emerald-400 font-medium" : "text-amber-400"}>
            {state.productionMode ? "PRODUKTION AKTIV" : "Entwicklung / Vorbereitung"}
          </span>
        </div>
        <div className="flex gap-2">
          {!state.productionMode
            ? <Button onClick={activate}>Produktion aktivieren</Button>
            : <Button variant="outline" onClick={deactivate}>Produktion deaktivieren</Button>}
        </div>
        <div className="text-xs text-muted-foreground mt-4">
          Beim Aktivieren wird ein Audit-Eintrag geschrieben. Vor Aktivierung sollte die Go-Live-Checkliste vollständig OK sein.
        </div>
      </Rc1Card>
    </>
  );
}
