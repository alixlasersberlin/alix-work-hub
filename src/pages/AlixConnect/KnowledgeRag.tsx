import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BookOpen, Loader2, Quote, Network } from "lucide-react";

export default function KnowledgeRag() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const ask = async () => {
    if (!query.trim()) return;
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-knowledge-rag", { body: { query } });
      if (error) throw error;
      setResult(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Knowledge Graph &amp; RAG 2.0</h1>
        <Badge variant="outline">Phase 35</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Semantische Suche über Konversationen, Tickets und Dokumente — mit zitierten Antworten und Entity-Graph.</p>

      <Card>
        <CardHeader><CardTitle className="text-base">Frage stellen</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={3} placeholder="z.B. Wie war die letzte Reklamation von Kunde X?" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button onClick={ask} disabled={loading || !query.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Suche…</> : "Antwort generieren"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Antwort</CardTitle>
              <Badge variant="outline">Confidence {Math.round((result.confidence ?? 0) * 100)}%</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{result.answer || "—"}</p>
              {result.missing_info && (
                <div className="text-xs text-amber-500 border border-amber-500/30 rounded p-2 bg-amber-500/5">
                  ⚠ Fehlende Info: {result.missing_info}
                </div>
              )}
            </CardContent>
          </Card>

          {Array.isArray(result.citations) && result.citations.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Quote className="h-4 w-4" /> Zitate ({result.citations.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.citations.map((c: any, i: number) => (
                  <div key={i} className="rounded border p-2">
                    <Badge variant="outline" className="mb-1 text-[10px]">{c.ref}</Badge>
                    <div className="text-sm italic">« {c.quote} »</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Array.isArray(result.related_entities) && result.related_entities.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4" /> Verwandte Entities</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">{result.related_entities.map((s: string, i: number) => <Badge key={i} variant="secondary">{s}</Badge>)}</div>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground">Durchsuchte Quellen: {result.source_count ?? 0}</div>
        </div>
      )}
    </div>
  );
}
