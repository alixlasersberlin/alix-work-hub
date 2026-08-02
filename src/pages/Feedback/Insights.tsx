import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeedbackHeader } from './_shared';
import { Sparkles, AlertTriangle, Quote, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type Summary = {
  id: string; survey_id: string | null; summary_text: string | null;
  positives: any; negatives: any; improvements: any; clusters: any;
  model: string | null; status: string | null; created_at: string;
};

function asList(v: any): string[] {
  if (Array.isArray(v)) return v.map(x => (typeof x === 'string' ? x : x?.text ?? JSON.stringify(x)));
  return [];
}

export default function FeedbackInsights() {
  const sb = supabase as any;
  const [surveys, setSurveys] = useState<any[]>([]);
  const [surveyId, setSurveyId] = useState<string>('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from('surveys').select('id,name').is('deleted_at', null).order('created_at', { ascending: false })
      .then((r: any) => {
        const list = r.data ?? [];
        setSurveys(list);
        if (list.length && !surveyId) setSurveyId(list[0].id);
        setLoading(false);
      });
    /* eslint-disable-next-line */
  }, []);

  async function load(id: string) {
    if (!id) return;
    const [s, a, t] = await Promise.all([
      sb.from('survey_ai_summaries').select('*').eq('survey_id', id).order('created_at', { ascending: false }).limit(1),
      sb.from('survey_alerts').select('*').eq('survey_id', id).order('created_at', { ascending: false }).limit(200),
      sb.from('survey_testimonials').select('*').eq('survey_id', id).order('created_at', { ascending: false }).limit(200),
    ]);
    setSummary(s.data?.[0] ?? null);
    setAlerts(a.data ?? []);
    setTestimonials(t.data ?? []);
  }
  useEffect(() => { load(surveyId); /* eslint-disable-next-line */ }, [surveyId]);

  async function generate() {
    if (!surveyId) return;
    setBusy(true);
    try {
      const { data: responses } = await sb.from('survey_responses').select('id,score_total,nps_score,is_critical').eq('survey_id', surveyId).limit(500);
      const ids = (responses ?? []).map((r: any) => r.id);
      if (!ids.length) { toast.error('Für diese Umfrage liegen noch keine Antworten vor.'); return; }
      const { data: items } = await sb.from('survey_response_items').select('question_label,value_text,value_number,value_bool,value_json')
        .in('response_id', ids).limit(3000);

      const texts = (items ?? [])
        .map((i: any) => {
          const v = i.value_text ?? (i.value_number ?? null) ?? (i.value_bool === null || i.value_bool === undefined ? null : (i.value_bool ? 'Ja' : 'Nein'))
            ?? (i.value_json ? (Array.isArray(i.value_json) ? i.value_json.join(', ') : JSON.stringify(i.value_json)) : null);
          return v === null || v === '' ? null : `${i.question_label}: ${v}`;
        })
        .filter(Boolean)
        .slice(0, 800)
        .join('\n');

      const nps = (responses ?? []).map((r: any) => r.nps_score).filter((n: any) => typeof n === 'number');
      const npsAvg = nps.length ? (nps.reduce((a: number, b: number) => a + b, 0) / nps.length).toFixed(1) : '–';

      const { data, error } = await sb.functions.invoke('ai-center-chat', {
        body: {
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Du bist Analyst für Kundenfeedback. Antworte ausschließlich als JSON mit den Schlüsseln: summary (string, 3-5 Sätze, Deutsch), positives (string[]), negatives (string[]), improvements (string[]), clusters (Array von {thema: string, anzahl: number, stimmung: "positiv"|"neutral"|"negativ"}).' },
            { role: 'user', content: `Umfrage-Antworten (${(responses ?? []).length} Teilnehmer, Ø NPS ${npsAvg}):\n\n${texts}` },
          ],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      let parsed: any = {};
      try { parsed = JSON.parse(String(data?.content ?? '{}').replace(/^```json|^```|```$/gm, '').trim()); } catch { parsed = {}; }

      const { error: insErr } = await sb.from('survey_ai_summaries').insert({
        survey_id: surveyId,
        scope: 'survey',
        summary_text: parsed.summary ?? String(data?.content ?? ''),
        positives: parsed.positives ?? [],
        negatives: parsed.negatives ?? [],
        improvements: parsed.improvements ?? [],
        clusters: parsed.clusters ?? [],
        model: data?.model ?? null,
        status: 'entwurf',
      });
      if (insErr) throw insErr;
      toast.success('KI-Auswertung erstellt');
      load(surveyId);
    } catch (e: any) {
      toast.error(e?.message ?? 'Auswertung fehlgeschlagen');
    } finally { setBusy(false); }
  }

  async function markReviewed() {
    if (!summary) return;
    const { data: u } = await sb.auth.getUser();
    await sb.from('survey_ai_summaries').update({ status: 'geprueft', reviewed_at: new Date().toISOString(), reviewed_by: u?.user?.id ?? null }).eq('id', summary.id);
    toast.success('Als geprüft markiert'); load(surveyId);
  }

  async function setAlertStatus(id: string, status: string) {
    await sb.from('survey_alerts').update({ status, resolved_at: status === 'erledigt' ? new Date().toISOString() : null }).eq('id', id);
    load(surveyId);
  }

  async function setTestimonialStatus(id: string, status: string) {
    await sb.from('survey_testimonials').update({ status, published_at: status === 'veroeffentlicht' ? new Date().toISOString() : null }).eq('id', id);
    load(surveyId);
  }

  const openAlerts = alerts.filter(a => (a.status ?? 'offen') !== 'erledigt');

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title="Auswertung"
        subtitle="KI-Zusammenfassung, kritische Rückmeldungen und Testimonials"
        action={
          <Button onClick={generate} disabled={busy || !surveyId}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            KI-Auswertung erstellen
          </Button>
        }
      />

      <Select value={surveyId} onValueChange={setSurveyId}>
        <SelectTrigger className="w-96"><SelectValue placeholder={loading ? 'Lade …' : 'Umfrage wählen'} /></SelectTrigger>
        <SelectContent>{surveys.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>

      <Tabs defaultValue="ki">
        <TabsList>
          <TabsTrigger value="ki">KI-Zusammenfassung</TabsTrigger>
          <TabsTrigger value="alarme">Kritische Fälle {openAlerts.length > 0 && <Badge variant="outline" className="ml-2 border-destructive/40 text-destructive">{openAlerts.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials {testimonials.length > 0 && <Badge variant="outline" className="ml-2">{testimonials.length}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="ki" className="mt-4 space-y-4">
          {!summary && <Card><CardContent className="p-6 text-sm text-muted-foreground">Noch keine Auswertung. Über „KI-Auswertung erstellen" die Antworten analysieren lassen.</CardContent></Card>}
          {summary && (
            <>
              <Card>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Zusammenfassung · {new Date(summary.created_at).toLocaleString('de-DE')} {summary.model ? `· ${summary.model}` : ''}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{summary.status === 'geprueft' ? 'Geprüft' : 'Entwurf'}</Badge>
                      {summary.status !== 'geprueft' && (
                        <Button size="sm" variant="outline" onClick={markReviewed}><CheckCircle2 className="h-4 w-4 mr-2" />Als geprüft markieren</Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => load(surveyId)}><RefreshCw className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.summary_text}</p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                {[
                  { title: 'Positiv', list: asList(summary.positives), cls: 'text-emerald-400' },
                  { title: 'Kritik', list: asList(summary.negatives), cls: 'text-destructive' },
                  { title: 'Verbesserungen', list: asList(summary.improvements), cls: 'text-amber-400' },
                ].map(b => (
                  <Card key={b.title}>
                    <CardContent className="p-4">
                      <div className={`text-xs uppercase tracking-wider ${b.cls}`}>{b.title}</div>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {b.list.map((x, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{x}</span></li>)}
                        {b.list.length === 0 && <li className="text-muted-foreground">–</li>}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {Array.isArray(summary.clusters) && summary.clusters.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Themencluster</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {summary.clusters.map((c: any, i: number) => (
                        <Badge key={i} variant="outline"
                          className={c?.stimmung === 'negativ' ? 'border-destructive/40 text-destructive'
                            : c?.stimmung === 'positiv' ? 'border-emerald-500/30 text-emerald-400' : ''}>
                          {c?.thema ?? '–'}{c?.anzahl ? ` · ${c.anzahl}` : ''}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="alarme" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left"><tr>
                  <th className="p-3">Datum</th><th className="p-3">Regel</th><th className="p-3">Grund</th>
                  <th className="p-3">Schwere</th><th className="p-3">Status</th><th className="p-3 text-right">Aktion</th>
                </tr></thead>
                <tbody>
                  {alerts.map(a => (
                    <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                      <td className="p-3 text-muted-foreground">{new Date(a.created_at).toLocaleString('de-DE')}</td>
                      <td className="p-3">{a.rule_name ?? '–'}</td>
                      <td className="p-3 text-muted-foreground">{a.reason ?? '–'}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={a.severity === 'hoch' || a.severity === 'kritisch' ? 'border-destructive/40 text-destructive' : ''}>
                          <AlertTriangle className="h-3 w-3 mr-1" />{a.severity ?? 'normal'}
                        </Badge>
                      </td>
                      <td className="p-3"><Badge variant="outline">{a.status ?? 'offen'}</Badge></td>
                      <td className="p-3 text-right">
                        {(a.status ?? 'offen') !== 'erledigt'
                          ? <Button size="sm" variant="outline" onClick={() => setAlertStatus(a.id, 'erledigt')}>Erledigt</Button>
                          : <Button size="sm" variant="ghost" onClick={() => setAlertStatus(a.id, 'offen')}>Wieder öffnen</Button>}
                      </td>
                    </tr>
                  ))}
                  {alerts.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={6}>Keine kritischen Rückmeldungen.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testimonials" className="mt-4 grid gap-4 md:grid-cols-2">
          {testimonials.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-3">
                <Quote className="h-4 w-4 text-primary" />
                <p className="text-sm italic">{t.quote ?? '–'}</p>
                <div className="text-xs text-muted-foreground">
                  {t.allow_name ? (t.author_name ?? 'Unbekannt') : 'Anonym'}
                  {t.allow_company && t.company_name ? ` · ${t.company_name}` : ''}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t.status ?? 'neu'}</Badge>
                  {t.allow_website && <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Website erlaubt</Badge>}
                  {t.allow_interview && <Badge variant="outline">Interview möglich</Badge>}
                </div>
                <div className="flex gap-2">
                  {t.status !== 'veroeffentlicht'
                    ? <Button size="sm" variant="outline" disabled={!t.allow_website} onClick={() => setTestimonialStatus(t.id, 'veroeffentlicht')}>Freigeben</Button>
                    : <Button size="sm" variant="ghost" onClick={() => setTestimonialStatus(t.id, 'neu')}>Freigabe zurücknehmen</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setTestimonialStatus(t.id, 'abgelehnt')}>Ablehnen</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {testimonials.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">Noch keine Testimonial-Freigaben.</CardContent></Card>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
