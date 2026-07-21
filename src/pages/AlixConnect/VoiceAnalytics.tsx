import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mic, RefreshCw, ShieldCheck, ShieldAlert, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/infinity/PageHeader';
import { KpiTile } from '@/components/infinity/KpiTile';

type Insight = {
  id: string; call_id: string; agent_user_id: string | null;
  keywords: string[]; topics: string[];
  compliance_phrases_found: string[]; compliance_phrases_missing: string[];
  talk_ratio_agent: number | null; talk_ratio_customer: number | null;
  emotion_agent: string | null; emotion_customer: string | null;
  duration_seconds: number | null; language: string | null;
  created_at: string;
};

export default function VoiceAnalytics() {
  const [rows, setRows] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ac_voice_insights' as any).select('*').order('created_at', { ascending: false }).limit(200);
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const analyze = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke('ac-voice-analyze', { body: { limit: 200 } });
      if (error) throw error;
      toast.success('Voice-Analyse abgeschlossen');
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  };

  const missingCount = rows.reduce((s, r) => s + (r.compliance_phrases_missing?.length ?? 0), 0);
  const avgTalkAgent = rows.length ? rows.reduce((s, r) => s + Number(r.talk_ratio_agent ?? 0), 0) / rows.length : 0;
  const negatives = rows.filter(r => r.emotion_customer === 'frustrated').length;

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <PageHeader title="Voice Analytics" subtitle="Transkription, Keywords, Compliance & Talk-Ratio pro Anruf" icon={Mic} noBreadcrumbs
        actions={<Button size="sm" onClick={analyze} disabled={running}><RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} />Analyse starten</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Analysierte Calls" value={rows.length} icon={Mic} accent="sky" />
        <KpiTile label="Compliance fehlend" value={missingCount} icon={ShieldAlert} accent="gold" />
        <KpiTile label="Ø Agent-Talk-Ratio" value={`${(avgTalkAgent * 100).toFixed(0)}%`} icon={Volume2} accent="emerald" />
        <KpiTile label="Frustrierte Kunden" value={negatives} icon={ShieldCheck} accent="violet" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Letzte Analysen</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Lädt…</div> : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Keine Insights. „Analyse starten" klicken (benötigt Calls mit transcript).</div>
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Call</TableHead><TableHead>Topics</TableHead><TableHead>Keywords</TableHead><TableHead>Talk-Ratio</TableHead><TableHead>Compliance</TableHead><TableHead>Emotion</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.call_id.slice(0, 8)}…<div className="text-muted-foreground">{r.duration_seconds ?? 0}s · {r.language ?? 'de'}</div></TableCell>
                      <TableCell><div className="flex gap-1 flex-wrap">{(r.topics ?? []).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div></TableCell>
                      <TableCell className="text-xs">{(r.keywords ?? []).slice(0, 5).join(', ')}</TableCell>
                      <TableCell className="text-xs font-mono">A {((r.talk_ratio_agent ?? 0) * 100).toFixed(0)}% / K {((r.talk_ratio_customer ?? 0) * 100).toFixed(0)}%</TableCell>
                      <TableCell>
                        {(r.compliance_phrases_missing ?? []).length > 0
                          ? <Badge variant="destructive" className="text-xs">{r.compliance_phrases_missing.length} fehlen</Badge>
                          : <Badge variant="secondary" className="text-xs">OK</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{r.emotion_customer ?? '—'}</TableCell>
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
