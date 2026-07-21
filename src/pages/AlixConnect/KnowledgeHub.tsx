import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BookOpen, Loader2, Sparkles } from "lucide-react";

export default function KnowledgeHub() {
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [article, setArticle] = useState<any>(null);

  const suggest = async () => {
    if (!query.trim()) return;
    setLoading(true); setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("ac-knowledge-hub", { body: { action: "suggest", query } });
      if (error) throw error;
      setSuggestions(data.suggestions ?? []);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  const generate = async () => {
    if (!question.trim() && !summary.trim()) return;
    setLoading(true); setArticle(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-knowledge-hub", {
        body: { action: "generate_article", question, conversation_summary: summary },
      });
      if (error) throw error;
      setArticle(data.article);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Knowledge Hub &amp; Self-Service</h1>
        <Badge variant="outline">Phase 37</Badge>
      </div>
      <p className="text-sm text-muted-foreground">KI-gestützte Wissensdatenbank mit In-Chat-Suggestions und Auto-Article-Generation.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4" /> In-Chat Suggestions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Kundenfrage…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button size="sm" onClick={suggest} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vorschläge holen"}
            </Button>
            <div className="space-y-2">
              {suggestions.map((s: any, i: number) => (
                <div key={i} className="rounded border p-2">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.why}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Auto-Article aus Ticket</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Frage / Titel" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <Textarea rows={5} placeholder="Konversations-Zusammenfassung" value={summary} onChange={(e) => setSummary(e.target.value)} />
            <Button size="sm" onClick={generate} disabled={loading}>Artikel generieren</Button>
            {article && (
              <div className="rounded border p-3 space-y-2">
                <div className="font-medium">{article.title}</div>
                <div className="flex flex-wrap gap-1">
                  {(article.tags ?? []).map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
                <pre className="text-xs whitespace-pre-wrap font-sans">{article.body_md}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
