import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mic, Sparkles, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

type Insight = {
  id: string; call_id: string; agent_user_id: string | null;
  topics: string[] | null; talk_ratio_agent: number | null; talk_ratio_customer: number | null;
  silence_share: number | null; compliance: Record<string, boolean> | null;
  summary: string | null; risk_flags: string[] | null; created_at: string;
};

export default function ConversationalIntelligence() {
  const [rows, setRows] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [callId, setCallId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ac_voice_insights' as any)
      .select('*').order('created_at', { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  const analyze = async () => {
    if (!callId.trim()) return toast.error('Call-ID erforderlich');
    setAnalyzing(true);
    const { error } = await supabase.functions.invoke('ac-conv-intel-analyze', { body: { call_id: callId.trim() } });
    if (error) toast.error(error.message); else { toast.success('Analyse erstellt'); setCallId(''); load(); }
    setAnalyzing(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const avgTalk = total ? rows.reduce((s, r) => s + Number(r.talk_ratio_agent || 0), 0) / total : 0;
    const avgSilence = total ? rows.reduce((s, r) => s + Number(r.silence_share || 0), 0) / total : 0;
    const risks = rows.filter(r => (r.risk_flags?.length ?? 0) > 0).length;
    const complianceIssues = rows.filter(r => r.compliance && Object.values(r.compliance).some(v => v === false)).length;
    return { total, avgTalk, avgSilence, risks, complianceIssues };
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Conversational Intelligence 2.0"
        subtitle="Topic-Detection · Talk/Listen-Ratio · Silence · DSGVO/Recording-Compliance über alle Anrufe"
        icon={Mic}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Call-ID analysieren…" value={callId} onChange={e => setCallId(e.target.value)} className="max-w-xs" />
        <Button onClick={analyze} disabled={analyzing}><Sparkles className="mr-2 h-4 w-4" />Analysieren</Button>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Laden</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <KpiTile label="Analysen" value={String(stats.total)} />
        <KpiTile label="Ø Agent-Talk" value={`${(stats.avgTalk * 100).toFixed(0)}%`} />
        <KpiTile label="Ø Silence" value={`${(stats.avgSilence * 100).toFixed(0)}%`} />
        <KpiTile label="Risk-Flags" value={String(stats.risks)} />
        <KpiTile label="Compliance-Issues" value={String(stats.complianceIssues)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Letzte Analysen</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Datum</TableHead><TableHead>Call</TableHead>
              <TableHead>Topics</TableHead><TableHead>Agent-Talk</TableHead>
              <TableHead>Silence</TableHead><TableHead>Compliance</TableHead><TableHead>Risk</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground">Lädt…</TableCell></TableRow>}
              {!loading && rows.slice(0, 50).map(r => {
                const comp = r.compliance ?? {};
                const fails = Object.entries(comp).filter(([, v]) => v === false).map(([k]) => k);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs">{r.call_id}</TableCell>
                    <TableCell className="text-xs">{(r.topics ?? []).slice(0, 3).join(', ') || '—'}</TableCell>
                    <TableCell className="tabular-nums text-xs">{((Number(r.talk_ratio_agent) || 0) * 100).toFixed(0)}%</TableCell>
                    <TableCell className="tabular-nums text-xs">{((Number(r.silence_share) || 0) * 100).toFixed(0)}%</TableCell>
                    <TableCell>{fails.length ? <Badge variant="destructive">{fails.length} Fail</Badge> : <Badge variant="outline">OK</Badge>}</TableCell>
                    <TableCell>{(r.risk_flags?.length ?? 0) > 0 ? <Badge variant="destructive">{r.risk_flags!.length}</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                  </TableRow>
                );
              })}
              {!loading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground">Noch keine Analysen</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
