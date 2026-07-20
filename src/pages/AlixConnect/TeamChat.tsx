import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Hash, Lock, Plus, Send, Star, Users2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Channel = {
  id: string;
  name: string;
  type: string;
  is_private: boolean;
  description: string | null;
};

type Message = {
  id: string;
  body: string | null;
  sender_user_id: string | null;
  sender_name: string | null;
  created_at: string;
  is_internal_note: boolean;
};

export default function TeamChat() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [myName, setMyName] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id ?? null);
      if (u.user?.id) {
        const { data: p } = await supabase.from("user_profiles").select("full_name").eq("id", u.user.id).maybeSingle();
        setMyName(p?.full_name || u.user.email || "Unbekannt");
      }
      await loadChannels();
    })();
  }, []);

  async function loadChannels() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ac_channels")
      .select("id, name, type, is_private, description")
      .in("type", ["team", "department"])
      .eq("is_archived", false)
      .order("name");
    if (error) {
      toast.error("Kanäle konnten nicht geladen werden");
    } else {
      setChannels(data as any);
      if (!activeId && data && data.length > 0) setActiveId(data[0].id);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ac_messages")
        .select("id, body, sender_user_id, sender_name, created_at, is_internal_note")
        .eq("channel_id", activeId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) {
        if (error) toast.error("Nachrichten laden fehlgeschlagen");
        else setMessages((data as any) || []);
      }
    })();

    const channel = supabase
      .channel(`ac-team-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ac_messages", filter: `channel_id=eq.${activeId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    if (!body.trim() || !activeId || !me) return;
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("ac_messages").insert({
      channel_id: activeId,
      body: text,
      sender_user_id: me,
      sender_name: myName,
      direction: "internal",
      sender_type: "user",
    });
    if (error) {
      toast.error("Nachricht konnte nicht gesendet werden");
      setBody(text);
    }
  }

  async function createChannel() {
    if (!newName.trim() || !me) return;
    const { data, error } = await supabase
      .from("ac_channels")
      .insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        is_private: newPrivate,
        type: "team",
        created_by: me,
      })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message || "Kanal konnte nicht angelegt werden");
      return;
    }
    await supabase.from("ac_channel_members").insert({ channel_id: data.id, user_id: me, role: "admin" });
    setNewName("");
    setNewDesc("");
    setNewPrivate(false);
    setCreateOpen(false);
    toast.success("Kanal erstellt");
    await loadChannels();
    setActiveId(data.id);
  }

  const active = useMemo(() => channels.find((c) => c.id === activeId), [channels, activeId]);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/60 bg-card/30 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kanäle</span>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neuer Kanal</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Kanalname (z.B. vertrieb)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Textarea placeholder="Beschreibung (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} />
                  Privater Kanal (nur eingeladene Mitglieder)
                </label>
              </div>
              <DialogFooter>
                <Button onClick={createChannel}>Erstellen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 text-xs text-muted-foreground">lade…</div>
          ) : channels.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Noch keine Kanäle. Lege deinen ersten Kanal an.</div>
          ) : (
            <ul className="p-1">
              {channels.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm text-left hover:bg-muted",
                      activeId === c.id && "bg-muted font-medium",
                    )}
                  >
                    {c.is_private ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Hash className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="truncate">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Chat area */}
      <section className="flex-1 flex flex-col">
        {active ? (
          <>
            <header className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {active.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                <span className="font-semibold">{active.name}</span>
                {active.description && <span className="text-xs text-muted-foreground">— {active.description}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline"><Users2 className="h-3 w-3 mr-1" /> Team</Badge>
              </div>
            </header>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-10">
                  Noch keine Nachrichten. Sag Hallo 👋
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
                    {(m.sender_name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{m.sender_name || "Unbekannt"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border/60 p-3">
              <div className="flex gap-2">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder={`Nachricht an #${active.name}`}
                  className="min-h-[44px] max-h-32"
                />
                <Button onClick={send} disabled={!body.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Enter senden · Shift+Enter Zeilenumbruch</p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Wähle einen Kanal oder erstelle einen neuen.
          </div>
        )}
      </section>
    </div>
  );
}
