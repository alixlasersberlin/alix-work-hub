import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Source = { idx: number; id: string; title: string; snippet: string };

export default function AlixDocsAiSearch() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<Source[]>([]);

  async function ask() {
    const question = q.trim();
    if (!question) return;
    setLoading(true);
    setAnswer("");
    setSources([]);
    try {
      const { data, error } = await supabase.functions.invoke("alixdocs-ai-search", {
        body: { question },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnswer((data as any)?.answer ?? "");
      setSources((data as any)?.sources ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "AI-Suche fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  // Antwort mit klickbaren [n]-Fußnoten rendern
  function renderAnswer(text: string) {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((p, i) => {
      const m = p.match(/^\[(\d+)\]$/);
      if (m) {
        const n = Number(m[1]);
        const src = sources.find((s) => s.idx === n);
        if (src) {
          return (
            <a
              key={i}
              href={`#src-${n}`}
              className="mx-0.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/25"
              title={src.title}
            >
              [{n}]
            </a>
          );
        }
      }
      return <span key={i}>{p}</span>;
    });
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") ask();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="h-6 w-6 text-primary" />
          AlixDocs AI-Suche
        </h1>
        <p className="text-sm text-muted-foreground">
          Stelle Fragen in natürlicher Sprache – die Antwort wird aus deinen indexierten
          Dokumenten (OCR + Volltext) synthetisiert und mit Quellen zitiert.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Frage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="z. B. Welche Rechnungen betreffen Auftrag 2026-04226?"
            className="min-h-[90px]"
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">⌘/Strg + Enter zum Senden</div>
            <Button onClick={ask} disabled={loading || !q.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Fragen
            </Button>
          </div>
        </CardContent>
      </Card>

      {answer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Antwort</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{renderAnswer(answer)}</div>
          </CardContent>
        </Card>
      )}

      {sources.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quellen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sources.map((s) => (
              <div key={s.id} id={`src-${s.idx}`} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">[{s.idx}]</Badge>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{s.title}</span>
                  </div>
                  <Link
                    to={`/dokumente/vorschau?id=${s.id}`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Öffnen <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
                <div
                  className="text-xs text-muted-foreground [&_b]:bg-yellow-500/20 [&_b]:px-0.5 [&_b]:text-foreground"
                  dangerouslySetInnerHTML={{ __html: s.snippet || "" }}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
