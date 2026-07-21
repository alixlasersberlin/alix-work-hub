import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Loader2, Eraser, FileCheck2, RefreshCw } from "lucide-react";

export default function ComplianceGovernance() {
  const [text, setText] = useState("Kunde Max Mustermann, max@example.com, +49 170 1234567, IBAN DE89370400440532013000.");
  const [retention, setRetention] = useState("180");
  const [redaction, setRedaction] = useState<any>(null);
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState<null | "redact" | "audit" | "log">(null);

  const runAudit = async () => {
    setLoading("audit");
    try {
      const { data, error } = await supabase.functions.invoke("ac-compliance-governance", { body: { op: "audit", retention_days: Number(retention) || 180 } });
      if (error) throw error;
      setAudit(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(null); }
  };
  const runRedact = async () => {
    setLoading("redact");
    try {
      const { data, error } = await supabase.functions.invoke("ac-compliance-governance", { body: { op: "redact", text } });
      if (error) throw error;
      setRedaction(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(null); }
  };
  const logRedaction = async () => {
    if (!redaction) return;
    setLoading("log");
    try {
      const { data, error } = await supabase.functions.invoke("ac-compliance-governance", { body: { op: "log", findings: redaction.findings, source: "manual_studio" } });
      if (error) throw error;
      toast.success("Audit-Log geschrieben");
      console.log(data);
    } catch (e: any) { toast.error(e.message ?? "Fehler"); }
    finally { setLoading(null); }
  };

  useEffect(() => { runAudit(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Compliance &amp; Governance Cockpit</h1>
        <Badge variant="outline">Phase 36</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        DSGVO-/ISO-Kontrolle: automatische PII-Redaction, Consent-Übersicht, Recording-Retention und Audit-Trail.
      </p>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> Compliance-Snapshot</CardTitle>
          <div className="flex items-center gap-2">
            <Input value={retention} onChange={(e) => setRetention(e.target.value)} className="h-8 w-24" placeholder="Retention Tage" />
            <Button size="sm" variant="outline" onClick={runAudit} disabled={loading === "audit"}>
              {loading === "audit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {audit ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              {Object.entries(audit.metrics || {}).map(([k, v]) => (
                <div key={k} className="rounded border p-3">
                  <div className="text-xs text-muted-foreground uppercase">{k.replace(/_/g, " ")}</div>
                  <div className="text-2xl font-semibold mt-1">{String(v)}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-xs text-muted-foreground">Lade…</div>}
          {audit?.metrics?.overdue_recordings > 0 && (
            <div className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {audit.metrics.overdue_recordings} Aufnahmen überschreiten die Retention von {audit.retention_days} Tagen — bitte prüfen.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eraser className="h-4 w-4" /> PII-Redaction</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text mit potentieller PII…" />
          <div className="flex gap-2">
            <Button onClick={runRedact} disabled={loading === "redact"}>
              {loading === "redact" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Redigiere…</> : "Redigieren"}
            </Button>
            <Button variant="outline" onClick={logRedaction} disabled={!redaction || loading === "log"}>
              {loading === "log" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ins Audit-Log schreiben"}
            </Button>
          </div>
          {redaction && (
            <div className="space-y-2">
              <div className="rounded border p-3 whitespace-pre-wrap text-sm bg-muted/30">{redaction.redacted}</div>
              <div className="flex flex-wrap gap-1">
                {redaction.findings?.length ? redaction.findings.map((f: any, i: number) => (
                  <Badge key={i} variant="destructive" className="text-[10px]">{f.type}</Badge>
                )) : <span className="text-xs text-muted-foreground">Keine PII gefunden.</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
