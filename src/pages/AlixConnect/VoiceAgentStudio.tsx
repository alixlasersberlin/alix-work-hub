import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mic, Loader2, Play } from "lucide-react";

export default function VoiceAgentStudio() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userMsg, setUserMsg] = useState("Hallo, ich hätte eine Frage.");
  const [reply, setReply] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("ac-voice-agent-studio", { body: { action: "templates" } });
      if (error) return toast.error(error.message);
      setTemplates(data?.templates ?? []);
      if (data?.templates?.[0]) {
        setSelected(data.templates[0]);
        setSystemPrompt(data.templates[0].prompt);
      }
    })();
  }, []);

  const runTest = async () => {
    setBusy(true); setReply("");
    try {
      const { data, error } = await supabase.functions.invoke("ac-voice-agent-studio", { body: { action: "test", system: systemPrompt, user: userMsg } });
      if (error) throw error;
      setReply(data?.reply ?? "");
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Mic className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">AI Voice Agent Studio</h1>
        <Badge variant="outline">Phase 40</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelected(t); setSystemPrompt(t.prompt); }}
                  className={`w-full text-left p-3 hover:bg-muted transition-colors ${selected?.id === t.id ? "bg-muted" : ""}`}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">{t.language}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Agent-Sandbox</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">System-Prompt</div>
              <Textarea rows={6} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Anrufer sagt</div>
              <Input value={userMsg} onChange={(e) => setUserMsg(e.target.value)} />
            </div>
            <Button size="sm" onClick={runTest} disabled={busy || !systemPrompt}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1.5" />Antwort generieren</>}
            </Button>
            {reply && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
                {reply}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
