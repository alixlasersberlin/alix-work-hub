import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Languages, Loader2, ArrowRight } from "lucide-react";

const LANGS = ["de", "en", "fr", "es", "it", "pt", "nl", "pl", "tr", "ru", "uk", "cs", "ro", "hu", "ar", "he", "zh", "ja", "ko", "th", "vi", "id", "hi", "sv", "no", "da", "fi", "el", "bg", "sk"];

export default function TranslationHub() {
  const [text, setText] = useState("");
  const [source, setSource] = useState("auto");
  const [target, setTarget] = useState("en");
  const [tone, setTone] = useState("professionell");
  const [domain, setDomain] = useState("customer_support");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const translate = async () => {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-translate-live", {
        body: { text, source_lang: source, target_lang: target, tone, domain },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Languages className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Multilingual Real-Time Translation</h1>
        <Badge variant="outline">Phase 35</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Live-Übersetzung Chat / Voice / Email in 30+ Sprachen — tonalitäts- und fachbegriff-adaptiv.</p>

      <Card>
        <CardHeader><CardTitle className="text-base">Übersetzen</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Quelle</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-background">
                <option value="auto">Auto-Detect</option>
                {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ziel</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-background">
                {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tonalität</label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Domain</label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
          </div>
          <Textarea rows={5} placeholder="Text zum Übersetzen…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button onClick={translate} disabled={loading || !text.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Übersetze…</> : <>Übersetzen <ArrowRight className="h-4 w-4 ml-2" /></>}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              <Badge variant="outline" className="mr-2">{result.detected_source_lang}</Badge>
              <ArrowRight className="h-4 w-4 inline mx-1" />
              <Badge variant="outline">{result.target_lang}</Badge>
            </CardTitle>
            <Badge variant="secondary">Confidence {Math.round((result.confidence ?? 0) * 100)}%</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded border p-3 whitespace-pre-wrap text-sm">{result.translation}</div>
            {result.tone_applied && <div className="text-xs text-muted-foreground">Tonalität: {result.tone_applied}</div>}
            {Array.isArray(result.glossary_notes) && result.glossary_notes.length > 0 && (
              <section className="rounded border p-3">
                <div className="text-xs uppercase text-muted-foreground mb-1">Glossar-Hinweise</div>
                <ul className="text-sm space-y-1">
                  {result.glossary_notes.map((g: any, i: number) => (
                    <li key={i}><b>{g.term}:</b> {g.note}</li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
