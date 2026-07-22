import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, RefreshCw, History } from "lucide-react";
import { CommentsPanel } from "@/components/alixdocs2/CommentsPanel";
import { ApprovalPanel } from "@/components/alixdocs2/ApprovalPanel";
import { SoftDeleteButtons } from "@/components/alixdocs2/SoftDeleteButtons";

export default function AlixDocs2Viewer() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [{ data: d }, { data: v }, { data: r }] = await Promise.all([
      supabase.from("alixdocs2_documents").select("*").eq("id", id).maybeSingle(),
      supabase.from("alixdocs2_versions").select("*").eq("document_id", id).order("version", { ascending: false }),
      supabase.from("alixdocs2_relations").select("*").eq("document_id", id),
    ]);
    setDoc(d);
    setVersions(v || []);
    setRelations(r || []);

    // Auth-Header holen und BLOB laden (Edge Function braucht JWT)
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alixdocs2-nc-file?document_id=${id}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      setFileUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast.error("Datei konnte nicht geladen werden: " + e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function reanalyze() {
    toast.info("Analyse gestartet...");
    const { error } = await supabase.functions.invoke("alixdocs2-analyze", { body: { document_id: id } });
    if (error) toast.error(error.message);
    else {
      toast.success("Analyse abgeschlossen");
      load();
    }
  }

  async function download() {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alixdocs2-nc-file?document_id=${id}&download=1`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = doc?.title || "dokument";
    a.click();
  }

  const isPdf = doc?.mime?.includes("pdf");
  const isImage = doc?.mime?.startsWith("image/");

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/alixdocs2/inbox"><ArrowLeft className="w-4 h-4 mr-1" /> Zurück</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{doc?.title || "Dokument"}</h1>
            <p className="text-xs text-muted-foreground">{doc?.nc_path}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reanalyze}><RefreshCw className="w-4 h-4 mr-1" /> Analyse</Button>
          <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" /> Download</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Vorschau</CardTitle></CardHeader>
          <CardContent>
            {loading && <p className="text-sm text-muted-foreground">Lade...</p>}
            {!loading && fileUrl && isPdf && (
              <iframe src={fileUrl} className="w-full h-[75vh] rounded border" title="PDF" />
            )}
            {!loading && fileUrl && isImage && (
              <img src={fileUrl} alt={doc?.title} className="max-w-full rounded border" />
            )}
            {!loading && fileUrl && !isPdf && !isImage && (
              <p className="text-sm">Keine Inline-Vorschau. <Button variant="link" onClick={download}>Herunterladen</Button></p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Metadaten</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Typ:</span> {doc?.doc_type || "—"}</div>
              <div><span className="text-muted-foreground">Sprache:</span> {doc?.language || "—"}</div>
              <div><span className="text-muted-foreground">MIME:</span> {doc?.mime || "—"}</div>
              <div><span className="text-muted-foreground">Größe:</span> {doc?.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{doc?.status}</Badge></div>
              {doc?.ai_confidence != null && (
                <div><span className="text-muted-foreground">KI-Confidence:</span> {Math.round(doc.ai_confidence * 100)}%</div>
              )}
              {doc?.ai_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {doc.ai_tags.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Versionen ({versions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm max-h-64 overflow-auto">
              {versions.length === 0 && <p className="text-muted-foreground">Keine früheren Versionen.</p>}
              {versions.map((v) => (
                <div key={v.id} className="flex justify-between border-b py-1">
                  <span>v{v.version}</span>
                  <span className="text-muted-foreground text-xs">{new Date(v.created_at).toLocaleString("de-DE")}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Verknüpfungen ({relations.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm max-h-64 overflow-auto">
              {relations.length === 0 && <p className="text-muted-foreground">Nicht zugeordnet.</p>}
              {relations.map((r) => (
                <div key={r.id} className="flex justify-between border-b py-1">
                  <span>{r.linked_type}</span>
                  <span className="text-muted-foreground text-xs font-mono">{r.linked_id.slice(0, 8)}…</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
