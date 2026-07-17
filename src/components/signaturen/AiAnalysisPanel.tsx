import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  documentId: string;
  textContent?: string;
  onFieldsSuggested?: (fields: any[]) => void;
}

export function AiAnalysisPanel({ documentId, textContent, onFieldsSuggested }: Props) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sig-ai-analyze', {
        body: { document_id: documentId, text_content: textContent },
      });
      if (error) throw error;
      setAnalysis(data.analysis);
      toast.success('KI-Analyse abgeschlossen');
    } catch (e: any) {
      toast.error('KI-Analyse fehlgeschlagen: ' + (e.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const riskColor = (score: number) => score >= 70 ? 'destructive' : score >= 40 ? 'default' : 'secondary';
  const clauseColor = (risk: string) => risk === 'high' ? 'destructive' : risk === 'medium' ? 'default' : 'secondary';

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="w-4 h-4 text-primary" />
          KI-Vertragsanalyse
        </CardTitle>
        {!analysis && (
          <Button size="sm" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Analyse starten
          </Button>
        )}
      </CardHeader>
      {analysis && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={riskColor(analysis.risk_score)}>Risiko: {analysis.risk_score}/100</Badge>
            <span className="text-sm text-muted-foreground">Modell: {analysis.model}</span>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Zusammenfassung</div>
            <p className="text-sm text-muted-foreground">{analysis.summary}</p>
          </div>
          {analysis.clauses?.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Klauseln</div>
              <div className="space-y-2">
                {analysis.clauses.map((c: any, i: number) => (
                  <div key={i} className="border rounded p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={clauseColor(c.risk)} className="text-[10px]">{c.risk}</Badge>
                      <span className="font-medium">{c.type}</span>
                    </div>
                    <div className="italic text-muted-foreground">„{c.quote}"</div>
                    <div className="flex items-start gap-1">
                      {c.risk === 'high' ? <AlertTriangle className="w-3 h-3 text-destructive mt-0.5" /> : <CheckCircle2 className="w-3 h-3 text-primary mt-0.5" />}
                      <span>{c.suggestion}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.suggested_fields?.length > 0 && onFieldsSuggested && (
            <Button size="sm" variant="outline" onClick={() => onFieldsSuggested(analysis.suggested_fields)}>
              {analysis.suggested_fields.length} Felder automatisch platzieren
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setAnalysis(null); }}>Neue Analyse</Button>
        </CardContent>
      )}
    </Card>
  );
}
