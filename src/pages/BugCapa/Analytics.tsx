import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Section } from './_shared';
import { BarChart3, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface TrendRow { day: string; kind: 'bug' | 'capa' | 'finding'; cnt: number }
interface Mttr { mttr_days_all: number | null; mttr_days_90d: number | null; closed_total: number; open_total: number; effective_count: number; ineffective_count: number }
interface Overdue { id: string; ticket_number?: string; capa_number?: string; title: string; overdue_days: number; due_date: string; priority?: string; status: string }

export default function BugCapaAnalytics() {
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [mttr, setMttr] = useState<Mttr | null>(null);
  const [bugsOverdue, setBugsOverdue] = useState<Overdue[]>([]);
  const [capasOverdue, setCapasOverdue] = useState<Overdue[]>([]);

  useEffect(() => { (async () => {
    const sb = supabase as any;
    const [t, m, b, c] = await Promise.all([
      sb.from('bug_capa_trend_30d').select('*'),
      sb.from('capa_mttr_stats').select('*').single(),
      sb.from('bug_overdue').select('*').limit(50),
      sb.from('capa_overdue').select('*').limit(50),
    ]);
    setTrend(t.data ?? []); setMttr(m.data ?? null);
    setBugsOverdue(b.data ?? []); setCapasOverdue(c.data ?? []);
  })(); }, []);

  const days = Array.from(new Set(trend.map(r => r.day))).sort();
  const maxCnt = Math.max(1, ...trend.map(r => r.cnt));
  const kindColor = { bug: 'bg-red-500', capa: 'bg-amber-500', finding: 'bg-blue-500' } as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="MTTR (Alle CAPAs)" value={mttr?.mttr_days_all != null ? `${mttr.mttr_days_all} d` : '–'} icon={Clock} />
        <Kpi label="MTTR (letzte 90 d)" value={mttr?.mttr_days_90d != null ? `${mttr.mttr_days_90d} d` : '–'} icon={TrendingUp} />
        <Kpi label="CAPAs geschlossen" value={mttr?.closed_total ?? 0} icon={BarChart3} />
        <Kpi label="Wirksamkeit OK / NOK" value={`${mttr?.effective_count ?? 0} / ${mttr?.ineffective_count ?? 0}`} icon={BarChart3} />
        <Kpi label="Überfällige Bugs" value={bugsOverdue.length} icon={AlertTriangle} tone={bugsOverdue.length ? 'red' : 'green'} />
        <Kpi label="Überfällige CAPAs" value={capasOverdue.length} icon={AlertTriangle} tone={capasOverdue.length ? 'red' : 'green'} />
        <Kpi label="CAPAs offen" value={mttr?.open_total ?? 0} />
      </div>

      <Section title="Aktivitäts-Trend · letzte 30 Tage">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-[2px] h-40">
              {days.map(d => {
                const bug = trend.find(r => r.day === d && r.kind === 'bug')?.cnt ?? 0;
                const capa = trend.find(r => r.day === d && r.kind === 'capa')?.cnt ?? 0;
                const finding = trend.find(r => r.day === d && r.kind === 'finding')?.cnt ?? 0;
                return (
                  <div key={d} className="flex-1 flex flex-col justify-end gap-[1px] group relative" title={`${d} · bug:${bug} capa:${capa} finding:${finding}`}>
                    {finding > 0 && <div className={kindColor.finding} style={{ height: `${(finding / maxCnt) * 100}%` }} />}
                    {capa > 0 && <div className={kindColor.capa} style={{ height: `${(capa / maxCnt) * 100}%` }} />}
                    {bug > 0 && <div className={kindColor.bug} style={{ height: `${(bug / maxCnt) * 100}%` }} />}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 text-xs mt-3">
              <Legend color={kindColor.bug} label="Bugs" />
              <Legend color={kindColor.capa} label="CAPAs" />
              <Legend color={kindColor.finding} label="Audit-Findings" />
            </div>
          </CardContent>
        </Card>
      </Section>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Überfällige Bugs</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {bugsOverdue.length === 0 && <p className="text-sm text-muted-foreground">Keine überfälligen Bugs.</p>}
            {bugsOverdue.map(b => (
              <div key={b.id} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                <Badge variant="outline" className="text-xs">{b.ticket_number}</Badge>
                <span className="flex-1 truncate">{b.title}</span>
                {b.priority && <Badge variant="secondary" className="text-xs">{b.priority}</Badge>}
                <span className="text-xs text-red-400 font-medium">{b.overdue_days} d</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Überfällige CAPAs</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {capasOverdue.length === 0 && <p className="text-sm text-muted-foreground">Keine überfälligen CAPAs.</p>}
            {capasOverdue.map(c => (
              <div key={c.id} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                <Badge variant="outline" className="text-xs">{c.capa_number}</Badge>
                <span className="flex-1 truncate">{c.title}</span>
                <Badge variant="secondary" className="text-xs">{c.status}</Badge>
                <span className="text-xs text-red-400 font-medium">{c.overdue_days} d</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: any) {
  const cls = tone === 'red' ? 'text-red-400 border-red-500/40 bg-red-500/5' : tone === 'green' ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/5' : '';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}{label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${color}`} />{label}</div>;
}
