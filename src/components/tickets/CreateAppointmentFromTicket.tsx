import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarPlus, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

const KINDS = [
  { v: "anruf",         l: "Anruf" },
  { v: "video",         l: "Video-Termin" },
  { v: "vor_ort",       l: "Vor-Ort-Termin" },
  { v: "reparatur",     l: "Reparaturtermin" },
  { v: "lieferung",     l: "Liefertermin" },
  { v: "aufbau",        l: "Aufbau / Installation" },
  { v: "schulung",      l: "Schulung" },
  { v: "nisv",          l: "NiSV-Nachweis" },
  { v: "review",        l: "Review / Nachgespräch" },
  { v: "frist",         l: "Deadline / Frist" },
  { v: "wiedervorlage", l: "Wiedervorlage" },
  { v: "eskalation",    l: "Eskalation" },
  { v: "kundentermin",  l: "Sonstiger Kundentermin" },
  { v: "rueckruf",      l: "Rückruf" },
];

export function CreateAppointmentFromTicket({ ticketId, ticketNumber }: { ticketId: string; ticketNumber?: string | null }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [kind, setKind] = useState("kundentermin");
  const [requireConfirm, setRequireConfirm] = useState(true);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<{ confirm: string; reschedule: string; cancel: string } | null>(null);

  const create = async () => {
    if (!start) return toast.error("Bitte Startzeit wählen");
    setBusy(true);
    const startIso = new Date(start).toISOString();
    const endIso = new Date(new Date(start).getTime() + durationMin * 60_000).toISOString();
    const { data, error } = await supabase.functions.invoke("ticket-create-appointment", {
      body: {
        ticket_id: ticketId,
        start_at: startIso,
        end_at: endIso,
        event_kind: kind,
        requires_confirmation: requireConfirm,
      },
    });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Fehler");
    setLinks((data as any).links);
    toast.success("Termin erstellt und mit Ticket verknüpft.");
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Link kopiert"); };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setLinks(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus className="w-4 h-4 mr-2" /> Termin aus Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Termin für {ticketNumber ?? "Ticket"} anlegen</DialogTitle>
        </DialogHeader>
        {!links ? (
          <div className="space-y-3">
            <div>
              <Label>Terminart</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map(k => <SelectItem key={k.v} value={k.v}>{k.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start</Label>
              <Input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Dauer (Minuten)</Label>
              <Input type="number" value={durationMin} onChange={e => setDurationMin(Number(e.target.value) || 30)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requireConfirm} onChange={e => setRequireConfirm(e.target.checked)} />
              Kundenbestätigung anfordern
            </label>
            <Button onClick={create} disabled={busy} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarPlus className="w-4 h-4 mr-2" />}
              Termin anlegen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Termin ist im Kalender sichtbar und mit dem Ticket verknüpft. Diese Links kannst du dem Kunden zusenden:
            </p>
            {(["confirm", "reschedule", "cancel"] as const).map(k => (
              <div key={k} className="flex items-center gap-2">
                <Input readOnly value={links[k]} className="text-xs" />
                <Button size="icon" variant="ghost" onClick={() => copy(links[k])}><Copy className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button className="w-full" onClick={() => { setOpen(false); setLinks(null); setStart(""); }}>Fertig</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
