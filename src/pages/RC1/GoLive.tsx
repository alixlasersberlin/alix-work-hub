import { useState } from "react";
import { Rc1Header, Rc1Card } from "@/components/rc1/Rc1Section";
import { rc1, GoLiveItem } from "@/lib/rc1/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const COLORS: Record<GoLiveItem["status"], string> = {
  ok: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  warn: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  fail: "bg-red-500/20 text-red-300 border-red-500/40",
};

export default function GoLive() {
  const [state, setState] = useState(rc1.get());
  const update = (id: string, status: GoLiveItem["status"]) => setState(rc1.updateGoLive(id, { status }));
  const okCount = state.goLive.filter(i => i.status === "ok").length;
  return (
    <>
      <Rc1Header title="Go-Live Checkliste" subtitle="Alle Punkte müssen vor Aktivierung des Produktionsmodus geprüft werden."
        actions={<div className="text-sm text-muted-foreground">{okCount}/{state.goLive.length} erfüllt</div>} />
      <Rc1Card>
        <div className="space-y-2">
          {state.goLive.map(item => (
            <div key={item.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${COLORS[item.status]}`}>
              <div>
                <div className="text-sm font-medium">{item.label}</div>
                {item.note && <div className="text-xs opacity-80">{item.note}</div>}
              </div>
              <Select value={item.status} onValueChange={(v) => update(item.id, v as GoLiveItem["status"])}>
                <SelectTrigger className="h-8 w-32 text-xs bg-background/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ok">OK</SelectItem>
                  <SelectItem value="warn">Warnung</SelectItem>
                  <SelectItem value="fail">Fehler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button onClick={() => { rc1.updateGoLive("_", {}); toast.success("Checkliste gespeichert"); }}>Speichern</Button>
        </div>
      </Rc1Card>
    </>
  );
}
