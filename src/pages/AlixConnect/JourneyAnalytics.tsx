import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitBranch, TrendingDown, Users, Layers, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type Funnel = { stage: string; count: number };

export default function AlixConnectJourneyAnalytics() {
  const [funnel, setFunnel] = useState<Funnel[]>([]);
  const [convos, setConvos] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [attribution, setAttribution] = useState<any[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [newSeg, setNewSeg] = useState({ name: '', description: '', minTouchpoints: 3 });

  const load = async () => {
    setLoading(true);
    const [f, c, s, at, co] = await Promise.all([
      supabase.rpc('ac_journey_funnel', { days_back: days }),
      supabase.from('ac_conversations').select('id, channel_type, status, created_at, closed_at, ai_sentiment').order('created_at', { ascending: false }).limit(500),
      supabase.from('ac_journey_segments').select('*').order('updated_at', { ascending: false }),
      supabase.rpc('ac_journey_attribution', { days_back: days }),
      supabase.rpc('ac_journey_cohorts', { weeks: 8 }),
    ]);
    setFunnel(((f.data as any) ?? []).map((r: any) => ({ stage: r.stage, count: Number(r.count) })));
    setConvos((c.data as any) ?? []);
    setSegments((s.data as any) ?? []);
    setAttribution((at.data as any) ?? []);
    setCohorts((co.data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [days]);

  const addSegment = async () => {
    if (!newSeg.name.trim()) return toast.error('Name fehlt');
    const { error } = await supabase.from('ac_journey_segments').insert({
      name: newSeg.name, description: newSeg.description,
      criteria: { min_touchpoints: newSeg.minTouchpoints },
    });
    if (error) return toast.error(error.message);
    setNewSeg({ name: '', description: '', minTouchpoints: 3 });
    toast.success('Segment angelegt'); load();
  };
  const deleteSegment = async (id: string) => {
    if (!confirm('Segment löschen?')) return;
    const { error } = await supabase.from('ac_journey_segments').delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const max = Math.max(1, ...funnel.map(f => f.count));
  const byChannel = convos.reduce((acc: any, c: any) => { acc[c.channel_type ?? 'unknown'] = (acc[c.channel_type ?? 'unknown'] ?? 0) + 1; return acc; }, {});
  const closed = convos.filter(c => c.closed_at).length;
  const closeRate = convos.length ? Math.round((closed / convos.length) * 100) : 0;
  const negSent = convos.filter(c => c.ai_sentiment === 'negative').length;
  const churnRisk = convos.length ? Math.round((negSent / convos.length) * 100) : 0;
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

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Event-Funnel (Top-Stages, {days} Tage)</div>
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
        <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Journey-Segmente ({segments.length})</div>
        <div className="grid md:grid-cols-4 gap-2 mb-3">
          <Input placeholder="Segment-Name" value={newSeg.name} onChange={e => setNewSeg({ ...newSeg, name: e.target.value })} />
          <Input placeholder="Beschreibung" value={newSeg.description} onChange={e => setNewSeg({ ...newSeg, description: e.target.value })} />
          <Input type="number" min={1} placeholder="Min. Touchpoints" value={newSeg.minTouchpoints} onChange={e => setNewSeg({ ...newSeg, minTouchpoints: Number(e.target.value) })} />
          <Button onClick={addSegment}><Plus className="h-4 w-4 mr-1" />Anlegen</Button>
        </div>
        <div className="space-y-1">
          {segments.length === 0 && <div className="text-xs text-muted-foreground">Keine Segmente definiert.</div>}
          {segments.map(s => (
            <div key={s.id} className="flex items-center justify-between border-b py-1.5 text-sm">
              <div>
                <div className="font-medium">{s.name} <Badge variant="outline" className="ml-2">{s.member_count} Mitglieder</Badge></div>
                <div className="text-xs text-muted-foreground">{s.description || '—'} · Kriterien: {JSON.stringify(s.criteria)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => deleteSegment(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Attribution ({days} Tage) – First / Last / Linear-Touch</div>
        {attribution.length === 0 ? <div className="text-xs text-muted-foreground">Keine Conversions im Zeitraum.</div> : (
          <div className="space-y-2">
            {attribution.map((a: any) => (
              <div key={a.source}>
                <div className="flex justify-between text-xs mb-1"><span className="font-medium">{a.source}</span><span>First {a.first_touch} · Last {a.last_touch} · Linear {a.linear_touch}</span></div>
                <div className="h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${(Number(a.last_touch) / maxAttr) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-3">Kohorten-Retention (wöchentlich, letzte 8 Wochen)</div>
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
