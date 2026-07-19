import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, EyeOff, Archive, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Doc = {
  id: string;
  title: string | null;
  original_filename: string | null;
  content_hash: string;
  file_size: number | null;
  created_at: string;
  duplicate_of: string | null;
  dedupe_ignored: boolean;
  status: string | null;
};

type Group = { hash: string; docs: Doc[] };

export default function AlixDocsDuplicates() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    // Alle Dokumente mit content_hash laden, gruppieren
    const { data, error } = await supabase
      .from("alixdocs_documents")
      .select("id, title, original_filename, content_hash, file_size, created_at, duplicate_of, dedupe_ignored, status")
      .not("content_hash", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const byHash = new Map<string, Doc[]>();
    (data ?? []).forEach((d) => {
      const arr = byHash.get(d.content_hash!) ?? [];
      arr.push(d as Doc);
      byHash.set(d.content_hash!, arr);
    });
    const grouped: Group[] = [];
    for (const [hash, docs] of byHash) {
      if (docs.length < 2) continue;
      if (docs.every((d) => d.dedupe_ignored)) continue;
      grouped.push({ hash, docs });
    }
    grouped.sort((a, b) => b.docs.length - a.docs.length);
    setGroups(grouped);

    const { count } = await supabase
      .from("alixdocs_documents")
      .select("id", { count: "exact", head: true })
      .is("content_hash", null)
      .is("deleted_at", null);
    setRemaining(count ?? 0);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function runBackfill() {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("alixdocs-hash-backfill", {
        body: { batch: 50 },
      });
      if (error) throw error;
      const r = data as any;
      toast.success(`Hash-Backfill: ${r?.processed ?? 0} verarbeitet, ${r?.remaining ?? 0} verbleiben`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Backfill fehlgeschlagen");
    } finally {
      setRunning(false);
    }
  }

  async function markDuplicate(dupId: string, originalId: string) {
    const { error } = await supabase
      .from("alixdocs_documents")
      .update({ duplicate_of: originalId, status: "duplicate" })
      .eq("id", dupId);
    if (error) return toast.error(error.message);
    toast.success("Als Duplikat markiert");
    await load();
  }

  async function ignoreGroup(docIds: string[]) {
    const { error } = await supabase
      .from("alixdocs_documents")
      .update({ dedupe_ignored: true })
      .in("id", docIds);
    if (error) return toast.error(error.message);
    toast.success("Gruppe ignoriert");
    await load();
  }

  async function archiveOlder(docs: Doc[]) {
    // Neuestes behalten, Rest archivieren
    const sorted = [...docs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const keep = sorted[0];
    const rest = sorted.slice(1);
    const { error } = await supabase
      .from("alixdocs_documents")
      .update({ status: "archived", archived_at: new Date().toISOString(), duplicate_of: keep.id })
      .in("id", rest.map((d) => d.id));
    if (error) return toast.error(error.message);
    toast.success(`${rest.length} ältere Dokumente archiviert`);
    await load();
  }

  const totalDuplicates = useMemo(
    () => groups.reduce((sum, g) => sum + g.docs.length - 1, 0),
    [groups],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Copy className="h-6 w-6 text-primary" />
            Duplikate
          </h1>
          <p className="text-sm text-muted-foreground">
            Dokumente mit identischem SHA-256-Hash. {totalDuplicates} überzählige Datei(en) in {groups.length} Gruppen.
            {remaining != null && remaining > 0 && (
              <> · {remaining} Dokumente ohne berechneten Hash.</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Neu laden
          </Button>
          <Button size="sm" onClick={runBackfill} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            Hash-Backfill (50)
          </Button>
        </div>
      </div>

      {loading && groups.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lade Duplikat-Gruppen…
        </div>
      )}

      {!loading && groups.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Keine Duplikate gefunden. 🎉
          </CardContent>
        </Card>
      )}

      {groups.map((g) => {
        const original = [...g.docs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        return (
          <Card key={g.hash}>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">
                  {g.docs.length} identische Dateien
                </CardTitle>
                <div className="font-mono text-xs text-muted-foreground">{g.hash.slice(0, 24)}…</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => archiveOlder(g.docs)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Ältere archivieren
                </Button>
                <Button variant="ghost" size="sm" onClick={() => ignoreGroup(g.docs.map((d) => d.id))}>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Ignorieren
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {g.docs.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-4 w-4 flex-none text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {d.title || d.original_filename || d.id}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(d.created_at).toLocaleString("de-DE")}</span>
                        {d.file_size != null && <span>· {Math.round(d.file_size / 1024)} KB</span>}
                        {d.id === original.id && <Badge variant="secondary">Neueste</Badge>}
                        {d.status === "duplicate" && <Badge variant="destructive">Duplikat</Badge>}
                        {d.status === "archived" && <Badge>Archiviert</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/dokumente/vorschau?id=${d.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Öffnen
                    </Link>
                    {d.id !== original.id && d.status !== "duplicate" && (
                      <Button size="sm" variant="ghost" onClick={() => markDuplicate(d.id, original.id)}>
                        Als Duplikat markieren
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
