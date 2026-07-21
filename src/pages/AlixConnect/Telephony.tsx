import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, Voicemail, Save, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Call = {
  id: string;
  direction: "inbound" | "outbound";
  status: string;
  from_number: string | null;
  to_number: string | null;
  extension: string | null;
  agent_user_id: string | null;
  contact_id: string | null;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  voicemail_url: string | null;
  voicemail_transcript?: string | null;
  voicemail_transcript_status?: string | null;
  ticket_id?: string | null;
  conversation_id?: string | null;
  notes?: string | null;
};

type PbxSettings = {
  id?: string;
  pbx_url: string;
  api_token: string;
  extension: string;
  webhook_secret: string;
  enabled: boolean;
  missed_call_sms_enabled?: boolean;
  missed_call_sms_template?: string;
  missed_call_sms_business_hours_only?: boolean;
  missed_call_sms_cooldown_minutes?: number;
};

const iconFor = (c: Call) => {
  if (c.status === "voicemail") return <Voicemail className="h-4 w-4 text-amber-500" />;
  if (c.status === "missed") return <PhoneMissed className="h-4 w-4 text-red-500" />;
  if (c.direction === "inbound") return <PhoneIncoming className="h-4 w-4 text-emerald-500" />;
  return <PhoneOutgoing className="h-4 w-4 text-primary" />;
};

const fmtDur = (s?: number | null) => {
  if (!s) return "—";
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
};

export default function AlixConnectTelephony() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("Admin") || hasRole("Super Admin");
  const [calls, setCalls] = useState<Call[]>([]);
  const [dial, setDial] = useState("");
  const [dialing, setDialing] = useState(false);
  const [settings, setSettings] = useState<PbxSettings>({ pbx_url: "", api_token: "", extension: "", webhook_secret: "", enabled: true });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound" | "missed" | "voicemail">("all");

  const webhookUrl = useMemo(() => {
    const pid = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
    return pid ? `https://${pid}.supabase.co/functions/v1/ac-3cx-webhook` : "";
  }, []);

  const loadCalls = async () => {
    const { data } = await supabase.from("ac_calls").select("*").order("started_at", { ascending: false }).limit(200);
    setCalls((data as Call[]) ?? []);
  };
  const loadSettings = async () => {
    if (!isAdmin) return;
    const { data } = await supabase.from("ac_pbx_settings").select("*").is("user_id", null).maybeSingle();
    if (data) setSettings({ ...(data as any) });
  };

  useEffect(() => {
    loadCalls();
    loadSettings();
    const ch = supabase
      .channel("ac_calls_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ac_calls" }, (payload) => {
        setCalls((prev) => {
          const rec = payload.new as Call;
          if (payload.eventType === "DELETE") return prev.filter((c) => c.id !== (payload.old as Call).id);
          const idx = prev.findIndex((c) => c.id === rec.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = rec; return next; }
          return [rec, ...prev].slice(0, 200);
        });
        if (payload.eventType === "INSERT" && (payload.new as Call).direction === "inbound" && (payload.new as Call).status === "ringing") {
          const c = payload.new as Call;
          toast(`📞 Eingehender Anruf`, { description: `Von ${c.from_number ?? "unbekannt"}`, duration: 15000 });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const dialNow = async () => {
    if (!dial) return;
    setDialing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ac-3cx-call", { body: { to: dial } });
      if (error) throw error;
      toast.success("Anruf gestartet", { description: `→ ${dial}` });
      if ((data as any)?.tel_uri) window.location.href = (data as any).tel_uri;
      setDial("");
    } catch (e: any) {
      toast.error("Anruf fehlgeschlagen", { description: e.message });
    } finally { setDialing(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const payload = { ...settings, user_id: null };
      const { error } = settings.id
        ? await supabase.from("ac_pbx_settings").update(payload).eq("id", settings.id)
        : await supabase.from("ac_pbx_settings").insert(payload);
      if (error) throw error;
      toast.success("Einstellungen gespeichert");
      loadSettings();
    } catch (e: any) {
      toast.error("Fehler", { description: e.message });
    } finally { setSaving(false); }
  };

  const filtered = calls.filter((c) => {
    if (filter === "all") return true;
    if (filter === "missed") return c.status === "missed";
    if (filter === "voicemail") return c.status === "voicemail";
    return c.direction === filter;
  });

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" /> 3CX Telefonie
          </h2>
          <p className="text-sm text-muted-foreground">Click-to-Call, Anrufjournal und Screen-Pop – Phase 20</p>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary">Realtime aktiv</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Neuer Anruf</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="+49 30 12345678" value={dial} onChange={(e) => setDial(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dialNow()} className="max-w-xs" />
          <Button onClick={dialNow} disabled={dialing || !dial}><PhoneCall className="h-4 w-4 mr-2" />Anrufen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Anrufjournal</CardTitle>
          <div className="flex gap-1">
            {(["all","inbound","outbound","missed","voicemail"] as const).map((f) => (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
                {f === "all" ? "Alle" : f === "inbound" ? "Eingehend" : f === "outbound" ? "Ausgehend" : f === "missed" ? "Verpasst" : "Voicemail"}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">Keine Anrufe.</div>}
            {filtered.map((c) => (
              <details key={c.id} className="group">
                <summary className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 cursor-pointer list-none">
                  {iconFor(c)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c.direction === "inbound" ? (c.from_number ?? "Unbekannt") : (c.to_number ?? "—")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.started_at), { addSuffix: true, locale: de })} · {fmtDur(c.duration_seconds)}
                      {c.extension ? ` · Nst. ${c.extension}` : ""}
                      {c.voicemail_transcript_status === "processing" && " · Transkription läuft…"}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                  {c.ticket_id && <Badge variant="outline" className="text-[10px]">Ticket</Badge>}
                  {c.status === "ringing" && (
                    <Button variant="ghost" size="sm" onClick={async (e) => { e.preventDefault(); await supabase.from("ac_calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", c.id); }}>
                      <PhoneOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </summary>
                <div className="px-6 pb-4 pt-2 space-y-3 bg-muted/10 border-t">
                  {c.recording_url && (
                    <div>
                      <Label className="text-xs">Gesprächsaufnahme</Label>
                      <audio controls src={c.recording_url} className="w-full mt-1" />
                    </div>
                  )}
                  {c.voicemail_url && (
                    <div>
                      <Label className="text-xs">Voicemail</Label>
                      <audio controls src={c.voicemail_url} className="w-full mt-1" />
                      {c.voicemail_transcript ? (
                        <div className="mt-2 p-2 bg-background rounded text-sm border">{c.voicemail_transcript}</div>
                      ) : (
                        <Button variant="outline" size="sm" className="mt-2" onClick={async () => {
                          toast.info("Transkription gestartet…");
                          const { error } = await supabase.functions.invoke("ac-voicemail-transcribe", { body: { call_id: c.id } });
                          if (error) toast.error("Transkription fehlgeschlagen"); else toast.success("Transkript verfügbar");
                        }}>✨ KI-Transkription</Button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Notiz</Label>
                      <Input defaultValue={c.notes ?? ""} onBlur={async (e) => {
                        if (e.target.value !== (c.notes ?? "")) await supabase.from("ac_calls").update({ notes: e.target.value }).eq("id", c.id);
                      }} />
                    </div>
                    <Button variant="outline" size="sm" onClick={async () => {
                      const { data, error } = await supabase.from("tickets").insert({
                        subject: `Anruf ${c.direction === "inbound" ? "von" : "an"} ${c.from_number ?? c.to_number ?? "unbekannt"}`,
                        description: c.voicemail_transcript ?? c.notes ?? `Anruf am ${new Date(c.started_at).toLocaleString("de-DE")}`,
                        status: "open", priority: "normal", source: "phone",
                        customer_phone: c.from_number ?? c.to_number,
                      }).select().single();
                      if (error || !data) { toast.error("Ticket konnte nicht erstellt werden"); return; }
                      await supabase.from("ac_calls").update({ ticket_id: (data as any).id }).eq("id", c.id);
                      toast.success("Ticket erstellt");
                    }} disabled={!!c.ticket_id}>→ Ticket erstellen</Button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">3CX PBX Einstellungen (global)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>PBX Basis-URL</Label>
                <Input placeholder="https://pbx.beispiel.tld:5001" value={settings.pbx_url ?? ""} onChange={(e) => setSettings({ ...settings, pbx_url: e.target.value })} />
              </div>
              <div>
                <Label>API Token (Call Control)</Label>
                <Input type="password" value={settings.api_token ?? ""} onChange={(e) => setSettings({ ...settings, api_token: e.target.value })} />
              </div>
              <div>
                <Label>Standard-Nebenstelle</Label>
                <Input placeholder="100" value={settings.extension ?? ""} onChange={(e) => setSettings({ ...settings, extension: e.target.value })} />
              </div>
              <div>
                <Label>Webhook-Secret</Label>
                <Input value={settings.webhook_secret ?? ""} onChange={(e) => setSettings({ ...settings, webhook_secret: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
              <Label>Integration aktiv</Label>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground space-y-1">
              <div><strong>Webhook-URL für 3CX:</strong> <code className="text-primary">{webhookUrl}</code></div>
              <div>Sende Call-Events (ringing/answered/ended/voicemail) als JSON POST mit Header <code>x-3cx-signature: &lt;secret&gt;</code>.</div>
            </div>

            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">SMS bei verpasstem Anruf</Label>
                  <p className="text-xs text-muted-foreground">Sendet automatisch eine SMS an eingehende Anrufer, deren Anruf verpasst wurde.</p>
                </div>
                <Switch
                  checked={!!settings.missed_call_sms_enabled}
                  onCheckedChange={(v) => setSettings({ ...settings, missed_call_sms_enabled: v })}
                />
              </div>
              <div>
                <Label>Nachrichten-Template</Label>
                <textarea
                  className="mt-1 w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={settings.missed_call_sms_template ?? ""}
                  onChange={(e) => setSettings({ ...settings, missed_call_sms_template: e.target.value })}
                  placeholder="Hallo, wir haben Ihren Anruf leider verpasst…"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!settings.missed_call_sms_business_hours_only}
                    onCheckedChange={(v) => setSettings({ ...settings, missed_call_sms_business_hours_only: v })}
                  />
                  <Label>Nur innerhalb der Öffnungszeiten senden</Label>
                </div>
                <div>
                  <Label>Cooldown pro Nummer (Minuten)</Label>
                  <Input
                    type="number"
                    value={settings.missed_call_sms_cooldown_minutes ?? 60}
                    onChange={(e) => setSettings({ ...settings, missed_call_sms_cooldown_minutes: parseInt(e.target.value || "60") })}
                  />
                </div>
              </div>
            </div>

            <Button onClick={saveSettings} disabled={saving}><Save className="h-4 w-4 mr-2" />Speichern</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
