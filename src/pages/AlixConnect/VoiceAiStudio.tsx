import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mic, Loader2, Voicemail, MessageCircle } from "lucide-react";

export default function VoiceAiStudio() {
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("professionell");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState<any>(null);

  const generate = async () => {
    if (!objective.trim()) return toast.error("Ziel erforderlich");
    setLoading(true); setScript(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-voice-ai-studio", {
        body: { campaign_name: campaignName, objective, tone },
      });
      if (error) throw error;
      setScript(data);
      toast.success("Skript generiert");
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Voice AI Studio</h1>
        <Badge variant="outline">Phase 34</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Outbound-Voice-Skripte mit dynamischen Verzweigungen, Sentiment-adaptiven Antworten und Voicemail-Drops.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Kampagne</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="z. B. Q4 Anzahlungserinnerung" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Ziel</label>
              <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="z. B. Kunde an offene Rate erinnern und Zahlungsdatum vereinbaren" rows={4} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tonalität</label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="professionell / freundlich / dringlich" />
            </div>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mic className="h-4 w-4 mr-2" />}
              Skript generieren
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Generiertes Skript</CardTitle></CardHeader>
          <CardContent>
            {!script && !loading && <div className="text-sm text-muted-foreground">Kampagne definieren und generieren…</div>}
            {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> KI schreibt Skript…</div>}
            {script && (
              <div className="space-y-4 text-sm">
                <section>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Opening</div>
                  <div className="rounded border p-3 bg-muted/30">{script.opening}</div>
                </section>
                {Array.isArray(script.discovery_questions) && (
                  <section>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Discovery Fragen</div>
                    <ul className="list-disc list-inside space-y-0.5">{script.discovery_questions.map((q: string, i: number) => <li key={i}>{q}</li>)}</ul>
                  </section>
                )}
                {Array.isArray(script.objection_handling) && (
                  <section>
                    <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Einwandbehandlung</div>
                    <div className="space-y-2">
                      {script.objection_handling.map((o: any, i: number) => (
                        <div key={i} className="rounded border p-2">
                          <div className="text-xs font-medium">« {o.objection} »</div>
                          <div className="text-sm text-muted-foreground mt-1">→ {o.response}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-emerald-500 mb-1">Positive Close</div>
                    <div>{script.positive_close}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-amber-500 mb-1">Neutral Close</div>
                    <div>{script.neutral_close}</div>
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs uppercase text-destructive mb-1">Negative Close</div>
                    <div>{script.negative_close}</div>
                  </div>
                </section>
                {script.voicemail_drop && (
                  <section>
                    <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-1"><Voicemail className="h-3 w-3" /> Voicemail Drop</div>
                    <div className="rounded border p-3 bg-primary/5">{script.voicemail_drop}</div>
                  </section>
                )}
                {script.estimated_duration_sec != null && (
                  <div className="text-xs text-muted-foreground">Geschätzte Dauer: {script.estimated_duration_sec}s</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
