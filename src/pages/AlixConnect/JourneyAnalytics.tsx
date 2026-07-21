import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, TrendingDown, Users, Layers, Plus, Trash2, Download, Zap } from 'lucide-react';
import { toast } from 'sonner';

type Funnel = { stage: string; count: number };
type Journey = { id: string; name: string };

const toCsv = (rows: any[]) => {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
};
const downloadCsv = (name: string, rows: any[]) => {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};

export default function AlixConnectJourneyAnalytics() {
  const [funnel, setFunnel] = useState<Funnel[]>([]);
  const [convos, setConvos] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [attribution, setAttribution] = useState<any[]>([]);
  const [attrExt, setAttrExt] = useState<any[]>([]);
  const [attrModel, setAttrModel] = useState<'linear' | 'first' | 'last' | 'time_decay' | 'position'>('linear');
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [newSeg, setNewSeg] = useState({ name: '', description: '', minTouchpoints: 3, autoJourney: '' });
  const [deflection, setDeflection] = useState<any>(null);
  const [deflBreakdown, setDeflBreakdown] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const from = new Date(Date.now() - days * 86400_000).toISOString();
    const to = new Date().toISOString();
    const [f, c, s, at, ae, co, dfl, dfb, jr] = await Promise.all([
      supabase.rpc('ac_journey_funnel', { days_back: days }),
      supabase.from('ac_conversations').select('id, channel_type, status, created_at, closed_at, ai_sentiment').order('created_at', { ascending: false }).limit(500),
      supabase.from('ac_journey_segments').select('*').order('updated_at', { ascending: false }),
      supabase.rpc('ac_journey_attribution', { days_back: days }),
      supabase.rpc('ac_journey_attribution_ext', { _from: from, _to: to, _model: attrModel }),
      supabase.rpc('ac_journey_cohorts', { weeks: 8 }),
      supabase.rpc('ac_portal_deflection', { days_back: days }),
      supabase.rpc('ac_portal_deflection_breakdown', { _from: from, _to: to }),
      supabase.from('ac_journeys').select('id, name').order('name'),
    ]);
    setFunnel(((f.data as any) ?? []).map((r: any) => ({ stage: r.stage, count: Number(r.count) })));
    setConvos((c.data as any) ?? []);
    setSegments((s.data as any) ?? []);
    setAttribution((at.data as any) ?? []);
    setAttrExt((ae.data as any) ?? []);
    setCohorts((co.data as any) ?? []);
    setDeflection(((dfl.data as any) ?? [])[0] ?? null);
    setDeflBreakdown((dfb.data as any) ?? []);
    setJourneys((jr.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [days, attrModel]);

  const addSegment = async () => {
    if (!newSeg.name.trim()) return toast.error('Name fehlt');
    const { error } = await supabase.from('ac_journey_segments').insert({
      name: newSeg.name, description: newSeg.description,
      criteria: { min_touchpoints: newSeg.minTouchpoints },
      auto_enroll_journey_id: newSeg.autoJourney || null,
    });
    if (error) return toast.error(error.message);
    setNewSeg({ name: '', description: '', minTouchpoints: 3, autoJourney: '' });
    toast.success('Segment angelegt'); load();
  };
  const deleteSegment = async (id: string) => {
    if (!confirm('Segment löschen?')) return;
    const { error } = await supabase.from('ac_journey_segments').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };
  const runAutoEnroll = async () => {
    const t = toast.loading('Auto-Enroll läuft…');
    const { data, error } = await supabase.functions.invoke('ac-segment-auto-enroll');
    toast.dismiss(t);
    if (error) return toast.error(error.message);
    toast.success(`${(data as any)?.enrolled ?? 0} Kontakte in Journeys aufgenommen`); load();
  };

  const max = Math.max(1, ...funnel.map(f => f.count));
  const byChannel = convos.reduce((acc: any, c: any) => { acc[c.channel_type ?? 'unknown'] = (acc[c.channel_type ?? 'unknown'] ?? 0) + 1; return acc; }, {});
  const closed = convos.filter(c => c.closed_at).length;
  const closeRate = convos.length ? Math.round((closed / convos.length) * 100) : 0;
  const negSent = convos.filter(c => c.ai_sentiment === 'negative').length;
  const churnRisk = convos.length ? Math.round((negSent / convos.length) * 100) : 0;
  const maxAttrExt = Math.max(1, ...attrExt.map((a: any) => Number(a.conversions) || 0));
  const maxAttr = Math.max(1, ...attribution.map((a: any) => Number(a.last_touch) || 0));

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /> Customer Journey Analytics <Badge variant="outline">Phase 25</Badge></h2>
          <p className="text-sm text-muted-foreground">Touchpoint-Funnel, Kanal-Attribution, Churn-Risiko.</p>
        </div>
        <select className="border rounded px-2 py-1.5 text-sm bg-background" value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={7}>7 Tage</option><option value={30}>30 Tage</option><option value={90}>90 Tage</option>
        </select>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Konversationen</div><div className="text-2xl font-semibold">{convos.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Close-Rate</div><div className="text-2xl font-semibold">{closeRate}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3" />Churn-Risiko (neg. Sentiment)</div><div className="text-2xl font-semibold">{churnRisk}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Aktive Kanäle</div><div className="text-2xl font-semibold">{Object.keys(byChannel).length}</div></Card>
      </div>

      {deflection && (
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">Self-Service Portal – Deflection ({days} Tage)</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div><div className="text-xs text-muted-foreground">Sessions</div><div className="text-xl font-semibold">{deflection.total_sessions}</div></div>
            <div><div className="text-xs text-muted-foreground">Deflected</div><div className="text-xl font-semibold text-green-500">{deflection.deflected_sessions}</div></div>
            <div><div className="text-xs text-muted-foreground">Handoff → Ticket</div><div className="text-xl font-semibold">{deflection.handoff_sessions}</div></div>
            <div><div className="text-xs text-muted-foreground">Deflection-Rate</div><div className="text-xl font-semibold text-primary">{deflection.deflection_pct ?? 0}%</div></div>
            <div><div className="text-xs text-muted-foreground">Ø Messages/Session</div><div className="text-xl font-semibold">{deflection.avg_messages ?? 0}</div></div>
          </div>
        </Card>
      )}

      {deflection && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Self-Service Portal – Deflection ({days} Tage)</div>
            <Button size="sm" variant="outline" onClick={() => downloadCsv('deflection.csv', deflBreakdown)}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center mb-3">
            <div><div className="text-xs text-muted-foreground">Sessions</div><div className="text-xl font-semibold">{deflection.total_sessions}</div></div>
            <div><div className="text-xs text-muted-foreground">Deflected</div><div className="text-xl font-semibold text-green-500">{deflection.deflected_sessions}</div></div>
            <div><div className="text-xs text-muted-foreground">Handoff → Ticket</div><div className="text-xl font-semibold">{deflection.handoff_sessions}</div></div>
            <div><div className="text-xs text-muted-foreground">Deflection-Rate</div><div className="text-xl font-semibold text-primary">{deflection.deflection_pct ?? 0}%</div></div>
            <div><div className="text-xs text-muted-foreground">Ø Messages/Session</div><div className="text-xl font-semibold">{deflection.avg_messages ?? 0}</div></div>
          </div>
          {deflBreakdown.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-xs font-medium mb-2">Aufschlüsselung nach Kanal</div>
              <table className="text-xs w-full">
                <thead><tr className="text-muted-foreground"><th className="text-left py-1">Kanal</th><th className="text-right py-1">Sessions</th><th className="text-right py-1">Handoffs</th><th className="text-right py-1">Deflection</th><th className="text-right py-1">Ø CSAT</th></tr></thead>
                <tbody>{deflBreakdown.map((r: any) => (
                  <tr key={r.bucket} className="border-t"><td className="py-1 font-medium">{r.bucket}</td><td className="text-right">{r.sessions}</td><td className="text-right">{r.handoffs}</td><td className="text-right text-primary">{r.deflection_rate ?? 0}%</td><td className="text-right">{r.avg_csat ?? '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Event-Funnel ({days} Tage)</div>
          <Button size="sm" variant="outline" onClick={() => downloadCsv('funnel.csv', funnel)}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
        </div>
        {loading ? <div className="text-xs text-muted-foreground">Lade…</div> : funnel.length === 0 ? <div className="text-xs text-muted-foreground">Keine Events.</div> : (
          <div className="space-y-2">
            {funnel.map(f => (
              <div key={f.stage}>
                <div className="flex justify-between text-xs mb-1"><span className="font-medium">{f.stage}</span><span>{f.count}</span></div>
                <div className="h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${(f.count / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Kanal-Verteilung</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(byChannel).map(([ch, n]: any) => (
            <div key={ch} className="border rounded p-3 text-center"><div className="text-xs text-muted-foreground">{ch}</div><div className="text-lg font-semibold">{n}</div></div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Journey-Segmente ({segments.length})</div>
          <Button size="sm" variant="outline" onClick={runAutoEnroll}><Zap className="h-3.5 w-3.5 mr-1" />Auto-Enroll ausführen</Button>
        </div>
        <div className="grid md:grid-cols-5 gap-2 mb-3">
          <Input placeholder="Name" value={newSeg.name} onChange={e => setNewSeg({ ...newSeg, name: e.target.value })} />
          <Input placeholder="Beschreibung" value={newSeg.description} onChange={e => setNewSeg({ ...newSeg, description: e.target.value })} />
          <Input type="number" min={1} placeholder="Min. Touch" value={newSeg.minTouchpoints} onChange={e => setNewSeg({ ...newSeg, minTouchpoints: Number(e.target.value) })} />
          <select className="border rounded px-2 py-1.5 text-sm bg-background" value={newSeg.autoJourney} onChange={e => setNewSeg({ ...newSeg, autoJourney: e.target.value })}>
            <option value="">Auto-Journey (optional)</option>
            {journeys.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <Button onClick={addSegment}><Plus className="h-4 w-4 mr-1" />Anlegen</Button>
        </div>
        <div className="space-y-1">
          {segments.length === 0 && <div className="text-xs text-muted-foreground">Keine Segmente.</div>}
          {segments.map(s => (
            <div key={s.id} className="flex items-center justify-between border-b py-1.5 text-sm">
              <div>
                <div className="font-medium">{s.name} <Badge variant="outline" className="ml-2">{s.member_count} Mitglieder</Badge>{s.auto_enroll_journey_id && <Badge variant="secondary" className="ml-1">auto → {journeys.find(j => j.id === s.auto_enroll_journey_id)?.name ?? 'Journey'}</Badge>}</div>
                <div className="text-xs text-muted-foreground">{s.description || '—'} · {JSON.stringify(s.criteria)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deleteSegment(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Attribution ({days} Tage) – Modell:</div>
          <div className="flex gap-2">
            <select className="border rounded px-2 py-1 text-xs bg-background" value={attrModel} onChange={e => setAttrModel(e.target.value as any)}>
              <option value="linear">Linear</option><option value="first">First-Touch</option><option value="last">Last-Touch</option><option value="time_decay">Time-Decay</option><option value="position">Position-Based</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => downloadCsv(`attribution-${attrModel}.csv`, attrExt)}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          </div>
        </div>
        {attrExt.length === 0 ? <div className="text-xs text-muted-foreground">Keine Attribution-Daten im Zeitraum.</div> : (
          <div className="space-y-2">
            {attrExt.map((a: any) => (
              <div key={a.channel}>
                <div className="flex justify-between text-xs mb-1"><span className="font-medium">{a.channel}</span><span>{a.conversions}</span></div>
                <div className="h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${(Number(a.conversions) / maxAttrExt) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
        {attribution.length > 0 && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Klassische First/Last/Linear-Aufschlüsselung anzeigen</summary>
            <div className="space-y-2 mt-2">
              {attribution.map((a: any) => (
                <div key={a.source}>
                  <div className="flex justify-between text-xs mb-1"><span className="font-medium">{a.source}</span><span>First {a.first_touch} · Last {a.last_touch} · Linear {a.linear_touch}</span></div>
                  <div className="h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${(Number(a.last_touch) / maxAttr) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </details>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Kohorten-Retention (wöchentlich, letzte 8 Wochen)</div>
          <Button size="sm" variant="outline" onClick={() => downloadCsv('cohorts.csv', cohorts)}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
        </div>
        {cohorts.length === 0 ? <div className="text-xs text-muted-foreground">Keine Kohorten-Daten.</div> : (
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead><tr><th className="text-left p-1">Kohorte</th><th className="text-left p-1">Größe</th>{[0,1,2,3,4,5,6,7].map(w => <th key={w} className="p-1 text-center">W+{w}</th>)}</tr></thead>
              <tbody>
                {Object.values(cohorts.reduce((acc: any, r: any) => { (acc[r.cohort_week] ??= { cohort: r.cohort_week, size: r.cohort_size, cells: {} }).cells[r.week_offset] = r.retention_pct; return acc; }, {})).map((row: any) => (
                  <tr key={row.cohort} className="border-t">
                    <td className="p-1 font-medium">{row.cohort}</td>
                    <td className="p-1">{row.size}</td>
                    {[0,1,2,3,4,5,6,7].map(w => {
                      const v = row.cells[w]; const bg = v ? `hsl(var(--primary) / ${Math.min(1, Number(v)/100)})` : 'transparent';
                      return <td key={w} className="p-1 text-center" style={{ backgroundColor: bg }}>{v ? `${v}%` : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
