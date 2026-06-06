import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageSquare, Search, Send, Paperclip, Link2, UserPlus, Wrench, Ban, Archive, RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Conversation = {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  linked_customer_id: string | null;
  linked_ticket_id: string | null;
  status: string;
  assigned_department: string;
  unread_count: number;
  opt_out: boolean;
  last_message_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  sender_name: string | null;
  message_text: string | null;
  media_url: string | null;
  media_type: string | null;
  status: string;
  created_at: string;
};

type Template = { id: string; key: string; title: string; body: string };

export default function WhatsAppServiceCenter() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [text, setText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState<any | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [linkTicketNr, setLinkTicketNr] = useState("");

  const selected = useMemo(
    () => conversations.find(c => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const loadConversations = async () => {
    let q = supabase.from("whatsapp_sc_conversations" as any)
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (deptFilter !== "all") q = q.eq("assigned_department", deptFilter);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setConversations((data ?? []) as any);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase.from("whatsapp_sc_messages" as any)
      .select("*").eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as any);
    // mark read
    await supabase.from("whatsapp_sc_conversations" as any)
      .update({ unread_count: 0 }).eq("id", convId);
  };

  const loadTemplates = async () => {
    const { data } = await supabase.from("whatsapp_sc_templates" as any)
      .select("*").eq("active", true).order("title");
    setTemplates((data ?? []) as any);
  };

  const loadTicket = async (ticketId: string | null) => {
    if (!ticketId) { setTicket(null); return; }
    const { data } = await supabase.from("tickets")
      .select("id,title,status,priority,department,customer_name,serial_number,device_name,order_number,external_ticket_id")
      .eq("id", ticketId).maybeSingle();
    setTicket(data);
  };

  useEffect(() => { loadConversations(); loadTemplates(); }, [deptFilter]);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    loadTicket(selected?.linked_ticket_id ?? null);

    const channel = supabase
      .channel(`wa-msg-${selectedId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "whatsapp_sc_messages",
        filter: `conversation_id=eq.${selectedId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, selected?.linked_ticket_id]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return conversations;
    return conversations.filter(c =>
      (c.customer_name ?? "").toLowerCase().includes(s) ||
      c.customer_phone.toLowerCase().includes(s)
    );
  }, [conversations, search]);

  const send = async () => {
    if (!selected || !text.trim()) return;
    if (selected.opt_out) { toast.error("Opt-out aktiv"); return; }
    setSending(true);
    const { error } = await supabase.functions.invoke("whatsapp-send", {
      body: { conversation_id: selected.id, text },
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    toast.success("Gesendet");
  };

  const sendTemplate = async (tplKey: string) => {
    if (!selected) return;
    if (selected.opt_out) { toast.error("Opt-out aktiv"); return; }
    const { error } = await supabase.functions.invoke("whatsapp-send", {
      body: { conversation_id: selected.id, template_key: tplKey },
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Vorlage gesendet");
  };

  const saveInternalNote = async () => {
    if (!selected?.linked_ticket_id || !internalNote.trim()) {
      toast.error("Kein verknüpftes Ticket oder leere Notiz");
      return;
    }
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: selected.linked_ticket_id,
      sender_type: "agent",
      sender_name: "Intern",
      message: internalNote,
      is_internal: true,
    });
    if (error) { toast.error(error.message); return; }
    setInternalNote("");
    toast.success("Interne Notiz gespeichert (nicht an Kunden gesendet)");
  };

  const createTicket = async () => {
    if (!selected) return;
    const { data, error } = await supabase.from("tickets").insert({
      title: `WhatsApp: ${selected.customer_name ?? selected.customer_phone}`,
      status: "Neu", priority: "Normal", department: "service",
      source_system: "whatsapp",
      customer_phone: selected.customer_phone,
      customer_name: selected.customer_name,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("whatsapp_sc_conversations" as any)
      .update({ linked_ticket_id: data.id }).eq("id", selected.id);
    toast.success("Ticket erstellt");
    loadConversations();
    loadTicket(data.id);
  };

  const linkExistingTicket = async () => {
    if (!selected || !linkTicketNr.trim()) return;
    const { data } = await supabase.from("tickets")
      .select("id").or(`external_ticket_id.eq.${linkTicketNr},id.eq.${linkTicketNr}`)
      .maybeSingle();
    if (!data) { toast.error("Ticket nicht gefunden"); return; }
    await supabase.from("whatsapp_sc_conversations" as any)
      .update({ linked_ticket_id: data.id }).eq("id", selected.id);
    toast.success("Verknüpft");
    setLinkTicketNr("");
    loadConversations();
    loadTicket(data.id);
  };

  const handoverToTech = async () => {
    if (!selected) return;
    await supabase.from("whatsapp_sc_conversations" as any)
      .update({ assigned_department: "technik" }).eq("id", selected.id);
    if (selected.linked_ticket_id) {
      await supabase.from("tickets").update({ department: "technik" })
        .eq("id", selected.linked_ticket_id);
    }
    toast.success("An Technik übergeben");
    loadConversations();
  };

  const toggleOptOut = async () => {
    if (!selected) return;
    await supabase.from("whatsapp_sc_conversations" as any)
      .update({ opt_out: !selected.opt_out }).eq("id", selected.id);
    toast.success(selected.opt_out ? "Opt-out aufgehoben" : "Opt-out gesetzt");
    loadConversations();
  };

  const archive = async () => {
    if (!selected) return;
    await supabase.from("whatsapp_sc_conversations" as any)
      .update({ status: "archived" }).eq("id", selected.id);
    toast.success("Archiviert");
    loadConversations();
  };

  const searchCustomers = async (q: string) => {
    setCustomerSearch(q);
    if (q.length < 2) { setCustomerResults([]); return; }
    const { data } = await supabase.from("customers")
      .select("id,company_name,contact_name,phone,email")
      .or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(20);
    setCustomerResults(data ?? []);
  };

  const assignCustomer = async (cid: string) => {
    if (!selected) return;
    await supabase.from("whatsapp_sc_conversations" as any)
      .update({ linked_customer_id: cid }).eq("id", selected.id);
    toast.success("Kunde zugeordnet");
    setCustomerSearch(""); setCustomerResults([]);
    loadConversations();
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" /> WhatsApp Service Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Eingehende WhatsApp-Nachrichten als Tickets verwalten
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConversations}>
          <RefreshCw className="h-4 w-4 mr-1" /> Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-4 flex-1 min-h-0">
        {/* Conversation list */}
        <Card className="flex flex-col min-h-0">
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8" placeholder="Suchen…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Abteilungen</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="technik">Technik</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="tourenplanung">Tourenplanung</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Keine Gespräche
              </div>
            )}
            {filtered.map(c => (
              <button
                key={c.id} onClick={() => setSelectedId(c.id)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition ${
                  selectedId === c.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">
                    {c.customer_name ?? c.customer_phone}
                  </span>
                  {c.unread_count > 0 && (
                    <Badge variant="default" className="ml-2">{c.unread_count}</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                  <span>{c.customer_phone}</span>
                  {c.opt_out && <Badge variant="destructive" className="h-4 text-[10px]">Opt-out</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: de })}
                </div>
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Chat panel */}
        <Card className="flex flex-col min-h-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Wähle ein Gespräch
            </div>
          ) : (
            <>
              <div className="p-3 border-b flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold">{selected.customer_name ?? selected.customer_phone}</div>
                  <div className="text-xs text-muted-foreground">{selected.customer_phone}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {!selected.linked_ticket_id && (
                    <Button size="sm" variant="outline" onClick={createTicket}>
                      <Wrench className="h-4 w-4 mr-1" /> Ticket erstellen
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Link2 className="h-4 w-4 mr-1" />Ticket verknüpfen</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Bestehendes Ticket verknüpfen</DialogTitle></DialogHeader>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ticket-ID oder ext. Ticket-Nr."
                          value={linkTicketNr} onChange={e => setLinkTicketNr(e.target.value)}
                        />
                        <Button onClick={linkExistingTicket}>Verknüpfen</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-1" />Kunde zuordnen</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Kunde zuordnen</DialogTitle></DialogHeader>
                      <Input
                        placeholder="Name, Firma oder Telefon…"
                        value={customerSearch}
                        onChange={e => searchCustomers(e.target.value)}
                      />
                      <div className="max-h-80 overflow-auto space-y-1 mt-2">
                        {customerResults.map(c => (
                          <button
                            key={c.id} onClick={() => assignCustomer(c.id)}
                            className="w-full text-left p-2 border rounded hover:bg-muted/50"
                          >
                            <div className="font-medium">{c.company_name ?? c.contact_name}</div>
                            <div className="text-xs text-muted-foreground">{c.phone} · {c.email}</div>
                          </button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="outline" onClick={handoverToTech}>
                    <Wrench className="h-4 w-4 mr-1" /> An Technik
                  </Button>
                  <Button size="sm" variant="outline" onClick={toggleOptOut}>
                    <Ban className="h-4 w-4 mr-1" /> {selected.opt_out ? "Opt-out aus" : "Opt-out"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={archive}>
                    <Archive className="h-4 w-4 mr-1" /> Archiv
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {messages.map(m => (
                    <div key={m.id}
                      className={`max-w-[75%] rounded-lg p-2 px-3 text-sm ${
                        m.direction === "out"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                      {m.message_text && <div className="whitespace-pre-wrap">{m.message_text}</div>}
                      {m.media_url && (
                        <a href={m.media_url} target="_blank" rel="noreferrer"
                          className="block text-xs underline mt-1">
                          <Paperclip className="inline h-3 w-3 mr-1" />
                          {m.media_type ?? "Anhang"} öffnen
                        </a>
                      )}
                      <div className="text-[10px] opacity-70 mt-1">
                        {new Date(m.created_at).toLocaleString("de-DE")}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Noch keine Nachrichten
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t p-3 space-y-2">
                {templates.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {templates.map(t => (
                      <Button
                        key={t.id} size="sm" variant="secondary"
                        onClick={() => setText(t.body)}
                        title={t.body}
                      >
                        {t.title}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Antwort an Kunden (wird per WhatsApp gesendet)…"
                    value={text} onChange={e => setText(e.target.value)}
                    rows={2} className="flex-1"
                  />
                  <Button onClick={send} disabled={sending || !text.trim() || selected.opt_out}>
                    <Send className="h-4 w-4 mr-1" /> Senden
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Interne Notiz (nicht an Kunden) …"
                    value={internalNote} onChange={e => setInternalNote(e.target.value)}
                    rows={1} className="flex-1"
                  />
                  <Button variant="outline" onClick={saveInternalNote}
                    disabled={!internalNote.trim() || !selected.linked_ticket_id}>
                    Notiz speichern
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* Sidebar: Ticket + Customer info */}
        <Card className="p-4 space-y-3 overflow-auto">
          <div className="font-semibold">Verknüpftes Ticket</div>
          {ticket ? (
            <div className="space-y-1 text-sm">
              <div className="font-medium">{ticket.title}</div>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline">{ticket.status}</Badge>
                <Badge variant="outline">{ticket.priority}</Badge>
                <Badge variant="outline">{ticket.department}</Badge>
              </div>
              {ticket.serial_number && (
                <div><span className="text-muted-foreground">SN:</span> {ticket.serial_number}</div>
              )}
              {ticket.device_name && (
                <div><span className="text-muted-foreground">Gerät:</span> {ticket.device_name}</div>
              )}
              {ticket.order_number && (
                <div><span className="text-muted-foreground">Auftrag:</span> {ticket.order_number}</div>
              )}
              <Button size="sm" variant="link" className="px-0"
                onClick={() => window.open(`/tickets/${ticket.id}`, "_blank")}>
                Ticket öffnen →
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Kein Ticket verknüpft</div>
          )}
          <div className="font-semibold pt-3">Hinweise</div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Antworten gehen serverseitig über WhatsApp Cloud API.</li>
            <li>Interne Notizen werden niemals an den Kunden gesendet.</li>
            <li>Opt-out blockiert jeden ausgehenden Versand.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
