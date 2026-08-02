import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FeedbackHeader, Kpi } from './_shared';
import { BarChart3, TrendingUp, Users, Star } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';

type Row = {
  id: string; nps_score: number | null; score_total: number | null; completed_at: string | null;
  created_at: string; recipient_id: string | null; survey_id: string;
};

const DIMENSIONS = [
  { value: 'salesperson', label: 'Verkäufer' },
  { value: 'country', label: 'Land' },
  { value: 'device_model', label: 'Gerät' },
  { value: 'company_name', label: 'Firma' },
];

function npsOf(list: (number | null)[]) {
  const v = list.filter((x): x is number => typeof x === 'number');
  if (!v.length) return null;
  const prom = v.filter(x => x >= 9).length;
  const det = v.filter(x => x <= 6).length;
  return Math.round(((prom - det) / v.length) * 100);
}

export default function FeedbackBenchmark() {
  const [responses, setResponses] = useState<Row[]>([]);
  const [recipients, setRecipients] = useState<Record<string, any>>({});
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyId, setSurveyId] = useState('all');
  const [dim, setDim] = useState('salesperson');
  const [months, setMonths] = useState('12');

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [r, rec, sv] = await Promise.all([
        sb.from('survey_responses').select('id, nps_score, score_total, completed_at, created_at, recipient_id, survey_id').limit(5000),
        sb.from('survey_recipients').select('id, salesperson, country, device_model, company_name').limit(5000),
        sb.from('surveys').select('id, name').is('deleted_at', null).order('name'),
      ]);
      setResponses(r.data ?? []);
      setRecipients(Object.fromEntries((rec.data ?? []).map((x: any) => [x.id, x])));
      setSurveys(sv.data ?? []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const from = Date.now() - Number(months) * 30 * 864e5;
    return responses.filter(r =>
      (surveyId === 'all' || r.survey_id === surveyId) &&
      new Date(r.completed_at ?? r.created_at).getTime() >= from);
  }, [responses, surveyId, months]);

  const trend = useMemo(() => {
    const buckets = new Map<string, { nps: (number | null)[]; csat: number[] }>();
    for (const r of filtered) {
      const d = new Date(r.completed_at ?? r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = buckets.get(key) ?? { nps: [], csat: [] };
      b.nps.push(r.nps_score);
      if (typeof r.score_total === 'number') b.csat.push(r.score_total);
      buckets.set(key, b);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      monat: k,
      nps: npsOf(v.nps) ?? 0,
      csat: v.csat.length ? Math.round((v.csat.reduce((s, x) => s + x, 0) / v.csat.length) * 10) / 10 : 0,
      antworten: v.nps.length,
    }));
  }, [filtered]);

  const byDim = useMemo(() => {
    const map = new Map<string, { nps: (number | null)[]; count: number }>();
    for (const r of filtered) {
      const rec = r.recipient_id ? recipients[r.recipient_id] : null;
      const key = (rec?.[dim] as string) || 'Unbekannt';
      const b = map.get(key) ?? { nps: [], count: 0 };
      b.nps.push(r.nps_score); b.count++;
      map.set(key, b);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, nps: npsOf(v.nps) ?? 0, antworten: v.count }))
      .sort((a, b) => b.antworten - a.antworten).slice(0, 12);
  }, [filtered, recipients, dim]);

  const overallNps = npsOf(filtered.map(r => r.nps_score));
  const csatValues = filtered.map(r => r.score_total).filter((x): x is number => typeof x === 'number');
  const csat = csatValues.length ? Math.round((csatValues.reduce((s, x) => s + x, 0) / csatValues.length) * 10) / 10 : null;
  const lastTwo = trend.slice(-2);
  const delta = lastTwo.length === 2 ? lastTwo[1].nps - lastTwo[0].nps : 0;

  return (
    <div className="space-y-5">
      <FeedbackHeader title="Benchmark & Trends" subtitle="NPS und Zufriedenheit im Zeitverlauf und je Dimension" />

      <Card><CardContent className="p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label>Umfrage</Label>
          <Select value={surveyId} onValueChange={setSurveyId}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Umfragen</SelectItem>
              {surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Zeitraum</Label>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Monate</SelectItem>
              <SelectItem value="6">6 Monate</SelectItem>
              <SelectItem value="12">12 Monate</SelectItem>
              <SelectItem value="24">24 Monate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Vergleich nach</Label>
          <Select value={dim} onValueChange={setDim}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIMENSIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="NPS" value={overallNps ?? '–'} icon={TrendingUp} tone={(overallNps ?? 0) >= 0 ? 'green' : 'red'} />
        <Kpi label="Ø Zufriedenheit" value={csat ?? '–'} icon={Star} />
        <Kpi label="Antworten" value={filtered.length} icon={Users} />
        <Kpi label="Veränderung ggü. Vormonat" value={`${delta > 0 ? '+' : ''}${delta}`} icon={BarChart3} tone={delta >= 0 ? 'green' : 'red'} />
      </div>

      <Card><CardContent className="p-5">
        <h3 className="text-sm font-semibold mb-4">NPS- und CSAT-Verlauf</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="monat" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="nps" stroke="hsl(var(--primary))" strokeWidth={2} name="NPS" />
              <Line type="monotone" dataKey="csat" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="Ø Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <h3 className="text-sm font-semibold mb-4">Vergleich nach {DIMENSIONS.find(d => d.value === dim)?.label}</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDim} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={12} width={140} />
              <Tooltip />
              <Bar dataKey="nps" fill="hsl(var(--primary))" name="NPS" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent></Card>
    </div>
  );
}
