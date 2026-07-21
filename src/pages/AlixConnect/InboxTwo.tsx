import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Inbox, Loader2, RefreshCw } from "lucide-react";

type Convo = { id: string; subject?: string; status?: string; priority?: string; channel_type?: string; assigned_to?: string; sla_deadline?: string; last_message_at?: string };

export default function InboxTwo() {
  const [loading, setLoading] = useState(false);
  const [buckets, setBuckets] = useState<Record<string, Convo[]>>({ new: [], overdue: [], waiting: [], mine: [], all: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignee, setAssignee] = useState("");
  const [tab, setTab] = useState("new");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ac-inbox-2", { body: { action: "list" } });
      if (error) throw error;
      setBuckets(data.buckets ?? {});
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkAssign = async () => {
    if (!assignee || selected.size === 0) return toast.error("User-ID und Auswahl erforderlich");
    const { error } = await supabase.functions.invoke("ac-inbox-2", { body: { action: "bulk_assign", ids: [...selected], user_id: assignee } });
    if (error) return toast.error(error.message);
    toast.success(`${selected.size} zugewiesen`); load();
  };
  const bulkClose = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.functions.invoke("ac-inbox-2", { body: { action: "bulk_status", ids: [...selected], status: "closed" } });
    if (error) return toast.error(error.message);
    toast.success(`${selected.size} geschlossen`); load();
  };

  const rows = buckets[tab] ?? [];

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Inbox className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Omnichannel Inbox 2.0</h1>
        <Badge variant="outline">Phase 37</Badge>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Smart-Prioritization, SLA-Ampeln, Bulk-Actions & Assignment.</p>

      <Card>
        <CardHeader><CardTitle className="text-base">Bulk-Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Assignee User-ID (uuid)" value={assignee} onChange={(e) => setAssignee(e.target.value)} className="max-w-xs" />
          <Button size="sm" onClick={bulkAssign} disabled={selected.size === 0}>Zuweisen ({selected.size})</Button>
          <Button size="sm" variant="secondary" onClick={bulkClose} disabled={selected.size === 0}>Schließen</Button>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setSelected(new Set()); }}>
        <TabsList>
          <TabsTrigger value="new">Neu ({buckets.new?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="overdue">Überfällig ({buckets.overdue?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="waiting">Warten ({buckets.waiting?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="mine">Meine ({buckets.mine?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="all">Alle ({buckets.all?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">Keine Konversationen.</div>}
                {rows.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-muted/40">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.subject ?? c.id}</div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                        <span>{c.channel_type ?? "—"}</span>
                        {c.priority && <Badge variant="outline" className="text-[10px]">{c.priority}</Badge>}
                        {c.status && <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>}
                        {c.sla_deadline && <span>SLA: {new Date(c.sla_deadline).toLocaleString("de-DE")}</span>}
                        {c.last_message_at && <span>· {new Date(c.last_message_at).toLocaleString("de-DE")}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
