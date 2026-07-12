import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Smile, TrendingUp, Users } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Survey {
  id: string;
  ticket_id: string;
  assigned_to: string | null;
  rating: number | null;
  comment: string | null;
  responded_at: string | null;
  sent_at: string;
}

const RANGE_DAYS = 30;

export function CsatWidget() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = subDays(new Date(), RANGE_DAYS).toISOString();
      const { data } = await (supabase as any)
        .from('ticket_csat_surveys')
        .select('id, ticket_id, assigned_to, rating, comment, responded_at, sent_at')
        .gte('sent_at', since)
        .order('sent_at', { ascending: false });
      const list = (data ?? []) as Survey[];
      setSurveys(list);

      const uids = Array.from(new Set(list.map(s => s.assigned_to).filter(Boolean))) as string[];
      if (uids.length) {
        const { data: profs } = await supabase
          .from('user_profiles').select('id, full_name, email').in('id', uids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id.slice(0, 6); });
        setUsers(map);
      }
      setLoading(false);
    })();
  }, []);

  const responded = surveys.filter(s => s.rating !== null && s.responded_at);
  const avgAll = responded.length ? responded.reduce((a, s) => a + (s.rating || 0), 0) / responded.length : 0;
  const responseRate = surveys.length ? Math.round((responded.length / surveys.length) * 100) : 0;

  const perTech = useMemo(() => {
    const map: Record<string, { sum: number; n: number }> = {};
    for (const s of responded) {
      const k = s.assigned_to || 'unassigned';
      map[k] = map[k] || { sum: 0, n: 0 };
      map[k].sum += s.rating || 0;
      map[k].n += 1;
    }
    return Object.entries(map)
      .map(([id, v]) => ({ id, name: users[id] || (id === 'unassigned' ? 'Nicht zugewiesen' : id.slice(0, 6)), avg: v.sum / v.n, n: v.n }))
      .sort((a, b) => b.avg - a.avg);
  }, [responded, users]);

  const trend = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const s of responded) {
      const day = format(startOfDay(new Date(s.responded_at!)), 'yyyy-MM-dd');
      const cur = byDay.get(day) || { sum: 0, n: 0 };
      cur.sum += s.rating || 0; cur.n += 1;
      byDay.set(day, cur);
    }
    const out: { day: string; label: string; avg: number }[] = [];
    for (let i = RANGE_DAYS - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const k = format(d, 'yyyy-MM-dd');
      const v = byDay.get(k);
      out.push({ day: k, label: format(d, 'dd.MM.', { locale: de }), avg: v ? Number((v.sum / v.n).toFixed(2)) : 0 });
    }
    return out;
  }, [responded]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] flex items-center gap-2">
          <Smile className="w-4 h-4 text-primary" /> Kundenzufriedenheit (letzte {RANGE_DAYS} Tage)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-[12px] text-muted-foreground">Wird geladen…</div>
        ) : responded.length === 0 ? (
          <div className="text-[12px] text-muted-foreground">Noch keine Bewertungen im Zeitraum.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Kpi icon={<Star className="w-4 h-4" />} label="Ø Bewertung" value={avgAll.toFixed(2)} suffix="/ 5" />
              <Kpi icon={<Users className="w-4 h-4" />} label="Antworten" value={String(responded.length)} suffix={`/ ${surveys.length}`} />
              <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Response-Rate" value={`${responseRate}%`} />
            </div>

            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} width={20} />
                  <Tooltip contentStyle={{ fontSize: 11, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Top Techniker</div>
              <ul className="space-y-1.5">
                {perTech.slice(0, 6).map(t => (
                  <li key={t.id} className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded hover:bg-muted/40">
                    <span className="truncate">{t.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-yellow-400 font-mono">{t.avg.toFixed(2)} ★</span>
                      <span className="text-muted-foreground text-[11px]">({t.n})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground uppercase tracking-wide mb-1">
        {icon}{label}
      </div>
      <div className="text-lg font-semibold">
        {value}
        {suffix && <span className="text-[11px] text-muted-foreground ml-1">{suffix}</span>}
      </div>
    </div>
  );
}
