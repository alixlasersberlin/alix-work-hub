import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { HeartPulse, Loader2, AlertTriangle } from "lucide-react";

export default function SentimentEmotion() {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState("chat");
  const [lang, setLang] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-sentiment-emotion", {
        body: { text, channel, lang },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  const sentimentColor = (s?: string) => s === "positive" ? "default" : s === "negative" ? "destructive" : "secondary";

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Sentiment &amp; Emotion AI 2.0</h1>
        <Badge variant="outline">Phase 36</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Echtzeit-Emotion-Detection über Voice / Chat / Email inkl. Empathie-Coaching und Escalation-Triggern.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">Analyse</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Kanal</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm bg-background">
                {["chat", "email", "voice", "sms", "whatsapp"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sprache</label>
              <Input value={lang} onChange={(e) => setLang(e.target.value)} />
            </div>
          </div>
          <Textarea rows={5} placeholder="Kundennachricht oder Transkript…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button onClick={analyze} disabled={loading || !text.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analysiere…</> : "Emotion analysieren"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Ergebnis</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant={sentimentColor(result.sentiment)}>{result.sentiment}</Badge>
                <Badge variant="outline">Score {Number(result.score ?? 0).toFixed(2)}</Badge>
                <Badge variant="outline">{result.primary_emotion} · {Math.round((result.emotion_intensity ?? 0) * 100)}%</Badge>
                <Badge variant="secondary">Confidence {Math.round((result.confidence ?? 0) * 100)}%</Badge>
                <Badge variant="outline">Lang: {result.detected_lang}</Badge>
              </div>
              {result.escalation_recommended && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-destructive">Eskalation empfohlen</div>
                    <div className="text-xs text-muted-foreground">{result.escalation_reason}</div>
                  </div>
                </div>
              )}
              {Array.isArray(result.secondary_emotions) && result.secondary_emotions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.secondary_emotions.map((e: string) => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                </div>
              )}
              {Array.isArray(result.compliance_flags) && result.compliance_flags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.compliance_flags.map((f: string) => <Badge key={f} variant="destructive" className="text-[10px]">{f}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Empathie-Coaching</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {result.empathy_coaching?.suggested_reply && (
                <div className="rounded border p-3 whitespace-pre-wrap">{result.empathy_coaching.suggested_reply}</div>
              )}
              {result.empathy_coaching?.tone_advice && (
                <div className="text-xs text-muted-foreground">Ton: {result.empathy_coaching.tone_advice}</div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Do</div>
                  <ul className="text-xs space-y-1 list-disc pl-4">{(result.empathy_coaching?.do ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Don't</div>
                  <ul className="text-xs space-y-1 list-disc pl-4">{(result.empathy_coaching?.dont ?? []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
