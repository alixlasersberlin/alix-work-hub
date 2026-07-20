import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Mail, MessageCircle, Phone, Send, Globe as GlobeIcon, MessageSquare, WifiOff, Clock, RefreshCw, Trash2, Sparkles, Loader2 } from "lucide-react";
import { enqueue as enqueueOutbox, flush as flushOutbox, remove as removeOutbox, retryNow as retryOutbox } from "@/lib/connect/offline-outbox";
import { useAcOutbox } from "@/hooks/useAcOutbox";
import { VoiceDictateButton } from "@/components/connect/VoiceDictateButton";

type Conversation = {
  id: string;
  subject: string | null;
  channel_type: string;
  status: string;
  priority: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  assigned_to: string | null;
  customer_id: string | null;
  contact_id: string | null;
  ai_summary: string | null;
  ai_sentiment: string | null;
};

type Message = {
  id: string;
  body: string | null;
  direction: string;
  sender_type: string;
  sender_name: string | null;
  is_internal_note: boolean;
  created_at: string;
};

const iconFor = (t: string) => {
  switch (t) {
    case "email": return Mail;
    case "whatsapp": return MessageCircle;
    case "sms": return MessageSquare;
    case "voice": return Phone;
    case "website": return GlobeIcon;
    default: return MessageCircle;
  }
};

export default function InboxPage() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [filter, setFilter] = useState<"open" | "pending" | "resolved" | "all">("open");
  const [me, setMe] = useState<string | null>(null);
  const { items: outboxItems, online } = useAcOutbox();

  async function generateDraft() {
    if (!activeId || drafting) return;
    setDrafting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ac-draft-reply", {
        body: { conversation_id: activeId, hint: reply.trim() || undefined },
      });
      if (error) throw error;
      const d = (data as any)?.draft as string | undefined;
      if (!d) throw new Error((data as any)?.error || "Leere Antwort");
      setReply(d);
      toast.success("Entwurf eingefügt — bitte prüfen");
    } catch (e: any) {
      toast.error(e?.message || "Entwurf fehlgeschlagen");
    } finally {
      setDrafting(false);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("ac_conversations")
        .select("id, subject, channel_type, status, priority, last_message_at, last_message_preview, unread_count, assigned_to, customer_id, contact_id, ai_summary, ai_sentiment")
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) toast.error("Konversationen konnten nicht geladen werden");
      else setConvs((data as any) || []);
    })();

    const ch = supabase
      .channel("ac-inbox-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "ac_conversations" }, () => {
        // refetch lightweight
        supabase
          .from("ac_conversations")
          .select("id, subject, channel_type, status, priority, last_message_at, last_message_preview, unread_count, assigned_to, customer_id, contact_id, ai_summary, ai_sentiment")
          .order("last_message_at", { ascending: false })
          .limit(100)
          .then(({ data }) => data && setConvs(data as any));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [filter]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("ac_messages")
        .select("id, body, direction, sender_type, sender_name, is_internal_note, created_at")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) setMessages((data as any) || []);
    })();

    const ch = supabase
      .channel(`ac-inbox-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ac_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => setMessages((m) => [...m, payload.new as Message]),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  const active = useMemo(() => convs.find((c) => c.id === activeId), [convs, activeId]);

  async function sendReply() {
    if (!reply.trim() || !activeId || !me) return;
    const text = reply.trim();
    setReply("");

    // Offline → sofort in Outbox
    if (!navigator.onLine) {
      await enqueueOutbox({ conversation_id: activeId, body: text, internal_note: internal });
      toast.info("Offline – Antwort in Warteschlange gespeichert");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("ac-send-message", {
        body: { conversation_id: activeId, body: text, internal_note: internal },
      });
      if (error) throw error;
      if (data && (data as any).ok === false) {
        throw new Error((data as any).error ?? "unbekannt");
      }
    } catch (err: any) {
      // Netzwerkfehler → in Outbox parken
      await enqueueOutbox({ conversation_id: activeId, body: text, internal_note: internal });
      toast.warning("Versand fehlgeschlagen – in Outbox gespeichert (" + (err?.message || "Fehler") + ")");
    }
  }

  async function setStatus(status: "open" | "pending" | "resolved" | "closed" | "snoozed") {
    if (!activeId) return;
    const { error } = await supabase
      .from("ac_conversations")
      .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
      .eq("id", activeId);
    if (error) toast.error(error.message);
    else toast.success(`Status: ${status}`);
  }

  return (
    <div className="flex h-full">
      <aside className="w-80 border-r border-border/60 flex flex-col">
        <div className="p-3 border-b border-border/60 flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Offen</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="resolved">Gelöst</SelectItem>
              <SelectItem value="all">Alle</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="flex-1">
          {convs.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              Keine Konversationen. Externe Kanäle (Website, WhatsApp, Email) landen hier — kommt in Phase 2/3.
            </div>
          )}
          {convs.map((c) => {
            const Icon = iconFor(c.channel_type);
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "w-full text-left border-b border-border/40 p-3 hover:bg-muted/50",
                  activeId === c.id && "bg-muted",
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate flex-1">{c.subject || "(kein Betreff)"}</span>
                  {c.unread_count > 0 && <Badge className="h-4 px-1 text-[10px]">{c.unread_count}</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.last_message_preview || "…"}</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="h-4 px-1">{c.status}</Badge>
                  <span>{new Date(c.last_message_at).toLocaleString("de-DE")}</span>
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </aside>

      <section className="flex-1 flex flex-col">
        {active ? (
          <>
            <header className="border-b border-border/60 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold flex items-center gap-2">
                  {active.subject || "Konversation"}
                  {!online && (
                    <Badge variant="destructive" className="gap-1 text-[10px]"><WifiOff className="h-3 w-3" /> Offline</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{active.channel_type} · Priorität: {active.priority}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStatus("pending")}>Ausstehend</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("resolved")}>Gelöst</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("closed")}>Schließen</Button>
              </div>
            </header>
            {(() => {
              const convOutbox = outboxItems.filter((o) => o.conversation_id === active.id);
              if (convOutbox.length === 0) return null;
              return (
                <div className="border-b border-amber-500/40 bg-amber-500/5 px-4 py-2 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> {convOutbox.length} Antwort(en) in Warteschlange
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => flushOutbox().then((r) => toast.success(`Sync: ${r.ok} versendet, ${r.failed} fehlgeschlagen`))}>
                      <RefreshCw className="h-3 w-3" /> Jetzt senden
                    </Button>
                  </div>
                  {convOutbox.map((o) => (
                    <div key={o.id} className="flex items-start gap-2 rounded border border-amber-500/30 bg-background/60 p-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="line-clamp-2 whitespace-pre-wrap">{o.body}</div>
                        {o.last_error && <div className="mt-0.5 text-[10px] text-destructive">Fehler: {o.last_error} (Versuch {o.attempts})</div>}
                      </div>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Erneut versuchen" onClick={() => o.id && retryOutbox(o.id).then(() => flushOutbox())}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" title="Verwerfen" onClick={() => o.id && removeOutbox(o.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded-lg p-3 max-w-[80%]",
                    m.direction === "outbound" && !m.is_internal_note && "ml-auto bg-primary/10",
                    m.direction === "inbound" && "bg-muted",
                    m.is_internal_note && "border border-amber-500/40 bg-amber-500/5",
                  )}
                >
                  <div className="text-[10px] text-muted-foreground mb-1">
                    {m.sender_name || m.sender_type} · {new Date(m.created_at).toLocaleString("de-DE")}
                    {m.is_internal_note && <Badge className="ml-2 h-4 px-1 text-[9px]" variant="outline">Interne Notiz</Badge>}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
              {messages.length === 0 && <div className="text-center text-sm text-muted-foreground py-10">Noch keine Nachrichten.</div>}
            </div>
            <div className="border-t border-border/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  Interne Notiz (nicht an Kunden sichtbar)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={generateDraft}
                  disabled={drafting || !activeId}
                  title="KI-Entwurf aus Konversationsverlauf (Gemini)"
                >
                  {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  KI-Entwurf
                </Button>
              </div>
              <div className="flex gap-2">
                <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Antwort verfassen, diktieren oder KI-Entwurf nutzen…" className="min-h-[60px]" />
                <div className="flex flex-col gap-2">
                  <VoiceDictateButton
                    onTranscript={(t) => setReply((cur) => (cur ? `${cur.trim()} ${t}` : t))}
                  />
                  <Button onClick={sendReply} disabled={!reply.trim()} size="icon" className="h-9 w-9">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Wähle eine Konversation aus der Liste.
          </div>
        )}
      </section>
    </div>
  );
}
