import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Send, Plus, Play } from "lucide-react";

type Campaign = {
  id: string; name: string; channel_type: string; subject: string | null; body: string;
  status: string; total_count: number; sent_count: number; failed_count: number; created_at: string;
};

export default function AlixConnectCampaigns() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", channel_type: "email", subject: "", body: "", audience: "all_contacts" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ac_campaigns").select("*").order("created_at", { ascending: false });
    setRows((data as Campaign[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.body) { toast.error("Name und Inhalt sind Pflicht"); return; }
    setSaving(true);
    try {
      const field = form.channel_type === "email" ? "email" : "phone";
      const { data: contacts, error: ce } = await supabase
        .from("ac_contacts")
        .select(`id, customer_id, ${field}`)
        .not(field, "is", null);
      if (ce) throw ce;
      const recs = (contacts ?? [])
        .map((c: any) => ({ contact_id: c.id, customer_id: c.customer_id, address: c[field] }))
        .filter((r) => !!r.address);
      if (recs.length === 0) { toast.error("Keine Empfänger gefunden"); setSaving(false); return; }

      const { data: user } = await supabase.auth.getUser();
      const { data: camp, error } = await supabase.from("ac_campaigns").insert({
        name: form.name, channel_type: form.channel_type, subject: form.subject || null,
        body: form.body, audience_filter: { type: form.audience }, total_count: recs.length,
        created_by: user.user?.id,
      }).select("id").single();
      if (error) throw error;

      const { error: re } = await supabase.from("ac_campaign_recipients").insert(
        recs.map((r) => ({ ...r, campaign_id: camp!.id })),
      );
      if (re) throw re;

      toast.success(`Kampagne erstellt (${recs.length} Empfänger)`);
      setOpen(false);
      setForm({ name: "", channel_type: "email", subject: "", body: "", audience: "all_contacts" });
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Fehler");
    } finally { setSaving(false); }
  };

  const run = async (id: string) => {
    setRunning(id);
    try {
      const { data, error } = await supabase.functions.invoke("ac-campaign-run", { body: { campaign_id: id } });
      if (error) throw error;
      toast.success(`Versendet: ${data.sent} · Fehler: ${data.failed}`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Senden");
    } finally { setRunning(null); }
  };

  const statusColor = (s: string) => ({
    draft: "bg-muted text-muted-foreground",
    running: "bg-primary/20 text-primary",
    completed: "bg-emerald-500/20 text-emerald-500",
    failed: "bg-destructive/20 text-destructive",
    scheduled: "bg-blue-500/20 text-blue-500",
    cancelled: "bg-muted text-muted-foreground",
  }[s] ?? "bg-muted");

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Kampagnen</h2>
          <p className="text-xs text-muted-foreground">Bulk-Versand an Kontakte per E-Mail, WhatsApp oder SMS</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Neue Kampagne</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Neue Kampagne</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kanal</Label>
                  <Select value={form.channel_type} onValueChange={(v) => setForm({ ...form, channel_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">E-Mail</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Zielgruppe</Label>
                  <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_contacts">Alle Kontakte mit Adresse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.channel_type === "email" && (
                <div>
                  <Label>Betreff</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
              )}
              <div>
                <Label>Nachricht</Label>
                <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={create} disabled={saving}><Send className="mr-1 h-4 w-4" />Anlegen</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Kanal</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Gesendet</th>
              <th className="px-3 py-2 text-right">Fehler</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Lädt…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Noch keine Kampagnen</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.channel_type}</td>
                <td className="px-3 py-2"><Badge className={statusColor(r.status)} variant="secondary">{r.status}</Badge></td>
                <td className="px-3 py-2 text-right">{r.total_count}</td>
                <td className="px-3 py-2 text-right text-emerald-500">{r.sent_count}</td>
                <td className="px-3 py-2 text-right text-destructive">{r.failed_count}</td>
                <td className="px-3 py-2 text-right">
                  {['draft','scheduled','failed'].includes(r.status) && (
                    <Button size="sm" variant="outline" disabled={running === r.id} onClick={() => run(r.id)}>
                      <Play className="mr-1 h-3 w-3" />{running === r.id ? "Sendet…" : "Senden"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
