import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Workflow, Loader2, Save, Wand2, CheckCircle2, XCircle } from "lucide-react";

const EXAMPLE = {
  name: "Negative Sentiment → Escalate",
  description: "Bei negativem Sentiment im Chat: Agent zuweisen und WhatsApp-Follow-up nach 30 Min.",
  nodes: [
    { id: "t1", type: "trigger", kind: "message_received", params: { channel: "chat" }, next: "c1" },
    { id: "c1", type: "condition", kind: "sentiment", params: { operator: "<", value: -0.3 }, next_true: "a1", next_false: null },
    { id: "a1", type: "action", kind: "assign_agent", params: { team: "senior_support" }, next: "a2" },
    { id: "a2", type: "action", kind: "wait_minutes", params: { minutes: 30 }, next: "a3" },
    { id: "a3", type: "action", kind: "send_whatsapp", params: { template: "empathy_followup" }, next: null },
  ],
};

export default function WorkflowStudio() {
  const [prompt, setPrompt] = useState("");
  const [flowJson, setFlowJson] = useState(JSON.stringify(EXAMPLE, null, 2));
  const [validation, setValidation] = useState<any>(null);
  const [loading, setLoading] = useState<null | "gen" | "val" | "save">(null);

  const parseFlow = () => { try { return JSON.parse(flowJson); } catch { toast.error("Ungültiges JSON"); return null; } };

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading("gen"); setValidation(null);
    try {
      const { data, error } = await supabase.functions.invoke("ac-workflow-studio", { body: { op: "generate", prompt } });
      if (error) throw error;
      setFlowJson(JSON.stringify(data.flow, null, 2));
      setValidation(data.validation);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(null); }
  };
  const validate = async () => {
    const flow = parseFlow(); if (!flow) return;
    setLoading("val");
    try {
      const { data, error } = await supabase.functions.invoke("ac-workflow-studio", { body: { op: "validate", flow } });
      if (error) throw error;
      setValidation(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(null); }
  };
  const save = async () => {
    const flow = parseFlow(); if (!flow) return;
    setLoading("save");
    try {
      const { data, error } = await supabase.functions.invoke("ac-workflow-studio", { body: { op: "save", flow, is_active: false } });
      if (error) throw error;
      setValidation(data.validation);
      toast.success("Workflow als Entwurf gespeichert");
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(null); }
  };

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Workflow className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Workflow Automation Studio</h1>
        <Badge variant="outline">Phase 36</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        No-Code Cross-Channel-Automation: Trigger → Bedingung → Aktion. AI-Generator, Validierung und Versionierung.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wand2 className="h-4 w-4" /> AI-Generator</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="z. B. „Wenn Ticket überfällig, sende WhatsApp und eskaliere an Teamlead"" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Button onClick={generate} disabled={loading === "gen" || !prompt.trim()}>
            {loading === "gen" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generiere…</> : "Workflow generieren"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Flow (JSON)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea rows={16} className="font-mono text-xs" value={flowJson} onChange={(e) => setFlowJson(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={validate} disabled={loading === "val"}>
              {loading === "val" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validieren"}
            </Button>
            <Button onClick={save} disabled={loading === "save"}>
              {loading === "save" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Als Entwurf speichern
            </Button>
          </div>
        </CardContent>
      </Card>

      {validation && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2">
            {validation.ok ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
            Validierung
          </CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {validation.errors?.length > 0 && (
              <div>
                <div className="text-xs uppercase text-destructive mb-1">Fehler</div>
                <ul className="list-disc pl-5 text-destructive">{validation.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
              </div>
            )}
            {validation.warnings?.length > 0 && (
              <div>
                <div className="text-xs uppercase text-amber-500 mb-1">Warnungen</div>
                <ul className="list-disc pl-5 text-amber-500">{validation.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            {validation.ok && validation.errors?.length === 0 && validation.warnings?.length === 0 && (
              <div className="text-xs text-muted-foreground">Alles klar — Workflow ist valid.</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
