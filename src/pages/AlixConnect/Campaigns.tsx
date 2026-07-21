import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Send, Plus, Play, Trash2, BarChart3 } from "lucide-react";

type Campaign = {
  id: string; name: string; channel_type: string; subject: string | null; body: string;
  status: string; total_count: number; sent_count: number; failed_count: number; created_at: string;
  is_ab_test: boolean; ab_variants: any[]; segment_id: string | null;
};
type Variant = { label: string; subject: string; body: string; weight: number };
type Segment = { id: string; name: string; contact_count: number };

export default function AlixConnectCampaigns() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<any[]>([]);

  const [form, setForm] = useState({
    name: "", channel_type: "email", subject: "", body: "",
    segmentId: "all", isAb: false,
  });
  const [variants, setVariants] = useState<Variant[]>([
    { label: "A", subject: "", body: "", weight: 50 },
    { label: "B", subject: "", body: "", weight: 50 },
  ]);

  const load = async () => {
    setLoading(true);
    const [c, s] = await Promise.all([
      supabase.from("ac_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("ac_segments" as any).select("id,name,contact_count").order("name"),
    ]);
    setRows((c.data as Campaign[]) ?? []);
    setSegments((s.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: "", channel_type: "email", subject: "", body: "", segmentId: "all", isAb: false });
    setVariants([{ label: "A", subject: "", body: "", weight: 50 }, { label: "B", subject: "", body: "", weight: 50 }]);
  };

  async function resolveRecipients(): Promise<{ contact_id: string; customer_id: any; address: string }[]> {
    const field = form.channel_type === "email" ? "email" : "phone";
    if (form.segmentId && form.segmentId !== "all") {
      const { data } = await supabase.functions.invoke("ac-segment-preview", { body: { segment_id: form.segmentId } });
      const ids: string[] = (data as any)?.sample ?? [];
      if (ids.length === 0) return [];
      const { data: contacts } = await supabase.from("ac_contacts")
        .select(`id, customer_id, ${field}`).in("id", ids).not(field, "is", null);
      return (contacts ?? []).map((c: any) => ({ contact_id: c.id, customer_id: c.customer_id, address: c[field] })).filter((r) => !!r.address);
    }
    const { data: contacts } = await supabase.from("ac_contacts")
      .select(`id, customer_id, ${field}`).not(field, "is", null);
    return (contacts ?? []).map((c: any) => ({ contact_id: c.id, customer_id: c.customer_id, address: c[field] })).filter((r) => !!r.address);
  }

  const create = async () => {
    if (!form.name) return toast.error("Name erforderlich");
    if (!form.isAb && !form.body) return toast.error("Inhalt erforderlich");
    if (form.isAb && variants.some((v) => !v.body)) return toast.error("Alle Varianten brauchen Inhalt");
    setSaving(true);
    try {
      const recs = await resolveRecipients();
      if (recs.length === 0) { toast.error("Keine Empfänger"); setSaving(false); return; }

      const { data: user } = await supabase.auth.getUser();
      const { data: camp, error } = await supabase.from("ac_campaigns").insert({
        name: form.name, channel_type: form.channel_type,
        subject: form.isAb ? null : (form.subject || null),
        body: form.isAb ? "" : form.body,
        is_ab_test: form.isAb,
        ab_variants: form.isAb ? (variants as any) : [],
        segment_id: form.segmentId !== "all" ? form.segmentId : null,
        audience_filter: { type: form.segmentId === "all" ? "all_contacts" : "segment" },
        total_count: recs.length,
        created_by: user.user?.id,
      }).select("id").single();
      if (error) throw error;

      const { error: re } = await supabase.from("ac_campaign_recipients").insert(
        recs.map((r) => ({ ...r, campaign_id: camp!.id })),
      );
      if (re) throw re;

      toast.success(`Kampagne erstellt (${recs.length} Empfänger)`);
      setOpen(false); resetForm(); load();
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

  const remove = async (id: string) => {
    if (!confirm("Kampagne löschen?")) return;
    await supabase.from("ac_campaign_recipients").delete().eq("campaign_id", id);
    const { error } = await supabase.from("ac_campaigns").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const showStats = async (c: Campaign) => {
    setStatsOpen(c);
    const { data } = await supabase.from("ac_campaign_recipients")
      .select("variant,status,opened_at,clicked_at,replied_at").eq("campaign_id", c.id);
    const grouped: Record<string, any> = {};
    for (const r of (data as any) ?? []) {
      const v = r.variant ?? "—";
      grouped[v] ??= { variant: v, sent: 0, opened: 0, clicked: 0, replied: 0, failed: 0 };
      if (r.status === "sent") grouped[v].sent++;
      if (r.status === "failed") grouped[v].failed++;
      if (r.opened_at) grouped[v].opened++;
      if (r.clicked_at) grouped[v].clicked++;
      if (r.replied_at) grouped[v].replied++;
    }
    setStats(Object.values(grouped));
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
          <p className="text-xs text-muted-foreground">Multi-Channel Bulk-Versand mit A/B-Tests und Segmenten</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Neue Kampagne</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Neue Kampagne</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
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
                  <Label>Segment</Label>
                  <Select value={form.segmentId} onValueChange={(v) => setForm({ ...form, segmentId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kontakte mit Adresse</SelectItem>
                      {segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.contact_count})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-border/50 p-3">
                <Switch checked={form.isAb} onCheckedChange={(v) => setForm({ ...form, isAb: v })} />
                <div className="flex-1"><Label className="mb-0">A/B-Test aktivieren</Label>
                  <p className="text-xs text-muted-foreground">Varianten werden gewichtet zufällig verteilt.</p>
                </div>
              </div>

              {!form.isAb ? (
                <>
                  {form.channel_type === "email" && (
                    <div><Label>Betreff</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
                  )}
                  <div><Label>Nachricht</Label>
                    <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {variants.map((v, i) => (
                    <div key={i} className="rounded-md border border-border/50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge>Variante {v.label}</Badge>
                        <Input className="w-24" type="number" value={v.weight}
                          onChange={(e) => { const c = [...variants]; c[i].weight = Number(e.target.value); setVariants(c); }} />
                        <span className="text-xs text-muted-foreground">Gewicht %</span>
                      </div>
                      {form.channel_type === "email" && (
                        <Input placeholder="Betreff" value={v.subject}
                          onChange={(e) => { const c = [...variants]; c[i].subject = e.target.value; setVariants(c); }} />
                      )}
                      <Textarea rows={4} placeholder="Inhalt" value={v.body}
                        onChange={(e) => { const c = [...variants]; c[i].body = e.target.value; setVariants(c); }} />
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setVariants([...variants, {
                    label: String.fromCharCode(65 + variants.length), subject: "", body: "", weight: 25,
                  }])}><Plus className="h-4 w-4 mr-2" />Variante hinzufügen</Button>
                </div>
              )}
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
              <th className="px-3 py-2 text-left">Typ</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Gesendet</th>
              <th className="px-3 py-2 text-right">Fehler</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Lädt…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Noch keine Kampagnen</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">{r.channel_type}</td>
                <td className="px-3 py-2">{r.is_ab_test ? <Badge variant="outline">A/B</Badge> : "—"}</td>
                <td className="px-3 py-2"><Badge className={statusColor(r.status)} variant="secondary">{r.status}</Badge></td>
                <td className="px-3 py-2 text-right">{r.total_count}</td>
                <td className="px-3 py-2 text-right text-emerald-500">{r.sent_count}</td>
                <td className="px-3 py-2 text-right text-destructive">{r.failed_count}</td>
                <td className="px-3 py-2 text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => showStats(r)}><BarChart3 className="h-4 w-4" /></Button>
                  {['draft','scheduled','failed'].includes(r.status) && (
                    <Button size="sm" variant="outline" disabled={running === r.id} onClick={() => run(r.id)}>
                      <Play className="mr-1 h-3 w-3" />{running === r.id ? "Sendet…" : "Senden"}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!statsOpen} onOpenChange={(o) => !o && setStatsOpen(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Statistik: {statsOpen?.name}</DialogTitle></DialogHeader>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">Variante</th>
                <th className="px-2 py-1 text-right">Gesendet</th>
                <th className="px-2 py-1 text-right">Geöffnet</th>
                <th className="px-2 py-1 text-right">Klicks</th>
                <th className="px-2 py-1 text-right">Antworten</th>
                <th className="px-2 py-1 text-right">Fehler</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Keine Daten</td></tr>
              ) : stats.map((s) => (
                <tr key={s.variant} className="border-t border-border/40">
                  <td className="px-2 py-1 font-medium">{s.variant}</td>
                  <td className="px-2 py-1 text-right">{s.sent}</td>
                  <td className="px-2 py-1 text-right">{s.opened} <span className="text-xs text-muted-foreground">({s.sent ? Math.round(s.opened * 100 / s.sent) : 0}%)</span></td>
                  <td className="px-2 py-1 text-right">{s.clicked}</td>
                  <td className="px-2 py-1 text-right">{s.replied}</td>
                  <td className="px-2 py-1 text-right text-destructive">{s.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
