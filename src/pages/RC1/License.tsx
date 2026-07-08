import { Rc1Header, Rc1Card, Bullets } from "@/components/rc1/Rc1Section";
import { rc1 } from "@/lib/rc1/store";
import { Badge } from "@/components/ui/badge";

export default function License() {
  const s = rc1.get();
  return (
    <>
      <Rc1Header title="Lizenzprüfung" subtitle="Status, Module, Mandanten, Ablauf und Aktivierungen." />
      <div className="grid gap-4 md:grid-cols-2">
        <Rc1Card title="Lizenzdaten">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Status</span><Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">{s.license.status}</Badge></div>
            <div className="flex justify-between"><span>Mandanten</span><span>{s.license.tenants}</span></div>
            <div className="flex justify-between"><span>Läuft bis</span><span>{s.license.expires}</span></div>
            <div className="flex justify-between"><span>Version</span><span>{s.version}</span></div>
          </div>
        </Rc1Card>
        <Rc1Card title="Lizenzierte Module"><Bullets items={s.license.modules} /></Rc1Card>
      </div>
    </>
  );
}
