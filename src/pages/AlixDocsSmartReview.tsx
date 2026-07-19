import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Sparkles, FileText, ExternalLink, Check, X, RefreshCw } from "lucide-react";

type Candidate = {
  entity_type: "order" | "customer" | "device" | string;
  entity_id: string;
  score: number;
  hits?: string[];
  label?: string;
};

type Doc = {
  id: string;
  file_name: string;
  created_at: string;
  match_score: number | null;
  match_confidence: "auto" | "suggested" | "unassigned" | null;
  match_method: string | null;
  match_candidates: Candidate[] | null;
  order_id: string | null;
  customer_id: string | null;
  device_id: string | null;
  category_id: string | null;
};

const confLabel = (c: string | null) => {
  if (c === "auto") return { text: "Auto-zugeordnet", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
  if (c === "suggested") return { text: "Vorschlag", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  return { text: "Unzugeordnet", cls: "bg-rose-500/15 text-rose-600 border-rose-500/30" };
};

const scoreCls = (s: number | null) => {
  const v = s ?? 0;
  if (v >= 95) return "text-emerald-600";
  if (v >= 60) return "text-amber-600";
  return "text-rose-600";
};

export default function AlixDocsSmartReview() {
  const [tab, setTab] = useState<"suggested" | "unassigned" | "auto">("suggested");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("alixdocs_documents")
      .select("id,file_name,created_at,match_score,match_confidence,match_method,match_candidates,order_id,customer_id,device_id,category_id")
      .eq("match_confidence", tab)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (data ?? []) as Doc[];
    setDocs(list);
    await resolveLabels(list);
    setLoading(false);
  }

  async function resolveLabels(list: Doc[]) {
    const orderIds = new Set<string>();
    const custIds = new Set<string>();
    const devIds = new Set<string>();
    for (const d of list) {
      for (const c of d.match_candidates ?? []) {
        if (!c?.entity_id) continue;
        if (c.entity_type === "order") orderIds.add(c.entity_id);
        else if (c.entity_type === "customer") custIds.add(c.entity_id);
        else if (c.entity_type === "device") devIds.add(c.entity_id);
      }
    }
    const map: Record<string, string> = {};
    if (orderIds.size) {
      const { data } = await supabase.from("orders").select("id,order_number,customer_name").in("id", [...orderIds]);
      (data ?? []).forEach((o: any) => { map[`order:${o.id}`] = `${o.order_number ?? o.id.slice(0, 8)} · ${o.customer_name ?? ""}`; });
    }
    if (custIds.size) {
      const { data } = await supabase.from("customers").select("id,name,customer_number").in("id", [...custIds]);
      (data ?? []).forEach((c: any) => { map[`customer:${c.id}`] = `${c.name ?? c.customer_number ?? c.id.slice(0, 8)}`; });
    }
    if (devIds.size) {
      const { data } = await supabase.from("lager_devices").select("id,serial_number,model").in("id", [...devIds]);
      (data ?? []).forEach((d: any) => { map[`device:${d.id}`] = `SN ${d.serial_number ?? ""} · ${d.model ?? ""}`; });
    }
    setLabels(map);
  }

  useEffect(() => { load(); }, [tab]);

  async function assign(doc: Doc, cand: Candidate) {
    setBusy(doc.id);
    const patch: any = { match_confidence: "auto", match_score: cand.score, matched_by: (await supabase.auth.getUser()).data.user?.id };
    if (cand.entity_type === "order") patch.order_id = cand.entity_id;
    if (cand.entity_type === "customer") patch.customer_id = cand.entity_id;
    if (cand.entity_type === "device") patch.device_id = cand.entity_id;
    const { error } = await supabase.from("alixdocs_documents").update(patch).eq("id", doc.id);
    if (error) { toast.error(error.message); setBusy(null); return; }
    await supabase.from("alixdocs_match_feedback").insert({
      document_id: doc.id,
      chosen_entity_type: cand.entity_type,
      chosen_entity_id: cand.entity_id,
      rejected_candidates: (doc.match_candidates ?? []).filter(c => c.entity_id !== cand.entity_id),
      match_score_before: doc.match_score ?? 0,
    });
    toast.success("Zugewiesen");
    setBusy(null);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  async function reject(doc: Doc) {
    setBusy(doc.id);
    const { error } = await supabase.from("alixdocs_documents").update({ match_confidence: "unassigned" }).eq("id", doc.id);
    if (error) { toast.error(error.message); setBusy(null); return; }
    await supabase.from("alixdocs_match_feedback").insert({
      document_id: doc.id,
      chosen_entity_type: "none",
      rejected_candidates: doc.match_candidates ?? [],
      match_score_before: doc.match_score ?? 0,
    });
    toast.success("Vorschläge verworfen");
    setBusy(null);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  async function rerun(doc: Doc) {
    setBusy(doc.id);
    const { error } = await supabase.functions.invoke("alixdocs-smart-match", { body: { document_id: doc.id } });
    if (error) toast.error(error.message); else toast.success("Neu geprüft");
    setBusy(null);
    load();
  }

  const counts = useMemo(() => docs.length, [docs]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Sparkles className="w-6 h-6 text-primary" /> AlixDocs Smart Review</h1>
          <p className="text-sm text-muted-foreground">Prüfe und bestätige die automatischen Zuordnungen</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Neu laden</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="suggested">Vorschläge</TabsTrigger>
          <TabsTrigger value="unassigned">Unzugeordnet</TabsTrigger>
          <TabsTrigger value="auto">Auto-zugeordnet</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>}
          {!loading && counts === 0 && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Keine Dokumente in dieser Kategorie</CardContent></Card>
          )}
          {!loading && docs.map(doc => {
            const conf = confLabel(doc.match_confidence);
            const cands = (doc.match_candidates ?? []).slice(0, 5);
            return (
              <Card key={doc.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate">{doc.file_name}</span>
                      </CardTitle>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{new Date(doc.created_at).toLocaleString("de-DE")}</span>
                        <span>Methode: {doc.match_method ?? "—"}</span>
                        <span>Score: <span className={`font-semibold ${scoreCls(doc.match_score)}`}>{doc.match_score ?? 0}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={conf.cls}>{conf.text}</Badge>
                      <Link to={`/dokumente/vorschau?id=${doc.id}`}><Button size="sm" variant="ghost"><ExternalLink className="w-4 h-4" /></Button></Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cands.length === 0 && <div className="text-sm text-muted-foreground">Keine Kandidaten gefunden.</div>}
                  {cands.map((c, i) => {
                    const key = `${c.entity_type}:${c.entity_id}`;
                    const label = labels[key] ?? c.label ?? c.entity_id?.slice(0, 8);
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 border rounded-md p-2.5 hover:bg-accent/40">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            <Badge variant="secondary" className="mr-2 text-[10px] uppercase">{c.entity_type}</Badge>
                            {label}
                          </div>
                          {c.hits && c.hits.length > 0 && (
                            <div className="text-xs text-muted-foreground truncate">Treffer: {c.hits.join(", ")}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-semibold ${scoreCls(c.score)}`}>{c.score}</span>
                          <Button size="sm" disabled={busy === doc.id} onClick={() => assign(doc, c)}>
                            <Check className="w-4 h-4 mr-1" />Zuweisen
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button size="sm" variant="ghost" disabled={busy === doc.id} onClick={() => rerun(doc)}>
                      <RefreshCw className="w-4 h-4 mr-1" />Neu prüfen
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === doc.id} onClick={() => reject(doc)}>
                      <X className="w-4 h-4 mr-1" />Verwerfen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
