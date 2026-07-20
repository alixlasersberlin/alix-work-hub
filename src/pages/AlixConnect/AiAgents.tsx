import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AlixConnectAiAgents() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const draft = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setReply("");
    try {
      const { data, error } = await supabase.functions.invoke("ac-ai-reply", {
        body: { message: input, tone: "professional-friendly", locale: "de" },
      });
      if (error) throw error;
      setReply(data?.reply || "");
    } catch (e: any) {
      toast.error(e.message || "AI-Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> AI Agents
        </h2>
        <p className="text-sm text-muted-foreground">
          KI-gestützte Antwortvorschläge für Chat, E-Mail und WhatsApp. Powered by Lovable AI.
        </p>
      </div>
      <Card className="p-4 space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Kundennachricht</label>
        <Textarea rows={5} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text der eingehenden Nachricht…" />
        <Button onClick={draft} disabled={busy}>{busy ? "Denke…" : "Antwort entwerfen"}</Button>
      </Card>
      {reply && (
        <Card className="p-4 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Vorschlag</label>
          <Textarea rows={8} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(reply); toast.success("Kopiert"); }}>
              In Zwischenablage
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
