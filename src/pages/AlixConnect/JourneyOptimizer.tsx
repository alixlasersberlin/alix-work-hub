import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GitBranch, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';

type Journey = { id: string; name: string; status: string | null; created_at: string };
type Analysis = {
  analytics: { step: any; total: number; completed: number; failed: number; drop_rate: number }[];
  worst_step: any; recommendation: string;
};

export default function JourneyOptimizer() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('ac_journeys' as any)
      .select('id, name, status, created_at').order('created_at', { ascending: false }).limit(100);
    if (error) toast.error(error.message);
    setJourneys((data as any) ?? []);
  };

  const optimize = async (id: string) => {
    setSelected(id); setRunning(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('ac-journey-optimize', { body: { journey_id: id } });
    if (error) toast.error(error.message); else setResult(data as any);
    setRunning(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Customer Journey AI-Optimizer"
        subtitle="Drop-off-Analyse · Next-Best-Step · A/B-Vorschläge auf Basis von Journey-Runs"
        icon={GitBranch}
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Laden</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Journeys</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {journeys.map(j => (
                  <TableRow key={j.id} className={selected === j.id ? 'bg-muted/40' : ''}>
                    <TableCell className="text-xs">{j.name}</TableCell>
                    <TableCell><Badge variant="outline">{j.status ?? '—'}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" disabled={running && selected === j.id} onClick={() => optimize(j.id)}>
                        <Sparkles className="mr-1 h-3 w-3" />Optimieren
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {journeys.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">Keine Journeys</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">AI-Empfehlung</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!result && <p className="text-xs text-muted-foreground">Journey auswählen und „Optimieren“ klicken.</p>}
            {result && (
              <>
                <div>
                  <h4 className="text-xs font-medium mb-2">Drop-off pro Schritt</h4>
                  <Table>
                    <TableHeader><TableRow><TableHead>Step</TableHead><TableHead>Total</TableHead><TableHead>Failed</TableHead><TableHead>Drop</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {result.analytics.map((a, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{String(a.step)}</TableCell>
                          <TableCell className="text-xs tabular-nums">{a.total}</TableCell>
                          <TableCell className="text-xs tabular-nums">{a.failed}</TableCell>
                          <TableCell><Badge variant={a.drop_rate > 0.3 ? 'destructive' : 'outline'}>{(a.drop_rate * 100).toFixed(0)}%</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                  <h4 className="text-xs font-medium mb-2">Empfehlung</h4>
                  <pre className="whitespace-pre-wrap text-xs text-foreground/90">{result.recommendation}</pre>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
