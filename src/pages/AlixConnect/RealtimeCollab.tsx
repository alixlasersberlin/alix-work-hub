import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, Radio, Send, Loader2, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Presence = { user_id: string; name: string; at: string };
type NoteEvt = { user_id: string; name: string; text: string; at: string };

export default function RealtimeCollab() {
  const { user } = useAuth();
  const [room, setRoom] = useState("lobby");
  const [joined, setJoined] = useState(false);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [notes, setNotes] = useState<NoteEvt[]>([]);
  const [msg, setMsg] = useState("");
  const [handoverId, setHandoverId] = useState("");
  const [context, setContext] = useState<any>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const chanRef = useRef<any>(null);

  const myName = useMemo(() => user?.email?.split("@")[0] ?? "agent", [user]);

  useEffect(() => {
    if (!joined || !user) return;
    const channel = supabase.channel(`ac-collab:${room}`, {
      config: { presence: { key: user.id } },
    });
    chanRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, Presence[]>;
        const flat = Object.values(state).flat();
        setPresence(flat);
      })
      .on("broadcast", { event: "note" }, (payload) => {
        setNotes((n) => [...n.slice(-49), payload.payload as NoteEvt]);
      })
      .on("broadcast", { event: "handover" }, (payload) => {
        toast.info(`Handover von ${(payload.payload as any).name}: ${(payload.payload as any).summary}`);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, name: myName, at: new Date().toISOString() });
        }
      });

    return () => { supabase.removeChannel(channel); chanRef.current = null; };
  }, [joined, room, user, myName]);

  const sendNote = async () => {
    if (!msg.trim() || !chanRef.current) return;
    const evt: NoteEvt = { user_id: user!.id, name: myName, text: msg.trim(), at: new Date().toISOString() };
    await chanRef.current.send({ type: "broadcast", event: "note", payload: evt });
    setNotes((n) => [...n.slice(-49), evt]);
    setMsg("");
  };

  const loadHandover = async () => {
    setLoadingCtx(true);
    try {
      const body: any = {};
      if (/^[0-9a-f-]{36}$/i.test(handoverId)) body.customer_id = handoverId;
      else body.order_id = handoverId;
      const { data, error } = await supabase.functions.invoke("ac-realtime-collab", {
        body: { action: "handover_context", ...body },
      });
      if (error) throw error;
      setContext(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoadingCtx(false); }
  };

  const broadcastHandover = async () => {
    if (!context || !chanRef.current) return;
    const summary = `${context.customer?.customer_name ?? "Kunde"} · ${context.recent_orders?.length ?? 0} Aufträge · ${context.recent_tickets?.length ?? 0} Tickets`;
    await chanRef.current.send({
      type: "broadcast", event: "handover",
      payload: { name: myName, summary, context },
    });
    toast.success("Handover verteilt");
  };

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Realtime Collaboration</h1>
        <Badge variant="outline">Phase 43</Badge>
      </div>

      {!joined ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Raum betreten</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="lobby" className="max-w-xs" />
            <Button onClick={() => setJoined(true)}><Users className="h-4 w-4 mr-1" />Beitreten</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Anwesend ({presence.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {presence.map((p) => (
                <div key={p.user_id} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  {p.name}
                </div>
              ))}
              {presence.length === 0 && <p className="text-xs text-muted-foreground">Warte auf Teilnehmer…</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Geteilte Notizen · Raum „{room}"</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-72 overflow-auto space-y-2 rounded-md border p-3 bg-muted/30">
                {notes.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Nachrichten.</p>}
                {notes.map((n, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{n.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{new Date(n.at).toLocaleTimeString()}</span>
                    <p className="text-muted-foreground">{n.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Notiz teilen…" onKeyDown={(e) => e.key === "Enter" && sendNote()} />
                <Button onClick={sendNote}><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4" />Live-Handover mit Kontext</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={handoverId} onChange={(e) => setHandoverId(e.target.value)} placeholder="Kunden-ID oder Auftrags-ID" />
                <Button variant="outline" onClick={loadHandover} disabled={!handoverId || loadingCtx}>
                  {loadingCtx ? <Loader2 className="h-4 w-4 animate-spin" /> : "Laden"}
                </Button>
                <Button onClick={broadcastHandover} disabled={!context}><Radio className="h-4 w-4 mr-1" />An Raum senden</Button>
              </div>
              {context && (
                <Textarea readOnly value={JSON.stringify(context, null, 2)} className="font-mono text-xs h-64" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
