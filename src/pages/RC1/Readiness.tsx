import { Rc1Header, Rc1Card, Bullets } from "@/components/rc1/Rc1Section";
import { Button } from "@/components/ui/button";
import { rc1 } from "@/lib/rc1/store";
import { toast } from "sonner";

export default function Readiness() {
  const s = rc1.get();
  const ok = s.goLive.filter(i => i.status === "ok").length;
  const ratio = Math.round((ok / s.goLive.length) * 100);
  const bereit = s.goLive.every(i => i.status !== "fail") && ratio >= 90;

  const exportPdf = () => {
    const report = {
      version: s.version, date: new Date().toISOString(), production: s.productionMode,
      goLive: s.goLive, license: s.license, tests: s.tests.length, quality: s.quality,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `alixworks-readiness-${s.version}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exportiert");
  };

  return (
    <>
      <Rc1Header title="Enterprise Readiness Report"
        subtitle={`Version ${s.version} · Bereitschaft ${ratio}% · Status: ${bereit ? "Produktionsbereit" : "In Prüfung"}`}
        actions={<Button onClick={exportPdf}>Als Datei exportieren</Button>} />
      <div className="grid gap-4 md:grid-cols-2">
        <Rc1Card title="Module">
          <Bullets items={s.license.modules} />
        </Rc1Card>
        <Rc1Card title="Prüfergebnisse">
          <Bullets items={[
            `Go-Live Ampel: ${ok}/${s.goLive.length} OK`,
            `Testläufe: ${s.tests.length}`,
            `Qualitätshinweise: ${s.quality.length}`,
            `Produktionsmodus: ${s.productionMode ? "aktiv" : "inaktiv"}`,
            `Lizenz: ${s.license.status} bis ${s.license.expires}`,
          ]} />
        </Rc1Card>
        <Rc1Card title="Offene Punkte">
          <Bullets items={s.goLive.filter(i => i.status !== "ok").map(i => `${i.label} (${i.status})`)} />
        </Rc1Card>
        <Rc1Card title="Architektur & Zukunftssicherheit">
          <Bullets items={["KI-Automatisierungen vorbereitet", "IoT & Digital Twin Schnittstellen offen", "Predictive Maintenance Slots", "ERP/BI Erweiterungen", "Multi-Cloud & White-Label", "Plugin Marketplace"]} />
        </Rc1Card>
      </div>
    </>
  );
}
