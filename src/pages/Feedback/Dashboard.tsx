import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Kpi, FeedbackHeader, Section, StatusPill } from './_shared';
import { Activity, Mail, MailOpen, Send, CheckCircle2, Gift, Star, ThumbsUp, Timer, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Row { [k: string]: any }

export default function FeedbackDashboard() {
  const [surveys, setSurveys] = useState<Row[]>([]);
  const [invites, setInvites] = useState<Row[]>([]);
  const [responses, setResponses] = useState<Row[]>([]);
  const [rewards, setRewards] = useState<Row[]>([]);
  const [alerts, setAlerts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [s, i, r, g, a] = await Promise.all([
        sb.from('surveys').select('id,name,status,created_at').is('deleted_at', null).order('created_at', { ascending: false }),
        sb.from('survey_invitations').select('id,survey_id,status,sent_at,delivered_at,opened_at,started_at,completed_at').limit(5000),
        sb.from('survey_responses').select('id,survey_id,status,nps_score,score_total,duration_seconds,completed_at,is_critical').order('completed_at', { ascending: false }).limit(5000),
        sb.from('survey_reward_assignments').select('id,status,issued_at,redeemed_at').limit(5000),
        sb.from('survey_alerts').select('id,severity,reason,status,created_at').eq('status', 'offen').order('created_at', { ascending: false }).limit(10),
      ]);
      setSurveys(s.data ?? []); setInvites(i.data ?? []); setResponses(r.data ?? []);
      setRewards(g.data ?? []); setAlerts(a.data ?? []);
      setLoading(false);
    })();
  }, []);

  const activeSurveys = surveys.filter(s => s.status === 'aktiv').length;
  const sent = invites.filter(i => i.sent_at).length;
  const delivered = invites.filter(i => i.delivered_at).length;
  const opened = invites.filter(i => i.opened_at).length;
  const started = invites.filter(i => i.started_at).length;
  const completed = responses.filter(r => r.status === 'abgeschlossen').length;
  const abbruch = started > 0 ? Math.round(((started - completed) / started) * 100) : 0;
  const ruecklauf = sent > 0 ? Math.round((completed / sent) * 100) : 0;
  const durations = responses.map(r => r.duration_seconds).filter((n: any) => typeof n === 'number' && n > 0);
  const avgDuration = durations.length ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length / 60) : 0;
  const issued = rewards.filter(r => ['freigeschaltet', 'versendet', 'heruntergeladen', 'versendet_post'].includes(r.status) || r.issued_at).length;
  const notRedeemed = rewards.filter(r => !r.redeemed_at).length;
  const scores = responses.map(r => r.score_total).filter((n: any) => typeof n === 'number');
  const avgScore = scores.length ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1) : '–';
  const nps = responses.map(r => r.nps_score).filter((n: any) => typeof n === 'number');
  const promoters = nps.filter((n: number) => n >= 9).length;
  const detractors = nps.filter((n: number) => n <= 6).length;
  const npsScore = nps.length ? Math.round(((promoters - detractors) / nps.length) * 100) : 0;
  const empfehlung = nps.length ? Math.round((promoters / nps.length) * 100) : 0;

  // Antworten pro Tag (30 Tage)
  const byDay: Record<string, number> = {};
  responses.forEach(r => { if (r.completed_at) { const d = String(r.completed_at).slice(0, 10); byDay[d] = (byDay[d] ?? 0) + 1; } });
  const days = Object.keys(byDay).sort().slice(-30);
  const maxDay = Math.max(1, ...days.map(d => byDay[d]));

  return (
    <div className="space-y-6">
      <FeedbackHeader title="ALIX Feedback · Dashboard" subtitle="Ihre Erfahrung. Unsere Weiterentwicklung." />

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <Kpi label="Aktive Umfragen" value={activeSurveys} icon={Activity} />
        <Kpi label="Einladungen versendet" value={sent} icon={Send} />
        <Kpi label="Zugestellt" value={delivered} icon={Mail} />
        <Kpi label="Geöffnet" value={opened} icon={MailOpen} />
        <Kpi label="Gestartet" value={started} icon={Timer} />
        <Kpi label="Abgeschlossen" value={completed} icon={CheckCircle2} tone="green" />
        <Kpi label="Rücklaufquote" value={`${ruecklauf} %`} icon={ThumbsUp} tone="green" />
        <Kpi label="Abbruchquote" value={`${abbruch} %`} tone={abbruch > 40 ? 'red' : undefined} />
        <Kpi label="Ø Bearbeitungszeit" value={`${avgDuration} min`} icon={Timer} />
        <Kpi label="Geschenke ausgegeben" value={issued} icon={Gift} />
        <Kpi label="Nicht eingelöst" value={notRedeemed} icon={Gift} tone="amber" />
        <Kpi label="Ø Gesamtbewertung" value={avgScore} icon={Star} />
        <Kpi label="Weiterempfehlung" value={`${empfehlung} %`} />
        <Kpi label="Net Promoter Score" value={npsScore} tone={npsScore >= 30 ? 'green' : npsScore < 0 ? 'red' : 'amber'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Antworten pro Tag</CardTitle></CardHeader>
          <CardContent>
            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">{loading ? 'Lade …' : 'Noch keine Antworten vorhanden.'}</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {days.map(d => (
                  <div key={d} className="flex-1 bg-primary/70 rounded-t" style={{ height: `${(byDay[d] / maxDay) * 100}%` }} title={`${d}: ${byDay[d]}`} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Kritische Antworten</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">Keine offenen Alarme.</p>}
            {alerts.map(a => (
              <div key={a.id} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                <div className="font-medium">{a.reason ?? 'Kritische Bewertung'}</div>
                <div className="text-muted-foreground">{new Date(a.created_at).toLocaleString('de-DE')}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Section title="Umfragen">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left"><tr><th className="p-3">Name</th><th className="p-3">Status</th><th className="p-3">Angelegt</th></tr></thead>
              <tbody>
                {surveys.slice(0, 10).map(s => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/20">
                    <td className="p-3"><Link className="text-primary hover:underline" to={`/umfragen/${s.id}`}>{s.name}</Link></td>
                    <td className="p-3"><StatusPill status={s.status} /></td>
                    <td className="p-3 text-muted-foreground">{new Date(s.created_at).toLocaleDateString('de-DE')}</td>
                  </tr>
                ))}
                {surveys.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={3}>{loading ? 'Lade …' : 'Noch keine Umfragen angelegt.'}</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}
