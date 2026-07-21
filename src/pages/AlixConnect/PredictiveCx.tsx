import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Brain, Activity, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

type Row = {
  id: string;
  contact_id: string | null;
  customer_id: string | null;
  kind: string;
  score: number;
  risk_level: string | null;
  reason: string | null;
  suggested_action: string | null;
  computed_at: string;
};

const KINDS = [
  { k: 'churn', label: 'Churn-Risiko', icon: AlertTriangle },
  { k: 'escalation', label: 'Eskalation', icon: Activity },
  { k: 'nba', label: 'Next-Best-Action', icon: Sparkles },
  { k: 'sentiment', label: 'Sentiment', icon: Brain },
];

export default function PredictiveCx() {
  const [rows, setRows] = useState<Row[]>([]);
  const [kind, setKind] = useState<string>('churn');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ac_predictions' as any)
      .select('id, contact_id, customer_id, kind, score, risk_level, reason, suggested_action, computed_at')
      .eq('kind', kind)
      .order('score', { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [kind]);

  const runCompute = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('ac-predict-cx', { body: { limit: 500 } });
      if (error) throw error;
      toast.success('Predictions neu berechnet.');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const kpi = {
    high: rows.filter(r => r.risk_level === 'high').length,
    med: rows.filter(r => r.risk_level === 'med').length,
    low: rows.filter(r => r.risk_level === 'low').length,
    avg: rows.length ? (rows.reduce((s, r) => s + Number(r.score), 0) / rows.length) : 0,
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader
        title="Predictive CX"
        subtitle="Churn-, Eskalations- und Next-Best-Action-Vorhersagen"
        icon={Brain}
        noBreadcrumbs
        actions={
          <Button onClick={runCompute} disabled={running} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />
            Neu berechnen
          </Button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {KINDS.map(k => (
          <Button key={k.k} variant={kind === k.k ? 'default' : 'outline'} size="sm" onClick={() => setKind(k.k)}>
            <k.icon className="h-4 w-4 mr-2" /> {k.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Hoch" value={kpi.high} icon={AlertTriangle} accent="gold" />
        <KpiTile label="Mittel" value={kpi.med} icon={Activity} accent="sky" />
        <KpiTile label="Niedrig" value={kpi.low} icon={Sparkles} accent="emerald" />
        <KpiTile label="Ø Score" value={kpi.avg.toFixed(2)} icon={Brain} accent="violet" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Top 200 nach Score</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Lädt…</div> : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Noch keine Predictions. „Neu berechnen" klicken.</div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Risiko</TableHead>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Begründung</TableHead>
                    <TableHead>Empfohlene Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{Number(r.score).toFixed(2)}</TableCell>
                      <TableCell><Badge variant={r.risk_level === 'high' ? 'destructive' : r.risk_level === 'med' ? 'default' : 'secondary'}>{r.risk_level}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{(r.contact_id ?? '').slice(0, 8)}…</TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell className="text-sm">{r.suggested_action ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
