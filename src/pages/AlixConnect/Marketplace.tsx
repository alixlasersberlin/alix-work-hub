import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Key, Webhook, Plus, Trash2, Copy, Activity } from "lucide-react";

const AVAILABLE_EVENTS = [
  "order.created", "order.updated", "order.status_changed",
  "customer.created", "message.received", "message.sent",
  "call.completed", "ticket.created", "ticket.closed",
];

function randomKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "ak_live_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function Marketplace() {
  const [keys, setKeys] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [subName, setSubName] = useState("");
  const [subUrl, setSubUrl] = useState("");
  const [subEvents, setSubEvents] = useState<string[]>([]);

  async function loadAll() {
    const [k, s, e] = await Promise.all([
      supabase.from("ac_api_keys" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("ac_webhook_subscriptions" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("ac_event_bus" as any).select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setKeys((k.data as any) ?? []); setSubs((s.data as any) ?? []); setEvents((e.data as any) ?? []);
  }
  useEffect(() => { loadAll(); }, []);

  async function createKey() {
    if (!newKeyName) return toast.error("Name erforderlich");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return toast.error("Nicht angemeldet");
    const raw = randomKey();
    const hash = await sha256(raw);
    const { error } = await supabase.from("ac_api_keys" as any).insert({
      user_id: userData.user.id, name: newKeyName, prefix: raw.slice(0, 12), key_hash: hash, scopes: ["read"],
    });
    if (error) return toast.error(error.message);
    setIssuedKey(raw); setNewKeyName(""); loadAll();
  }
  async function revokeKey(id: string) {
    const { error } = await supabase.from("ac_api_keys" as any).update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Widerrufen"); loadAll();
  }
  async function createSub() {
    if (!subName || !subUrl || subEvents.length === 0) return toast.error("Name, URL und mind. 1 Event erforderlich");
    const { data: userData } = await supabase.auth.getUser();
    const secret = "whsec_" + (await sha256(randomKey())).slice(0, 32);
    const { error } = await supabase.from("ac_webhook_subscriptions" as any).insert({
      name: subName, target_url: subUrl, events: subEvents, secret, created_by: userData.user?.id,
    });
    if (error) return toast.error(error.message);
    setSubName(""); setSubUrl(""); setSubEvents([]);
    toast.success("Webhook erstellt"); loadAll();
  }
  async function toggleSub(id: string, active: boolean) {
    await supabase.from("ac_webhook_subscriptions" as any).update({ is_active: active }).eq("id", id);
    loadAll();
  }
  async function delSub(id: string) {
    await supabase.from("ac_webhook_subscriptions" as any).delete().eq("id", id);
    toast.success("Gelöscht"); loadAll();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Webhook className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-semibold">Marketplace & Integrationen</h2>
          <p className="text-sm text-muted-foreground">Zapier/Make-Webhooks, Public REST-API, Event-Bus.</p>
        </div>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys"><Key className="h-4 w-4 mr-2" />API-Keys</TabsTrigger>
          <TabsTrigger value="hooks"><Webhook className="h-4 w-4 mr-2" />Webhooks</TabsTrigger>
          <TabsTrigger value="events"><Activity className="h-4 w-4 mr-2" />Event-Log</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Neuen API-Key erstellen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Name (z.B. Zapier Integration)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
                <Button onClick={createKey}><Plus className="h-4 w-4 mr-2" />Erstellen</Button>
              </div>
              {issuedKey && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-xs text-amber-500 mb-2 font-medium">Wird nur EINMAL angezeigt – jetzt kopieren!</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background/50 rounded px-2 py-1.5 break-all">{issuedKey}</code>
                    <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(issuedKey); toast.success("Kopiert"); }}><Copy className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setIssuedKey(null)}>OK</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Aktive Keys ({keys.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {keys.length === 0 ? <p className="text-sm text-muted-foreground">Keine Keys.</p> :
                keys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between rounded-md border border-border/50 p-3">
                    <div>
                      <div className="text-sm font-medium">{k.name} {k.revoked_at && <Badge variant="destructive" className="ml-2">Widerrufen</Badge>}</div>
                      <div className="text-xs text-muted-foreground font-mono">{k.prefix}… · {new Date(k.created_at).toLocaleDateString("de-DE")}</div>
                    </div>
                    {!k.revoked_at && <Button size="sm" variant="outline" onClick={() => revokeKey(k.id)}>Widerrufen</Button>}
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hooks" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Webhook hinzufügen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Name" value={subName} onChange={(e) => setSubName(e.target.value)} />
              <Input placeholder="https://hooks.zapier.com/…" value={subUrl} onChange={(e) => setSubUrl(e.target.value)} />
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_EVENTS.map((ev) => {
                  const active = subEvents.includes(ev);
                  return (
                    <button key={ev} type="button" onClick={() => setSubEvents((cur) => active ? cur.filter((x) => x !== ev) : [...cur, ev])}
                      className={`text-xs rounded-full border px-2.5 py-1 ${active ? "border-primary bg-primary/15 text-primary" : "border-border/60 text-muted-foreground"}`}>
                      {ev}
                    </button>
                  );
                })}
              </div>
              <Button onClick={createSub}><Plus className="h-4 w-4 mr-2" />Erstellen</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Aktive Webhooks ({subs.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {subs.length === 0 ? <p className="text-sm text-muted-foreground">Keine Webhooks.</p> :
                subs.map((s) => (
                  <div key={s.id} className="rounded-md border border-border/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-2">{s.name} {s.is_active ? <Badge>Aktiv</Badge> : <Badge variant="secondary">Pausiert</Badge>}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.target_url}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1">{s.events.map((e: string) => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}</div>
                        {s.last_error && <div className="mt-1 text-xs text-destructive">Letzter Fehler: {s.last_error}</div>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => toggleSub(s.id, !s.is_active)}>{s.is_active ? "Pausieren" : "Aktivieren"}</Button>
                        <Button size="icon" variant="ghost" onClick={() => delSub(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="pt-4">
          <Card>
            <CardHeader><CardTitle>Letzte Events ({events.length})</CardTitle></CardHeader>
            <CardContent>
              {events.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Events dispatched.</p> :
                <div className="space-y-1.5">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2 text-xs">
                      <Badge variant={e.status === "delivered" ? "default" : e.status === "failed" ? "destructive" : "secondary"}>{e.status}</Badge>
                      <span className="font-mono">{e.event_type}</span>
                      <span className="text-muted-foreground">Attempts: {e.attempts}</span>
                      {e.last_response_code && <span className="text-muted-foreground">HTTP {e.last_response_code}</span>}
                      <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleString("de-DE")}</span>
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
