import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eaoc } from "@/lib/eaoc/store";
import { Building2, Users, Layers, MapPin, Plug, Webhook, ShieldCheck, HardDrive, Server, Wrench } from "lucide-react";

const Kpi = ({ icon: Icon, label, value, hint }: any) => (
  <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
    <CardContent className="p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400/20 to-yellow-500/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-amber-300" />
      </div>
      <div>
        <div className="text-xs uppercase text-muted-foreground tracking-wider">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </CardContent>
  </Card>
);

export default function EaocDashboard() {
  const [, setTick] = useState(0);
  useEffect(() => { setTick(t => t + 1); }, []);
  const m = eaoc.maintenance.get();
  const audit = eaoc.audit.list().slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Administration Cockpit</h1>
        <p className="text-sm text-muted-foreground mt-1">Zentrale Verwaltungssicht auf Unternehmen, Mandanten und Systemzustand.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi icon={Building2} label="Gesellschaften" value={eaoc.list("companies").length} />
        <Kpi icon={Layers} label="Mandanten" value={eaoc.list("tenants").length} />
        <Kpi icon={MapPin} label="Standorte" value={eaoc.list("locations").length} />
        <Kpi icon={Users} label="Benutzer" value={eaoc.list("users").length} />
        <Kpi icon={ShieldCheck} label="Rollen" value={eaoc.list("roles").length} />
        <Kpi icon={Plug} label="Integrationen" value={eaoc.list("integrations").length} />
        <Kpi icon={Webhook} label="Webhooks" value={eaoc.list("webhooks").length} />
        <Kpi icon={HardDrive} label="Backups" value={eaoc.list("backups").length} />
        <Kpi icon={Server} label="Jobs" value={eaoc.list("jobs").length} />
        <Kpi icon={Wrench} label="Wartung" value={m.active ? "aktiv" : "aus"} hint={m.active ? m.message : "Betrieb normal"} />
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Letzte Administrationsaktionen</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-2">Zeit</th>
                <th className="text-left px-4 py-2">Benutzer</th>
                <th className="text-left px-4 py-2">Aktion</th>
                <th className="text-left px-4 py-2">Bereich</th>
                <th className="text-left px-4 py-2">Entität</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(a => (
                <tr key={a.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(a.ts).toLocaleString()}</td>
                  <td className="px-4 py-2">{a.user}</td>
                  <td className="px-4 py-2">{a.action}</td>
                  <td className="px-4 py-2">{a.section}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{a.entityId ?? "-"}</td>
                </tr>
              ))}
              {audit.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Noch keine Aktionen</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
