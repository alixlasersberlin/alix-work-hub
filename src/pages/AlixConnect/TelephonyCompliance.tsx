import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Trash2, Search } from "lucide-react";

export default function TelephonyCompliance() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: s } = await supabase.from("ac_pbx_settings").select("*").eq("user_id", user.id).maybeSingle();
    setSettings(s || {
      user_id: user.id, enabled: false, recording_enabled: false, recording_retention_days: 90,
      dsgvo_announcement_enabled: true,
      dsgvo_announcement_text: "Dieses Gespräch wird zu Qualitäts- und Schulungszwecken aufgezeichnet. Bitte teilen Sie uns mit, wenn Sie damit nicht einverstanden sind.",
    });
    const { data: exp } = await supabase.from("ac_calls")
      .select("id,started_at,from_number,to_number,recording_url,recording_retention_until,recording_deleted_at")
      .not("recording_url", "is", null)
      .is("recording_deleted_at", null)
      .order("recording_retention_until", { ascending: true })
      .limit(20);
    setExpiring(exp || []);
  };

  useEffect(() => { load(); }, []);

  const searchContacts = async () => {
    if (!search.trim()) return;
    const { data } = await supabase.from("ac_contacts")
      .select("id,full_name,phone,call_recording_opt_out,call_recording_opt_out_at")
      .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`).limit(30);
    setContacts(data || []);
  };

  const toggleOptOut = async (id: string, next: boolean) => {
    const { error } = await supabase.from("ac_contacts")
      .update({ call_recording_opt_out: next, call_recording_opt_out_at: next ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Opt-out gespeichert" : "Opt-out aufgehoben");
    setContacts(cs => cs.map(c => c.id === id ? { ...c, call_recording_opt_out: next } : c));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("ac_pbx_settings").upsert(settings, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Compliance-Einstellungen gespeichert");
  };

  const purgeExpired = async () => {
    setPurging(true);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase.from("ac_calls")
      .update({ recording_url: null, recording_deleted_at: nowIso })
      .lt("recording_retention_until", nowIso)
      .is("recording_deleted_at", null)
      .not("recording_url", "is", null)
      .select("id");
    setPurging(false);
    if (error) return toast.error(error.message);
    toast.success(`${data?.length || 0} Aufzeichnungen gelöscht`);
    load();
  };

  if (!settings) return <div className="p-6 text-muted-foreground">Lade…</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Shield className="h-8 w-8 text-primary" /> Call-Recording Compliance</h1>
        <p className="text-muted-foreground">DSGVO-Ansage, Opt-out pro Kontakt und Aufbewahrungsfristen.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>DSGVO-Einstellungen</CardTitle><CardDescription>Gilt für alle inbound & outbound Aufzeichnungen dieser Nebenstelle.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div><Label>Aufzeichnung aktiv</Label><p className="text-xs text-muted-foreground">Bei Deaktivierung werden keine neuen Aufzeichnungen gespeichert.</p></div>
            <Switch checked={settings.recording_enabled} onCheckedChange={(v) => setSettings({ ...settings, recording_enabled: v })} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div><Label>DSGVO-Ansage vor Aufzeichnung</Label><p className="text-xs text-muted-foreground">Anrufer wird automatisch über die Aufzeichnung informiert.</p></div>
            <Switch checked={settings.dsgvo_announcement_enabled} onCheckedChange={(v) => setSettings({ ...settings, dsgvo_announcement_enabled: v })} />
          </div>
          <div>
            <Label>Ansagetext</Label>
            <Textarea rows={3} value={settings.dsgvo_announcement_text || ""} onChange={(e) => setSettings({ ...settings, dsgvo_announcement_text: e.target.value })} />
          </div>
          <div className="max-w-xs">
            <Label>Aufbewahrungsfrist (Tage)</Label>
            <Input type="number" min={1} max={730} value={settings.recording_retention_days} onChange={(e) => setSettings({ ...settings, recording_retention_days: parseInt(e.target.value) || 90 })} />
            <p className="mt-1 text-xs text-muted-foreground">Empfehlung DSGVO: 90 Tage. Danach automatische Löschung.</p>
          </div>
          <Button onClick={save} disabled={saving}>{saving ? "Speichere…" : "Einstellungen speichern"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Retention – nächste Löschungen</CardTitle><CardDescription>Aufzeichnungen, deren Frist abläuft. Manuelle Löschung jederzeit möglich.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <Button variant="destructive" size="sm" onClick={purgeExpired} disabled={purging}>
            <Trash2 className="mr-2 h-4 w-4" />{purging ? "Lösche…" : "Abgelaufene jetzt löschen"}
          </Button>
          <Table>
            <TableHeader><TableRow><TableHead>Datum</TableHead><TableHead>Von</TableHead><TableHead>Nach</TableHead><TableHead>Ablauf</TableHead></TableRow></TableHeader>
            <TableBody>
              {expiring.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Keine gespeicherten Aufzeichnungen.</TableCell></TableRow>}
              {expiring.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{new Date(c.started_at).toLocaleString("de-DE")}</TableCell>
                  <TableCell>{c.from_number}</TableCell>
                  <TableCell>{c.to_number}</TableCell>
                  <TableCell>{c.recording_retention_until ? <Badge variant={new Date(c.recording_retention_until) < new Date() ? "destructive" : "outline"}>{new Date(c.recording_retention_until).toLocaleDateString("de-DE")}</Badge> : <Badge variant="secondary">offen</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Opt-out pro Kontakt</CardTitle><CardDescription>Wenn ein Kunde der Aufzeichnung widerspricht, wird sein Gespräch nie aufgezeichnet.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Name oder Telefonnummer…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchContacts()} />
            <Button onClick={searchContacts}><Search className="mr-2 h-4 w-4" />Suchen</Button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Kontakt</TableHead><TableHead>Telefon</TableHead><TableHead>Opt-out</TableHead><TableHead>Seit</TableHead></TableRow></TableHeader>
            <TableBody>
              {contacts.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.full_name || "—"}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell><Switch checked={c.call_recording_opt_out} onCheckedChange={(v) => toggleOptOut(c.id, v)} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.call_recording_opt_out_at ? new Date(c.call_recording_opt_out_at).toLocaleDateString("de-DE") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
