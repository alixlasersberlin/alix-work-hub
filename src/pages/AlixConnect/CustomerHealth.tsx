import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HeartPulse, RefreshCw, TrendingUp, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

type Health = {
  id: string; customer_id: string; score: number;
  usage_score: number | null; payment_score: number | null;
  support_score: number | null; sentiment_score: number | null;
  lifecycle_stage: string; factors: any; computed_at: string;
};

const STAGES = ['onboarding', 'adopt', 'expand', 'renew', 'risk', 'churned'];
const STAGE_COLOR: Record<string, string> = {
  onboarding: 'secondary', adopt: 'default', expand: 'default',
  renew: 'default', risk: 'destructive', churned: 'destructive',
};

export default function CustomerHealth() {
  const [rows, setRows] = useState<Health[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    let q = supabase.from('ac_customer_health' as any).select('*').order('score', { ascending: true }).limit(300);
    if (stage !== 'all') q = q.eq('lifecycle_stage', stage);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [stage]);

  const compute = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('ac-health-score', { body: { limit: 2000 } });
      if (error) throw error;
      toast.success('Health-Scores neu berechnet');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const kpi = {
    total: rows.length,
    atRisk: rows.filter(r => r.lifecycle_stage === 'risk' || r.lifecycle_stage === 'churned').length,
    healthy: rows.filter(r => r.score >= 75).length,
    avg: rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0,
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader title="Customer Health & Lifecycle" subtitle="Health-Score (0-100), Lifecycle-Stage & Playbook-Trigger" icon={HeartPulse} noBreadcrumbs
        actions={<Button size="sm" onClick={compute} disabled={running}><RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />Neu berechnen</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Kunden gescored" value={kpi.total} icon={Users} accent="sky" />
        <KpiTile label="At-Risk / Churned" value={kpi.atRisk} icon={AlertTriangle} accent="gold" />
        <KpiTile label="Gesund (≥75)" value={kpi.healthy} icon={TrendingUp} accent="emerald" />
        <KpiTile label="Ø Score" value={kpi.avg.toFixed(0)} icon={HeartPulse} accent="violet" />
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant={stage === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStage('all')}>Alle</Button>
        {STAGES.map(s => (
          <Button key={s} variant={stage === s ? 'default' : 'outline'} size="sm" onClick={() => setStage(s)}>{s}</Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Kunden (niedrigster Score zuerst)</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Lädt…</div> : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Scores. „Neu berechnen" klicken.</div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead><TableHead>Stage</TableHead><TableHead>Kunde</TableHead>
                    <TableHead>Nutzung</TableHead><TableHead>Zahlung</TableHead><TableHead>Support</TableHead><TableHead>Sentiment</TableHead>
                    <TableHead>Berechnet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-bold">{r.score}</TableCell>
                      <TableCell><Badge variant={STAGE_COLOR[r.lifecycle_stage] as any}>{r.lifecycle_stage}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.customer_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs">{r.usage_score}</TableCell>
                      <TableCell className="text-xs">{r.payment_score}</TableCell>
                      <TableCell className="text-xs">{r.support_score}</TableCell>
                      <TableCell className="text-xs">{r.sentiment_score}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.computed_at).toLocaleDateString('de-DE')}</TableCell>
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
