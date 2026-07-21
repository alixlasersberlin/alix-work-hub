import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, Download, Trash2, FileCheck2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ComplianceAutomation() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [evidence, setEvidence] = useState<any>(null);

  const call = async (action: string, extra: Record<string, any> = {}) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ac-compliance-automation", {
        body: { action, ...extra },
      });
      if (error) throw error;
      return data;
    } catch (e: any) { toast.error(e.message ?? "Fehler"); return null; }
    finally { setBusy(false); }
  };

  const doExport = async () => {
    const d = await call("dsar_export", { subject_email: email });
    if (d) { setResult(d); toast.success("DSGVO-Auskunft generiert"); }
  };
  const doErasePreview = async () => {
    const d = await call("dsar_erase", { subject_email: email, dry_run: true });
    if (d) { setResult(d); toast.info(`Vorschau: ${JSON.stringify(d.affected)}`); }
  };
  const doEraseRequest = async () => {
    if (!confirm("Erase-Anfrage protokollieren? Ausführung erfolgt manuell durch Super Admin.")) return;
    const d = await call("dsar_erase", { subject_email: email, dry_run: false });
    if (d) { setResult(d); toast.success("Erase-Anfrage protokolliert"); }
  };
  const loadEvidence = async () => {
    const d = await call("evidence_pack");
    if (d) setEvidence(d);
  };

  const download = (name: string, obj: any) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Compliance Automation 2.0</h1>
        <Badge variant="outline">Phase 44</Badge>
      </div>

      <Tabs defaultValue="dsar">
        <TabsList>
          <TabsTrigger value="dsar">DSGVO Auskunft &amp; Löschung</TabsTrigger>
          <TabsTrigger value="evidence">ISO 27001 Evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="dsar" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Betroffenen-Anfrage (Art. 15 / 17 DSGVO)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="E-Mail des Betroffenen" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                <Button onClick={doExport} disabled={!email || busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Download className="h-4 w-4 mr-1" />Auskunft</>}
                </Button>
                <Button variant="outline" onClick={doErasePreview} disabled={!email || busy}>Vorschau Löschung</Button>
                <Button variant="destructive" onClick={doEraseRequest} disabled={!email || busy}>
                  <Trash2 className="h-4 w-4 mr-1" />Löschung anfordern
                </Button>
              </div>
              {result && (
                <>
                  <Textarea readOnly value={JSON.stringify(result, null, 2)} className="font-mono text-xs h-72" />
                  <Button variant="outline" size="sm" onClick={() => download(`dsar_${email}_${Date.now()}.json`, result)}>
                    <Download className="h-4 w-4 mr-1" />JSON herunterladen
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCheck2 className="h-4 w-4" />Auditor-Evidence Pack</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={loadEvidence} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Evidence generieren"}
              </Button>
              {evidence && (
                <>
                  <Textarea readOnly value={JSON.stringify(evidence, null, 2)} className="font-mono text-xs h-96" />
                  <Button variant="outline" size="sm" onClick={() => download(`iso27001_evidence_${Date.now()}.json`, evidence)}>
                    <Download className="h-4 w-4 mr-1" />Evidence-Pack herunterladen
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
