import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GraduationCap, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

type Ev = {
  id: string; agent_user_id: string; percent: number; ai_generated: boolean;
  coaching_required: boolean; status: string; scores: any; notes: string | null;
  created_at: string;
};

export default function QualityCoaching() {
  const [rows, setRows] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [recommending, setRecommending] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ac_qm_evaluations' as any)
      .select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  const runAutoQa = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('ac-qm-auto-score', { body: { limit: 50 } });
    if (error) toast.error(error.message);
    else toast.success(`Auto-QA: ${data?.scored ?? 0} bewertet`);
    setRunning(false);
    load();
  };

  const recommend = async (agentId: string) => {
    setRecommending(agentId);
    const { data, error } = await supabase.functions.invoke('ac-qm-coaching-recommend', { body: { agent_user_id: agentId } });
    if (error) toast.error(error.message);
    else toast.success('Coaching-Empfehlung erstellt');
    setRecommending(null);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const avg = total ? rows.reduce((s, r) => s + Number(r.percent || 0), 0) / total : 0;
    const coaching = rows.filter(r => r.coaching_required).length;
    const ai = rows.filter(r => r.ai_generated).length;
    const perAgent = new Map<string, { count: number; sum: number; low: number }>();
    for (const r of rows) {
      const cur = perAgent.get(r.agent_user_id) ?? { count: 0, sum: 0, low: 0 };
      cur.count++; cur.sum += Number(r.percent || 0);
      if (Number(r.percent) < 70) cur.low++;
      perAgent.set(r.agent_user_id, cur);
    }
    const gaps = [...perAgent.entries()]
      .map(([id, v]) => ({ id, avg: v.sum / v.count, count: v.count, low: v.low }))
      .filter(x => x.count >= 3)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 10);
    return { total, avg, coaching, ai, gaps };
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="AI Quality & Coaching"
        subtitle="Auto-QA für 100% aller Gespräche · Scorecards · Skill-Gaps · KI-Coaching-Empfehlungen"
        icon={<GraduationCap className="h-5 w-5" />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Laden</Button>
        <Button onClick={runAutoQa} disabled={running}><Sparkles className="mr-2 h-4 w-4" />Auto-QA Batch</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiTile label="Bewertungen" value={String(stats.total)} />
        <KpiTile label="Ø Score" value={`${stats.avg.toFixed(1)}%`} />
        <KpiTile label="Coaching offen" value={String(stats.coaching)} />
        <KpiTile label="davon AI" value={String(stats.ai)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Agent Skill-Gaps (niedrigster Ø)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Agent</TableHead><TableHead>Bewertungen</TableHead>
              <TableHead>&lt; 70%</TableHead><TableHead>Ø Score</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {stats.gaps.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="max-w-[220px] truncate text-xs">{g.id}</TableCell>
                  <TableCell className="text-xs">{g.count}</TableCell>
                  <TableCell><Badge variant={g.low > 0 ? 'destructive' : 'outline'}>{g.low}</Badge></TableCell>
                  <TableCell className="tabular-nums">{g.avg.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" disabled={recommending === g.id} onClick={() => recommend(g.id)}>
                      <Sparkles className="mr-1 h-3 w-3" />Coaching-Plan
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {stats.gaps.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground">Keine Daten</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Letzte Auswertungen</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead><TableHead>Agent</TableHead>
              <TableHead>Score</TableHead><TableHead>Status</TableHead><TableHead>Quelle</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.slice(0, 30).map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{r.agent_user_id}</TableCell>
                  <TableCell className="tabular-nums">
                    <Badge variant={Number(r.percent) >= 85 ? 'default' : Number(r.percent) >= 70 ? 'secondary' : 'destructive'}>
                      {Number(r.percent).toFixed(0)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.status}</TableCell>
                  <TableCell className="text-xs">{r.ai_generated ? 'AI' : 'Manuell'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
