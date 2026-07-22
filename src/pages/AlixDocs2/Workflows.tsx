import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, PlayCircle } from 'lucide-react';

export default function Workflows() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runScan() {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('alixdocs2-workflow-scan', { body: {} });
      if (error) throw error;
      setResult(data);
      toast.success(`Scan fertig: ${data?.created ?? 0} Benachrichtigungen erstellt`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Scan fehlgeschlagen');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ALIXDocs 2.0 — Workflow-Trigger</h1>
        <p className="text-muted-foreground mt-2">
          Prüft alle Dokumente auf ablaufende Garantien, Wartungstermine und Verträge und benachrichtigt Admin & Super Admin.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Automatischer Lauf</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Der Scan läuft täglich um <strong>06:15 UTC</strong> automatisch. Erinnerungen werden 30 Tage vor Ablauf erstellt und für 7 Tage nicht dupliziert.</p>
          <p>Erkannte Felder in <code>ai_entities</code>: <code>garantie_bis</code>, <code>garantie_ende</code>, <code>warranty_until</code>, <code>wartung_faellig</code>, <code>wartung_bis</code>, <code>next_service</code>, <code>vertrag_bis</code>, <code>vertrag_ende</code>, <code>contract_end</code>.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Manueller Lauf</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={runScan} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Scan jetzt starten
          </Button>
          {result && (
            <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
