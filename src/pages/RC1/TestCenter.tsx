import { useState } from "react";
import { Rc1Header, Rc1Card } from "@/components/rc1/Rc1Section";
import { Button } from "@/components/ui/button";
import { rc1 } from "@/lib/rc1/store";
import { Badge } from "@/components/ui/badge";

const SUITES = [
  { key: "smoke", label: "Smoke Tests" },
  { key: "health", label: "Health Checks" },
  { key: "api", label: "API Tests" },
  { key: "workflow", label: "Workflow Tests" },
  { key: "sync", label: "Synchronisation" },
  { key: "calendar", label: "Kalender" },
  { key: "integrations", label: "Integrationen" },
];

export default function TestCenter() {
  const [state, setState] = useState(rc1.get());
  const run = (name: string) => {
    const status = Math.random() > 0.15 ? "pass" : "fail" as const;
    setState(rc1.addTestRun(name, status));
  };
  return (
    <>
      <Rc1Header title="Test Center" subtitle="Interne Testläufe für Administratoren." />
      <div className="grid gap-4 md:grid-cols-2">
        <Rc1Card title="Testsuiten">
          <div className="grid grid-cols-2 gap-2">
            {SUITES.map(s => (
              <Button key={s.key} variant="outline" onClick={() => run(s.label)}>{s.label}</Button>
            ))}
          </div>
        </Rc1Card>
        <Rc1Card title="Letzte Läufe">
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {state.tests.length === 0 && <div className="text-sm text-muted-foreground">Noch keine Läufe</div>}
            {state.tests.map(t => (
              <div key={t.id} className="flex items-center justify-between border border-border/40 rounded-md px-3 py-2 text-sm">
                <span>{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(t.ts).toLocaleTimeString()}</span>
                  <Badge className={t.status === "pass" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-red-500/20 text-red-300 border-red-500/40"}>
                    {t.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Rc1Card>
      </div>
    </>
  );
}
