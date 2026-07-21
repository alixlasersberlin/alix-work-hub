import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Download, FileBarChart } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts';

type Snapshot = { id: string; period_start: string; period_end: string; kpis: any; created_at: string };

export default function Cockpit() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [days, setDays] = useState(30);

  async function loadLatest() {
    setLoading(true);
    const { data } = await supabase.from('ac_report_snapshots').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
    setSnap(data as any);
    setLoading(false);
  }
  useEffect(() => { loadLatest(); }, []);

  async function generate() {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke('ac-report-snapshot', { body: { days } });
    setRunning(false);
    if (error || (data as any)?.error) { toast.error((error?.message) || (data as any)?.error || 'Fehler'); return; }
    toast.success('Snapshot erstellt');
    loadLatest();
  }

  function exportCsv() {
    if (!snap) return;
    const rows = [
      ['metric', 'value'],
      ['period_start', snap.period_start],
      ['period_end', snap.period_end],
      ['calls_total', snap.kpis.calls?.total],
      ['calls_missed', snap.kpis.calls?.missed],
      ['calls_answered_rate', snap.kpis.calls?.answered_rate],
      ['calls_avg_duration_sec', snap.kpis.calls?.avg_duration_sec],
      ['messages_total', snap.kpis.messages?.total],
      ['tickets_total', snap.kpis.tickets?.total],
      ['tickets_resolved', snap.kpis.tickets?.resolved],
      ['tickets_avg_ttr_hours', snap.kpis.tickets?.avg_ttr_hours],
      ['meetings_total', snap.kpis.meetings?.total],
    ];
    const csv = rows.map(r => r.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `cockpit_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const channelData = snap ? Object.entries(snap.kpis.messages?.by_channel ?? {}).map(([k, v]) => ({ name: k, value: v as number })) : [];
  const sentimentData = snap ? Object.entries(snap.kpis.calls?.sentiment ?? {}).map(([k, v]) => ({ name: k, value: v as number })) : [];
  const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

  return (
    <div className="p-6 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><FileBarChart className="w-5 h-5 text-primary" /> Executive Cockpit</h2>
          <p className="text-xs text-muted-foreground">Kanalübergreifende KPIs für Management-Reporting.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            <option value={7}>7 Tage</option>
            <option value={30}>30 Tage</option>
            <option value={90}>90 Tage</option>
          </select>
          <Button onClick={generate} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Snapshot erstellen
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!snap}><Download className="w-4 h-4 mr-1.5" />CSV</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div>
      ) : !snap ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Noch kein Snapshot. Klicken Sie auf „Snapshot erstellen".</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: 'Anrufe', v: snap.kpis.calls?.total ?? 0 },
              { l: 'Verpasst', v: snap.kpis.calls?.missed ?? 0 },
              { l: 'Ø Dauer (s)', v: snap.kpis.calls?.avg_duration_sec ?? 0 },
              { l: 'Beantwortet %', v: `${((snap.kpis.calls?.answered_rate ?? 0) * 100).toFixed(0)}%` },
              { l: 'Nachrichten', v: snap.kpis.messages?.total ?? 0 },
              { l: 'Tickets', v: snap.kpis.tickets?.total ?? 0 },
              { l: 'Ø TTR (h)', v: snap.kpis.tickets?.avg_ttr_hours ?? '—' },
              { l: 'Meetings', v: snap.kpis.meetings?.total ?? 0 },
            ].map((k) => (
              <Card key={k.l}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k.l}</p><p className="text-2xl font-semibold mt-1">{k.v}</p></CardContent></Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Nachrichten pro Kanal</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer>
                  <BarChart data={channelData}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="hsl(var(--primary))" /></BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Anruf-Sentiment</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer>
                  <PieChart><Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {sentimentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <p className="text-[11px] text-muted-foreground text-right">Snapshot vom {new Date(snap.created_at).toLocaleString('de-DE')} · Zeitraum {new Date(snap.period_start).toLocaleDateString('de-DE')} – {new Date(snap.period_end).toLocaleDateString('de-DE')}</p>
        </>
      )}
    </div>
  );
}
