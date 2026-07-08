import { useState } from "react";
import { Rc1Header, Rc1Card } from "@/components/rc1/Rc1Section";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const SOURCES = [
  "CRM", "Kunden", "Geräte", "Termine", "Service", "Tickets", "Schulungen", "Dokumente",
  "Angebote", "Rechnungen", "Kalender", "CAPA", "Risiken", "Audits", "Benutzer",
  "Standorte", "API", "Integrationen", "Berichte",
];

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const filtered = q ? SOURCES.filter(s => s.toLowerCase().includes(q.toLowerCase())) : SOURCES;
  return (
    <>
      <Rc1Header title="Global Search" subtitle="Systemweite Suche über alle Module – nur berechtigte Ergebnisse." />
      <Rc1Card>
        <Input placeholder="Suchen nach Kunden, Aufträgen, Terminen, Tickets, Dokumenten..." value={q} onChange={e => setQ(e.target.value)} className="mb-4" />
        <div className="text-xs text-muted-foreground mb-3">Suchbare Quellen ({filtered.length})</div>
        <div className="flex flex-wrap gap-2">
          {filtered.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
        </div>
      </Rc1Card>
    </>
  );
}
