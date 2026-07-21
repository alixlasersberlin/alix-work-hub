import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Trophy, TrendingUp, Users, MessageSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type QaRow = {
  id: string;
  conversation_id: string;
  agent_user_id: string | null;
  overall_score: number;
  greeting_score: number | null;
  empathy_score: number | null;
  resolution_score: number | null;
  compliance_score: number | null;
  tone_score: number | null;
  first_response_seconds: number | null;
  resolution_seconds: number | null;
  strengths: string[];
  improvements: string[];
  summary: string | null;
  created_at: string;
};

const scoreColor = (s: number | null) => {
  if (s == null) return 'text-muted-foreground';
  if (s >= 85) return 'text-emerald-500';
  if (s >= 70) return 'text-amber-500';
  return 'text-rose-500';
};

export default function ConversationQA() {
  const [rows, setRows] = useState<QaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<QaRow | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ac_conversation_qa' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    const list = ((data ?? []) as any as QaRow[]);
    setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.agent_user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: p } = await supabase.from('user_profiles').select('user_id, full_name, email').in('user_id', ids);
      const map: Record<string, string> = {};
      (p ?? []).forEach((r: any) => { map[r.user_id] = r.full_name || r.email || r.user_id.slice(0, 8); });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runBatch = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ac-conversation-qa', {
        body: { batch_limit: 25, since_hours: 168 },
      });
      if (error) throw error;
      toast.success(`Batch analysiert: ${(data as any)?.evaluated ?? 0} Conversations`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Fehler');
    } finally {
      setRunning(false);
    }
  };

  const kpis = useMemo(() => {
    const n = rows.length;
    const avg = n ? rows.reduce((a, r) => a + Number(r.overall_score || 0), 0) / n : 0;
    const top = n ? Math.max(...rows.map((r) => Number(r.overall_score || 0))) : 0;
    const critical = rows.filter((r) => Number(r.overall_score || 0) < 60).length;
    return { n, avg, top, critical };
  }, [rows]);

  const leaderboard = useMemo(() => {
    const grp: Record<string, { total: number; count: number }> = {};
    rows.forEach((r) => {
      const k = r.agent_user_id ?? 'unassigned';
      grp[k] = grp[k] ?? { total: 0, count: 0 };
      grp[k].total += Number(r.overall_score || 0);
      grp[k].count += 1;
    });
    return Object.entries(grp)
      .map(([k, v]) => ({ agent: k, avg: v.total / v.count, count: v.count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conversation QA</h1>
          <p className="text-muted-foreground">Automatische Qualitäts- & Coaching-Analyse aller geschlossenen Conversations</p>
        </div>
        <Button onClick={runBatch} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Batch analysieren
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><MessageSquare className="h-4 w-4" />Bewertete</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{kpis.n}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Ø Score</CardTitle></CardHeader><CardContent className={`text-2xl font-bold ${scoreColor(kpis.avg)}`}>{kpis.avg.toFixed(1)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4" />Top Score</CardTitle></CardHeader><CardContent className={`text-2xl font-bold ${scoreColor(kpis.top)}`}>{kpis.top.toFixed(1)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Kritisch (&lt;60)</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-rose-500">{kpis.critical}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Agent-Leaderboard</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Agent</TableHead><TableHead>Ø Score</TableHead><TableHead>Bewertete</TableHead></TableRow></TableHeader>
            <TableBody>
              {leaderboard.map((l, i) => (
                <TableRow key={l.agent}>
                  <TableCell className="font-bold">{i + 1}</TableCell>
                  <TableCell>{l.agent === 'unassigned' ? <span className="text-muted-foreground">– nicht zugewiesen –</span> : (profiles[l.agent] ?? l.agent.slice(0, 8))}</TableCell>
                  <TableCell className={scoreColor(l.avg)}>{l.avg.toFixed(1)}</TableCell>
                  <TableCell>{l.count}</TableCell>
                </TableRow>
              ))}
              {!leaderboard.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Noch keine Daten</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Aktuelle Bewertungen</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="text-center py-8"><Loader2 className="animate-spin inline" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Zeit</TableHead><TableHead>Agent</TableHead>
                <TableHead>Overall</TableHead><TableHead>Begr.</TableHead>
                <TableHead>Empathie</TableHead><TableHead>Lösung</TableHead>
                <TableHead>Compl.</TableHead><TableHead>Ton</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell>{r.agent_user_id ? (profiles[r.agent_user_id] ?? r.agent_user_id.slice(0, 8)) : '–'}</TableCell>
                    <TableCell className={`font-bold ${scoreColor(r.overall_score)}`}>{Number(r.overall_score).toFixed(0)}</TableCell>
                    <TableCell className={scoreColor(r.greeting_score)}>{r.greeting_score?.toFixed(0) ?? '–'}</TableCell>
                    <TableCell className={scoreColor(r.empathy_score)}>{r.empathy_score?.toFixed(0) ?? '–'}</TableCell>
                    <TableCell className={scoreColor(r.resolution_score)}>{r.resolution_score?.toFixed(0) ?? '–'}</TableCell>
                    <TableCell className={scoreColor(r.compliance_score)}>{r.compliance_score?.toFixed(0) ?? '–'}</TableCell>
                    <TableCell className={scoreColor(r.tone_score)}>{r.tone_score?.toFixed(0) ?? '–'}</TableCell>
                    <TableCell><Badge variant="outline">Details</Badge></TableCell>
                  </TableRow>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Noch keine Bewertungen. Klick auf „Batch analysieren".</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card className="fixed inset-4 md:inset-16 z-50 overflow-auto shadow-2xl">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>QA-Details</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Conversation {selected.conversation_id.slice(0, 8)}… · {new Date(selected.created_at).toLocaleString('de-DE')}</p>
            </div>
            <Button variant="ghost" onClick={() => setSelected(null)}>Schließen</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-6 gap-2 text-center">
              {[
                ['Overall', selected.overall_score],
                ['Begrüßung', selected.greeting_score],
                ['Empathie', selected.empathy_score],
                ['Lösung', selected.resolution_score],
                ['Compliance', selected.compliance_score],
                ['Ton', selected.tone_score],
              ].map(([l, v]) => (
                <div key={l as string} className="p-3 rounded border">
                  <div className="text-xs text-muted-foreground">{l}</div>
                  <div className={`text-2xl font-bold ${scoreColor(v as number | null)}`}>{v != null ? Number(v).toFixed(0) : '–'}</div>
                </div>
              ))}
            </div>
            {selected.summary && <div><h4 className="font-semibold mb-1">Zusammenfassung</h4><p className="text-sm">{selected.summary}</p></div>}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-1 text-emerald-500">Stärken</h4>
                <ul className="list-disc list-inside text-sm space-y-1">{selected.strengths?.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1 text-amber-500">Verbesserungen</h4>
                <ul className="list-disc list-inside text-sm space-y-1">{selected.improvements?.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Erst-Antwort: <b>{selected.first_response_seconds != null ? `${Math.round(selected.first_response_seconds / 60)} min` : '–'}</b></div>
              <div>Lösung-Dauer: <b>{selected.resolution_seconds != null ? `${Math.round(selected.resolution_seconds / 3600)} h` : '–'}</b></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
