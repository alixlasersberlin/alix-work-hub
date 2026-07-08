import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { eig } from "@/lib/eig/store";

export default function EventBus() {
  const [events, setEvents] = useState(() => eig.list("events"));
  const [history, setHistory] = useState(() => eig.events.list());
  const [name, setName] = useState("");
  const [q, setQ] = useState("");

  const add = () => {
    if (!name.trim()) return;
    eig.upsert("events", { name: name.trim(), module: name.split(".")[0] || "custom", active: true });
    setEvents(eig.list("events")); setName("");
  };
  const emit = (ev: string, mod: string) => {
    eig.events.emit({ event: ev, module: mod, status: "delivered", latencyMs: 40 + Math.floor(Math.random() * 160) });
    setHistory(eig.events.list());
  };

  const filtered = history.filter(h => !q.trim() || JSON.stringify(h).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold bg-gradient-to-r from-amber-200 to-yellow-500 bg-clip-text text-transparent">Event Bus</h1>
        <p className="text-sm text-muted-foreground mt-1">Standard-Events und individuelle Ereignisse · Historie · Antwortzeiten</p>
      </div>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader><CardTitle className="text-sm">Registrierte Events</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input placeholder="z. B. invoice.paid" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={add}>Hinzufügen</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {events.map(e => (
              <div key={e.id} className="flex items-center gap-2 rounded-md border border-border/50 px-2 py-1 text-xs">
                <span>{e.name}</span>
                <Button size="sm" variant="ghost" onClick={() => emit(e.name, e.module)}>Emit</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/40 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Enterprise Event Historie</CardTitle>
          <Input placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-2">Zeit</th><th className="text-left px-4 py-2">Event</th><th className="text-left px-4 py-2">Modul</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Latenz</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(e => (
                <tr key={e.id} className="border-b border-border/30">
                  <td className="px-4 py-2 text-muted-foreground">{new Date(e.ts).toLocaleString()}</td>
                  <td className="px-4 py-2">{e.event}</td>
                  <td className="px-4 py-2">{e.module}</td>
                  <td className="px-4 py-2"><Badge variant={e.status === "delivered" ? "default" : e.status === "failed" ? "destructive" : "secondary"}>{e.status}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{e.latencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
