import { Rc1Header, Rc1Card, Bullets } from "@/components/rc1/Rc1Section";
import { rc1 } from "@/lib/rc1/store";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

export default function Rc1Dashboard() {
  const s = rc1.get();
  const ok = s.goLive.filter(i => i.status === "ok").length;
  const warn = s.goLive.filter(i => i.status === "warn").length;
  const fail = s.goLive.filter(i => i.status === "fail").length;
  const tiles = [
    { to: "/rc1/go-live", label: "Go-Live Checkliste", value: `${ok}/${s.goLive.length}` },
    { to: "/rc1/readiness", label: "Readiness Report", value: fail === 0 && warn <= 1 ? "Bereit" : "In Prüfung" },
    { to: "/rc1/test-center", label: "Test Center", value: `${s.tests.length} Läufe` },
    { to: "/rc1/updates", label: "Version", value: s.version },
    { to: "/rc1/license", label: "Lizenz", value: s.license.status },
    { to: "/rc1/production", label: "Produktionsmodus", value: s.productionMode ? "AKTIV" : "aus" },
  ];
  return (
    <>
      <Rc1Header title="Enterprise Release Candidate 1" subtitle="Zentrale Übersicht für Finalisierung, Qualitätssicherung und Go-Live von AlixWorks." />
      <div className="grid gap-4 md:grid-cols-3">
        {tiles.map(t => (
          <Link key={t.to} to={t.to} className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl p-5 hover:border-amber-500/50 transition-colors">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold">{t.value}</div>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Rc1Card title="Go-Live Ampel">
          <div className="flex gap-2 mb-3">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">OK: {ok}</Badge>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Warn: {warn}</Badge>
            <Badge className="bg-red-500/20 text-red-300 border-red-500/40">Fehler: {fail}</Badge>
          </div>
          <Bullets items={s.goLive.slice(0, 5).map(i => `${i.label} – ${i.status.toUpperCase()}`)} />
        </Rc1Card>
        <Rc1Card title="Integrierte Module">
          <Bullets items={["CRM", "Enterprise Scheduling", "Mobile Platform", "Communication Hub", "Customer Portal", "Analytics", "Compliance", "Administration", "Integration Gateway"]} />
        </Rc1Card>
      </div>
    </>
  );
}
