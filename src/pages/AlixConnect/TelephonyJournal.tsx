import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, Link2, Tag as TagIcon, User, FileText, Ticket } from "lucide-react";

type Call = any;

export default function TelephonyJournal() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Call | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("ac_calls")
      .select("*, contact:ac_contacts(id,full_name,phone,email), customer:customers(id,customer_name,customer_number), ticket:tickets(id,title,ticket_number)")
      .order("started_at", { ascending: false }).limit(200);
    if (q.trim()) query = query.or(`from_number.ilike.%${q}%,to_number.ilike.%${q}%,notes.ilike.%${q}%`);
    const { data } = await query;
    setCalls((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const iconFor = (c: Call) => {
    if (c.status === "missed" || c.status === "no_answer") return <PhoneMissed className="h-4 w-4 text-destructive" />;
    if (c.direction === "inbound") return <PhoneIncoming className="h-4 w-4 text-primary" />;
    if (c.direction === "outbound") return <PhoneOutgoing className="h-4 w-4 text-primary" />;
    return <PhoneCall className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Anruf-Journal (CRM)</h1>
          <p className="text-muted-foreground">Jeder Anruf mit Kunde, Auftrag, Ticket, Notizen und Tags verknüpft.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Input placeholder="Nummer, Notiz…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="max-w-sm" />
        <Button onClick={load}><Search className="mr-2 h-4 w-4" />Suchen</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Letzte Anrufe</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-muted-foreground">Lade…</p>}
          {!loading && calls.length === 0 && <p className="text-muted-foreground">Keine Anrufe.</p>}
          {calls.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/40 cursor-pointer" onClick={() => setSelected(c)}>
              {iconFor(c)}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium truncate">{c.contact?.full_name || c.from_number || c.to_number || "Unbekannt"}</span>
                  <Badge variant="outline">{c.direction}</Badge>
                  <Badge variant={c.status === "missed" ? "destructive" : "secondary"}>{c.status}</Badge>
                  {c.customer && <Badge className="gap-1"><User className="h-3 w-3" />{c.customer.customer_number}</Badge>}
                  {c.order_id && <Badge className="gap-1" variant="secondary"><FileText className="h-3 w-3" />Auftrag</Badge>}
                  {c.ticket && <Badge className="gap-1" variant="secondary"><Ticket className="h-3 w-3" />#{c.ticket.ticket_number}</Badge>}
                  {(c.tags || []).map((t: string) => <Badge key={t} variant="outline" className="gap-1"><TagIcon className="h-3 w-3" />{t}</Badge>)}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Date(c.started_at).toLocaleString("de-DE")} · {c.duration_seconds || 0}s · {c.from_number} → {c.to_number}
                </div>
                {c.notes && <div className="text-xs truncate">{c.notes}</div>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {selected && <CallDetail call={selected} onClose={() => { setSelected(null); load(); }} />}
    </div>
  );
}

function CallDetail({ call, onClose }: { call: any; onClose: () => void }) {
  const [notes, setNotes] = useState(call.notes || "");
  const [tags, setTags] = useState<string>((call.tags || []).join(", "));
  const [customerQ, setCustomerQ] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [orderNo, setOrderNo] = useState("");
  const [ticketNo, setTicketNo] = useState("");
  const [saving, setSaving] = useState(false);

  const searchCustomer = async () => {
    if (!customerQ.trim()) return;
    const { data } = await supabase.from("customers")
      .select("id,customer_name,customer_number,email")
      .or(`customer_name.ilike.%${customerQ}%,customer_number.ilike.%${customerQ}%,email.ilike.%${customerQ}%`)
      .limit(10);
    setCustomerResults(data || []);
  };

  const linkCustomer = async (id: string) => {
    const { error } = await supabase.from("ac_calls").update({ customer_id: id }).eq("id", call.id);
    if (error) return toast.error(error.message);
    toast.success("Kunde verknüpft");
    call.customer_id = id;
  };

  const linkOrder = async () => {
    if (!orderNo.trim()) return;
    const { data: o } = await supabase.from("orders").select("id").eq("order_number", orderNo.trim()).maybeSingle();
    if (!o) return toast.error("Auftrag nicht gefunden");
    const { error } = await supabase.from("ac_calls").update({ order_id: o.id }).eq("id", call.id);
    if (error) return toast.error(error.message);
    toast.success("Auftrag verknüpft");
  };

  const linkTicket = async () => {
    if (!ticketNo.trim()) return;
    const { data: t } = await supabase.from("tickets").select("id").eq("ticket_number", ticketNo.trim()).maybeSingle();
    if (!t) return toast.error("Ticket nicht gefunden");
    const { error } = await supabase.from("ac_calls").update({ ticket_id: t.id }).eq("id", call.id);
    if (error) return toast.error(error.message);
    toast.success("Ticket verknüpft");
  };

  const save = async () => {
    setSaving(true);
    const tagArr = tags.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("ac_calls").update({ notes, tags: tagArr }).eq("id", call.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Gespeichert");
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><PhoneCall className="h-5 w-5" /> Anrufdetails</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border p-3 text-sm">
            <div><b>Zeit:</b> {new Date(call.started_at).toLocaleString("de-DE")}</div>
            <div><b>Von → Nach:</b> {call.from_number} → {call.to_number}</div>
            <div><b>Dauer:</b> {call.duration_seconds || 0}s · <b>Status:</b> {call.status}</div>
            {call.voicemail_transcript && <div className="mt-2 rounded bg-muted p-2 text-xs"><b>Voicemail:</b> {call.voicemail_transcript}</div>}
          </div>

          <div>
            <label className="text-sm font-medium">Notizen</label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1"><TagIcon className="h-3 w-3" /> Tags (komma-getrennt)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="rückruf, reklamation, VIP" />
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="font-medium flex items-center gap-1"><Link2 className="h-4 w-4" /> Verknüpfen</div>
            <div className="flex gap-2">
              <Input placeholder="Kundenname/-nummer…" value={customerQ} onChange={(e) => setCustomerQ(e.target.value)} />
              <Button size="sm" onClick={searchCustomer}>Suchen</Button>
            </div>
            {customerResults.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-auto">
                {customerResults.map(c => (
                  <button key={c.id} onClick={() => linkCustomer(c.id)} className="w-full rounded border p-2 text-left text-sm hover:bg-accent">
                    <b>{c.customer_number}</b> — {c.customer_name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input placeholder="Auftragsnummer…" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
              <Button size="sm" onClick={linkOrder}>Auftrag verknüpfen</Button>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Ticket-Nummer…" value={ticketNo} onChange={(e) => setTicketNo(e.target.value)} />
              <Button size="sm" onClick={linkTicket}>Ticket verknüpfen</Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Speichere…" : "Speichern"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
