import { Rc1Header, Rc1Card, Bullets } from "@/components/rc1/Rc1Section";
import { rc1 } from "@/lib/rc1/store";
import { Badge } from "@/components/ui/badge";

export default function Updates() {
  const s = rc1.get();
  return (
    <>
      <Rc1Header title="Update Manager" subtitle="Version, Module und Änderungsprotokoll." />
      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <Rc1Card title="Änderungsprotokoll">
          <div className="space-y-2">
            {s.updates.map(u => (
              <div key={u.version} className="border border-border/40 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">v{u.version}</div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">{u.date}</span>
                    <Badge className={u.installed ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border-amber-500/40"}>
                      {u.installed ? "installiert" : "verfügbar"}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{u.notes}</div>
              </div>
            ))}
          </div>
        </Rc1Card>
        <Rc1Card title="Installierte Module">
          <Bullets items={s.license.modules} />
          <div className="text-xs text-muted-foreground mt-3">Rollback-Vorbereitung: aktiviert · Automatische Updates: aus</div>
        </Rc1Card>
      </div>
    </>
  );
}
