import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PhoneNoteDialog({
  ticketId,
  actorName,
  onSaved,
}: {
  ticketId: string;
  actorName: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"inbound" | "outbound">("outbound");
  const [durationMin, setDurationMin] = useState<number>(5);
  const [reached, setReached] = useState<"reached" | "not_reached" | "voicemail">("reached");
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!summary.trim()) return toast.error("Bitte Zusammenfassung eingeben.");
    setBusy(true);
    try {
      const dirLabel = direction === "inbound" ? "Eingehend" : "Ausgehend";
      const reachLabel = reached === "reached" ? "Erreicht" : reached === "voicemail" ? "Mailbox" : "Nicht erreicht";
      const message = [
        `📞 Telefonat (${dirLabel} · ${reachLabel} · ${durationMin} Min.)`,
        "",
        summary.trim(),
        nextStep.trim() ? `\nNächster Schritt: ${nextStep.trim()}` : "",
      ].filter(Boolean).join("\n");

      const { error } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        sender_type: "phone_note",
        sender_name: actorName || "Mitarbeiter",
        message,
        is_internal: true,
        source_system: "manual",
      });
      if (error) throw error;

      // Historie
      await supabase.from("ticket_history").insert({
        ticket_id: ticketId,
        action: "phone_call_logged",
        actor_label: actorName || "Mitarbeiter",
        meta: { direction, reached, duration_min: durationMin, next_step: nextStep || null },
      });

      // Wenn Kunde nicht erreicht → comm_status setzen
      if (reached === "not_reached") {
        await (supabase.from("tickets") as any).update({
          comm_status: "customer_unreachable",
          comm_status_since: new Date().toISOString(),
        }).eq("id", ticketId);
      }

      toast.success("Telefonnotiz gespeichert.");
      setOpen(false);
      setSummary(""); setNextStep(""); setDurationMin(5); setReached("reached"); setDirection("outbound");
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Phone className="w-4 h-4 mr-1" /> Anruf dokumentieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Telefonat dokumentieren</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Richtung</Label>
              <Select value={direction} onValueChange={v => setDirection(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Ausgehend</SelectItem>
                  <SelectItem value="inbound">Eingehend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ergebnis</Label>
              <Select value={reached} onValueChange={v => setReached(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reached">Erreicht</SelectItem>
                  <SelectItem value="voicemail">Mailbox</SelectItem>
                  <SelectItem value="not_reached">Nicht erreicht</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Dauer (Minuten)</Label>
            <Input type="number" min={0} value={durationMin} onChange={e => setDurationMin(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Zusammenfassung</Label>
            <Textarea rows={4} value={summary} onChange={e => setSummary(e.target.value)} placeholder="Was wurde besprochen?" />
          </div>
          <div>
            <Label>Nächster Schritt (optional)</Label>
            <Input value={nextStep} onChange={e => setNextStep(e.target.value)} placeholder="z. B. Angebot senden bis Freitag" />
          </div>
          <Button onClick={save} disabled={busy} className="w-full">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
            Speichern
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
