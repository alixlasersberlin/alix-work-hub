import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Upload, Play, PhoneForwarded, Clock, ListTree } from "lucide-react";

type IvrOption = { digit: string; label: string; action: "queue" | "extension" | "voicemail" | "hangup" | "submenu"; target?: string };
type Ivr = {
  id: string;
  name: string;
  extension: string | null;
  greeting_path: string | null;
  timeout_seconds: number;
  invalid_action: string;
  options: IvrOption[];
  enabled: boolean;
};

type Weekly = Record<string, { open: string; close: string; closed?: boolean }>;
type BH = {
  id: string;
  name: string;
  timezone: string;
  weekly: Weekly;
  holidays: { date: string; label?: string }[];
  closed_greeting_path: string | null;
  closed_action: string;
  closed_target: string | null;
  enabled: boolean;
};

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DEFAULT_WEEKLY: Weekly = Object.fromEntries(DAYS.map((d) => [d, { open: "09:00", close: "17:00", closed: d === "Sa" || d === "So" }]));

export default function TelephonyIvr() {
  const { roles } = useAuth();
  const isAdmin = roles?.some((r) => r === "Admin" || r === "Super Admin");

  const [ivrs, setIvrs] = useState<Ivr[]>([]);
  const [hours, setHours] = useState<BH[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [i, h] = await Promise.all([
      supabase.from("ac_pbx_ivr_menus").select("*").order("name"),
      supabase.from("ac_pbx_business_hours").select("*").order("name"),
    ]);
    setIvrs(((i.data as any) || []).map((r: any) => ({ ...r, options: r.options ?? [] })));
    setHours(((h.data as any) || []).map((r: any) => ({ ...r, weekly: r.weekly ?? {}, holidays: r.holidays ?? [] })));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function signedUrl(path: string | null | undefined) {
    if (!path) return null;
    const { data } = await supabase.storage.from("pbx-audio").createSignedUrl(path, 300);
    return data?.signedUrl ?? null;
  }
  async function playAudio(path: string | null) {
    const url = await signedUrl(path);
    if (!url) return toast.error("Keine Audio-Datei");
    new Audio(url).play().catch((e) => toast.error(e.message));
  }
  async function uploadAudio(file: File, prefix: string): Promise<string | null> {
    const path = `${prefix}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("pbx-audio").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); return null; }
    return path;
  }

  // ---- IVR ----
  async function createIvr() {
    const { error } = await supabase.from("ac_pbx_ivr_menus").insert({ name: "Neues Menü" });
    if (error) toast.error(error.message); else { toast.success("IVR angelegt"); load(); }
  }
  async function updateIvr(id: string, patch: Partial<Ivr>) {
    const { error } = await supabase.from("ac_pbx_ivr_menus").update(patch as any).eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  async function deleteIvr(id: string) {
    if (!confirm("IVR-Menü löschen?")) return;
    await supabase.from("ac_pbx_ivr_menus").delete().eq("id", id);
    load();
  }

  // ---- Hours ----
  async function createHours() {
    const { error } = await supabase.from("ac_pbx_business_hours").insert({ name: "Neue Öffnungszeiten", weekly: DEFAULT_WEEKLY });
    if (error) toast.error(error.message); else { toast.success("Öffnungszeiten angelegt"); load(); }
  }
  async function updateHours(id: string, patch: Partial<BH>) {
    const { error } = await supabase.from("ac_pbx_business_hours").update(patch as any).eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  async function deleteHours(id: string) {
    if (!confirm("Regel löschen?")) return;
    await supabase.from("ac_pbx_business_hours").delete().eq("id", id);
    load();
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      <Tabs defaultValue="ivr">
        <TabsList>
          <TabsTrigger value="ivr"><ListTree className="h-4 w-4 mr-1.5" />IVR / Ansagen</TabsTrigger>
          <TabsTrigger value="hours"><Clock className="h-4 w-4 mr-1.5" />Öffnungszeiten & Feiertage</TabsTrigger>
        </TabsList>

        {/* IVR */}
        <TabsContent value="ivr" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Menüs (Drücken Sie 1 für …), Ansagen-Uploads und Tastenbelegung.</p>
            {isAdmin && <Button size="sm" onClick={createIvr}><Plus className="h-4 w-4 mr-1" />Neues IVR</Button>}
          </div>
          {loading && <div className="text-sm text-muted-foreground">Lade …</div>}
          {ivrs.map((ivr) => (
            <Card key={ivr.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${ivr.enabled ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    <Input className="h-7 w-64" value={ivr.name} onChange={(e) => setIvrs(ivrs.map((x) => x.id === ivr.id ? { ...x, name: e.target.value } : x))} onBlur={(e) => updateIvr(ivr.id, { name: e.target.value })} />
                    {ivr.extension && <Badge variant="outline" className="text-[10px]">Ext {ivr.extension}</Badge>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Switch checked={ivr.enabled} onCheckedChange={(v) => updateIvr(ivr.id, { enabled: v })} />
                      <Button size="icon" variant="ghost" onClick={() => deleteIvr(ivr.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Nebenstelle</Label>
                    <Input defaultValue={ivr.extension ?? ""} onBlur={(e) => updateIvr(ivr.id, { extension: e.target.value || null })} disabled={!isAdmin} />
                  </div>
                  <div>
                    <Label className="text-xs">Timeout (s)</Label>
                    <Input type="number" defaultValue={ivr.timeout_seconds} onBlur={(e) => updateIvr(ivr.id, { timeout_seconds: Number(e.target.value) || 5 })} disabled={!isAdmin} />
                  </div>
                  <div>
                    <Label className="text-xs">Bei ungültiger Eingabe</Label>
                    <Select value={ivr.invalid_action} onValueChange={(v) => updateIvr(ivr.id, { invalid_action: v })} disabled={!isAdmin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="repeat">Ansage wiederholen</SelectItem>
                        <SelectItem value="voicemail">Voicemail</SelectItem>
                        <SelectItem value="hangup">Auflegen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs">Begrüßung:</Label>
                  {ivr.greeting_path
                    ? <Badge variant="outline" className="text-[10px]">{ivr.greeting_path.split("/").pop()}</Badge>
                    : <span className="text-xs text-muted-foreground">keine</span>}
                  <Button size="sm" variant="outline" onClick={() => playAudio(ivr.greeting_path)} disabled={!ivr.greeting_path}>
                    <Play className="h-3 w-3 mr-1" />Anhören
                  </Button>
                  {isAdmin && (
                    <label className="inline-flex items-center">
                      <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const p = await uploadAudio(f, `ivr/${ivr.id}`); if (p) await updateIvr(ivr.id, { greeting_path: p });
                      }} />
                      <span className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs cursor-pointer hover:bg-muted"><Upload className="h-3 w-3" />Hochladen</span>
                    </label>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">Tastenbelegung</Label>
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => updateIvr(ivr.id, { options: [...ivr.options, { digit: String(ivr.options.length + 1), label: "", action: "queue" }] })}>
                        <Plus className="h-3 w-3 mr-1" />Option
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {ivr.options.length === 0 && <div className="text-xs text-muted-foreground">Noch keine Optionen.</div>}
                    {ivr.options.map((opt, idx) => (
                      <div key={idx} className="grid gap-2 md:grid-cols-[70px_1fr_140px_1fr_40px] items-end rounded-md border border-border/60 bg-card/30 p-2">
                        <Input className="h-8" value={opt.digit} onChange={(e) => {
                          const opts = [...ivr.options]; opts[idx] = { ...opt, digit: e.target.value };
                          setIvrs(ivrs.map((x) => x.id === ivr.id ? { ...x, options: opts } : x));
                        }} onBlur={() => updateIvr(ivr.id, { options: ivr.options })} disabled={!isAdmin} />
                        <Input className="h-8" placeholder="Beschriftung (z.B. Vertrieb)" value={opt.label} onChange={(e) => {
                          const opts = [...ivr.options]; opts[idx] = { ...opt, label: e.target.value };
                          setIvrs(ivrs.map((x) => x.id === ivr.id ? { ...x, options: opts } : x));
                        }} onBlur={() => updateIvr(ivr.id, { options: ivr.options })} disabled={!isAdmin} />
                        <Select value={opt.action} onValueChange={(v: any) => {
                          const opts = [...ivr.options]; opts[idx] = { ...opt, action: v };
                          updateIvr(ivr.id, { options: opts });
                        }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="queue">Warteschlange</SelectItem>
                            <SelectItem value="extension">Nebenstelle</SelectItem>
                            <SelectItem value="voicemail">Voicemail</SelectItem>
                            <SelectItem value="submenu">Untermenü</SelectItem>
                            <SelectItem value="hangup">Auflegen</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input className="h-8" placeholder="Ziel (Ext./Queue-ID/Menü-ID)" defaultValue={opt.target ?? ""} onBlur={(e) => {
                          const opts = [...ivr.options]; opts[idx] = { ...opt, target: e.target.value || undefined };
                          updateIvr(ivr.id, { options: opts });
                        }} disabled={!isAdmin} />
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => updateIvr(ivr.id, { options: ivr.options.filter((_, i) => i !== idx) })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Hours */}
        <TabsContent value="hours" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Wochenpläne pro Zeitzone, Feiertage und Geschlossen-Ansage.</p>
            {isAdmin && <Button size="sm" onClick={createHours}><Plus className="h-4 w-4 mr-1" />Neue Regel</Button>}
          </div>
          {hours.map((h) => (
            <Card key={h.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${h.enabled ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    <Input className="h-7 w-64" defaultValue={h.name} onBlur={(e) => updateHours(h.id, { name: e.target.value })} disabled={!isAdmin} />
                    <Badge variant="outline" className="text-[10px]">{h.timezone}</Badge>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Switch checked={h.enabled} onCheckedChange={(v) => updateHours(h.id, { enabled: v })} />
                      <Button size="icon" variant="ghost" onClick={() => deleteHours(h.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <Label className="text-xs">Zeitzone</Label>
                    <Input defaultValue={h.timezone} onBlur={(e) => updateHours(h.id, { timezone: e.target.value || "Europe/Berlin" })} disabled={!isAdmin} />
                  </div>
                  <div>
                    <Label className="text-xs">Geschlossen-Aktion</Label>
                    <Select value={h.closed_action} onValueChange={(v) => updateHours(h.id, { closed_action: v })} disabled={!isAdmin}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="voicemail">Voicemail</SelectItem>
                        <SelectItem value="queue"><PhoneForwarded className="inline h-3 w-3 mr-1" />An Warteschlange</SelectItem>
                        <SelectItem value="extension">An Nebenstelle</SelectItem>
                        <SelectItem value="ivr">An IVR</SelectItem>
                        <SelectItem value="hangup">Auflegen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Ziel</Label>
                    <Input defaultValue={h.closed_target ?? ""} onBlur={(e) => updateHours(h.id, { closed_target: e.target.value || null })} disabled={!isAdmin} placeholder="Ext. / Queue-ID / IVR-ID" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Wochenplan</Label>
                  <div className="grid gap-2 mt-1">
                    {DAYS.map((d) => {
                      const row = h.weekly?.[d] ?? { open: "09:00", close: "17:00", closed: false };
                      return (
                        <div key={d} className="grid grid-cols-[50px_100px_100px_1fr] items-center gap-2 text-sm">
                          <div className="font-medium">{d}</div>
                          <Input type="time" value={row.open} onChange={(e) => updateHours(h.id, { weekly: { ...h.weekly, [d]: { ...row, open: e.target.value } } })} disabled={!isAdmin || row.closed} />
                          <Input type="time" value={row.close} onChange={(e) => updateHours(h.id, { weekly: { ...h.weekly, [d]: { ...row, close: e.target.value } } })} disabled={!isAdmin || row.closed} />
                          <label className="flex items-center gap-2 text-xs">
                            <Switch checked={!!row.closed} onCheckedChange={(v) => updateHours(h.id, { weekly: { ...h.weekly, [d]: { ...row, closed: v } } })} disabled={!isAdmin} />
                            geschlossen
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Feiertage (JSON: [{"{"} "date":"2026-12-25","label":"1. Weihnachtstag" {"}"}])</Label>
                  <Textarea rows={3} defaultValue={JSON.stringify(h.holidays, null, 2)} onBlur={(e) => {
                    try { updateHours(h.id, { holidays: JSON.parse(e.target.value) }); }
                    catch { toast.error("Ungültiges JSON"); }
                  }} disabled={!isAdmin} />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs">Geschlossen-Ansage:</Label>
                  {h.closed_greeting_path
                    ? <Badge variant="outline" className="text-[10px]">{h.closed_greeting_path.split("/").pop()}</Badge>
                    : <span className="text-xs text-muted-foreground">keine</span>}
                  <Button size="sm" variant="outline" onClick={() => playAudio(h.closed_greeting_path)} disabled={!h.closed_greeting_path}>
                    <Play className="h-3 w-3 mr-1" />Anhören
                  </Button>
                  {isAdmin && (
                    <label className="inline-flex items-center">
                      <input type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const p = await uploadAudio(f, `hours/${h.id}`); if (p) await updateHours(h.id, { closed_greeting_path: p });
                      }} />
                      <span className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs cursor-pointer hover:bg-muted"><Upload className="h-3 w-3" />Hochladen</span>
                    </label>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
