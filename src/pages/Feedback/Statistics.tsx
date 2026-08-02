// Statistik pro Frage: Verteilungen, Durchschnitte, NPS und Freitextantworten.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeedbackHeader } from './_shared';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Download } from 'lucide-react';

type Q = { id: string; label: string; type: string; position: number };

export default function FeedbackStatistics() {
  const sb = supabase as any;
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyId, setSurveyId] = useState<string>('');
  const [questions, setQuestions] = useState<Q[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sb.from('surveys').select('id,name').is('deleted_at', null).order('created_at', { ascending: false })
      .then((r: any) => { setSurveys(r.data ?? []); if (r.data?.[0]) setSurveyId(r.data[0].id); });
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    if (!surveyId) return;
    (async () => {
      setLoading(true);
      const [{ data: qs }, { data: resp }] = await Promise.all([
        sb.from('survey_questions').select('id,label,type,position').eq('survey_id', surveyId).order('position'),
        sb.from('survey_responses').select('id,status,score_total,nps_score,duration_seconds,completed_at').eq('survey_id', surveyId).limit(2000),
      ]);
      setQuestions(qs ?? []);
      setResponses(resp ?? []);
      const ids = (resp ?? []).map((r: any) => r.id);
      let all: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await sb.from('survey_response_items').select('*').in('response_id', ids.slice(i, i + 200));
        all = all.concat(data ?? []);
      }
      setItems(all);
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, [surveyId]);

  const completed = responses.filter(r => r.status === 'abgeschlossen' || r.completed_at);
  const nps = useMemo(() => {
    const vals = responses.map(r => r.nps_score).filter((v: any) => typeof v === 'number');
    if (!vals.length) return null;
    const prom = vals.filter((v: number) => v >= 9).length;
    const det = vals.filter((v: number) => v <= 6).length;
    return Math.round(((prom - det) / vals.length) * 100);
  }, [responses]);

  const avgDuration = useMemo(() => {
    const vals = responses.map(r => r.duration_seconds).filter((v: any) => typeof v === 'number' && v > 0);
    return vals.length ? Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : null;
  }, [responses]);

  function statsFor(q: Q) {
    const rel = items.filter(i => i.question_id === q.id);
    const texts: string[] = [];
    const counts = new Map<string, number>();
    const numbers: number[] = [];
    for (const i of rel) {
      if (typeof i.value_number === 'number') { numbers.push(i.value_number); counts.set(String(i.value_number), (counts.get(String(i.value_number)) ?? 0) + 1); continue; }
      if (i.value_bool !== null && i.value_bool !== undefined) { const k = i.value_bool ? 'Ja' : 'Nein'; counts.set(k, (counts.get(k) ?? 0) + 1); continue; }
      if (Array.isArray(i.value_json)) { i.value_json.forEach((v: any) => counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)); continue; }
      if (i.value_text) {
        if (['text', 'textarea', 'freitext', 'long_text'].includes(q.type)) texts.push(i.value_text);
        else counts.set(i.value_text, (counts.get(i.value_text) ?? 0) + 1);
      }
    }
    const chart = Array.from(counts.entries())
      .sort((a, b) => (isNaN(Number(a[0])) || isNaN(Number(b[0])) ? b[1] - a[1] : Number(a[0]) - Number(b[0])))
      .map(([name, value]) => ({ name, value }));
    const avg = numbers.length ? (numbers.reduce((a, b) => a + b, 0) / numbers.length) : null;
    return { chart, texts, avg, count: rel.length };
  }

  function exportCsv() {
    const lines = [['Frage', 'Antwort', 'Anzahl'].join(';')];
    for (const q of questions) {
      const s = statsFor(q);
      s.chart.forEach(c => lines.push([q.label, c.name, c.value].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'umfrage-statistik.csv'; a.click();
  }

  return (
    <div className="space-y-5">
      <FeedbackHeader title="Statistik" subtitle="Auswertung je Frage mit Verteilungen und Durchschnitten"
        action={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />CSV Export</Button>} />

      <Select value={surveyId} onValueChange={setSurveyId}>
        <SelectTrigger className="w-80"><SelectValue placeholder="Umfrage wählen …" /></SelectTrigger>
        <SelectContent>{surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: 'Teilnahmen', v: responses.length },
          { l: 'Abgeschlossen', v: completed.length },
          { l: 'NPS', v: nps === null ? '–' : nps },
          { l: 'Ø Dauer', v: avgDuration ? `${Math.round(avgDuration / 60)} min` : '–' },
        ].map(k => (
          <Card key={k.l}><CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.l}</div>
            <div className="text-2xl font-semibold mt-1">{k.v}</div>
          </CardContent></Card>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Lade Auswertung …</p>}

      <div className="space-y-4">
        {questions.map(q => {
          const s = statsFor(q);
          return (
            <Card key={q.id}><CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{q.label}</div>
                  <div className="text-xs text-muted-foreground">{q.type} · {s.count} Antworten</div>
                </div>
                {s.avg !== null && <Badge variant="outline">Ø {s.avg.toFixed(2)}</Badge>}
              </div>

              {s.chart.length > 0 && (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={s.chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {s.texts.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-auto">
                  {s.texts.slice(0, 100).map((t, i) => (
                    <div key={i} className="rounded-md border border-border p-2 text-sm">{t}</div>
                  ))}
                </div>
              )}

              {s.count === 0 && <p className="text-sm text-muted-foreground">Noch keine Antworten.</p>}
            </CardContent></Card>
          );
        })}
        {!loading && questions.length === 0 && <p className="text-sm text-muted-foreground">Diese Umfrage hat noch keine Fragen.</p>}
      </div>
    </div>
  );
}
