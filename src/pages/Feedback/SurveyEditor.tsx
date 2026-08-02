import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeedbackHeader, LANGUAGES, QUESTION_TYPES, SURVEY_STATUS } from './_shared';
import { Plus, Save, Trash2, ArrowUp, ArrowDown, Send, Search, Link2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { publicUrl } from '@/lib/esc/public-url';

const OPTION_TYPES = QUESTION_TYPES.filter(t => t.hasOptions).map(t => t.value);

export default function SurveyEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'neu';
  const nav = useNavigate();
  const sb = supabase as any;

  const [survey, setSurvey] = useState<any>({
    name: '', public_title: '', intro_text: '', outro_text: '', language: 'de',
    est_minutes: 5, target_group: '', status: 'entwurf', reminders_enabled: true, reminder_days: 7,
  });
  const [questions, setQuestions] = useState<any[]>([]);
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [rewards, setRewards] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [custQuery, setCustQuery] = useState('');
  const [custResults, setCustResults] = useState<any[]>([]);

  async function load() {
    if (isNew) return;
    const [s, q, rw, rc] = await Promise.all([
      sb.from('surveys').select('*').eq('id', id).maybeSingle(),
      sb.from('survey_questions').select('*').eq('survey_id', id).order('position'),
      sb.from('survey_rewards').select('id,name,reward_type').is('deleted_at', null).order('name'),
      sb.from('survey_recipients').select('*').eq('survey_id', id).order('created_at', { ascending: false }),
    ]);
    if (s.data) setSurvey(s.data);
    setQuestions(q.data ?? []);
    setRewards(rw.data ?? []);
    setRecipients(rc.data ?? []);
    const qids = (q.data ?? []).map((x: any) => x.id);
    if (qids.length) {
      const { data: opts } = await sb.from('survey_question_options').select('*').in('question_id', qids).order('position');
      const grouped: Record<string, any[]> = {};
      (opts ?? []).forEach((o: any) => { (grouped[o.question_id] ||= []).push(o); });
      setOptions(grouped);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => { if (isNew) sb.from('survey_rewards').select('id,name,reward_type').is('deleted_at', null).then((r: any) => setRewards(r.data ?? [])); /* eslint-disable-next-line */ }, []);

  async function saveSurvey() {
    if (!survey.name?.trim()) { toast.error('Bitte einen Namen vergeben'); return; }
    setSaving(true);
    const payload = {
      name: survey.name, public_title: survey.public_title, intro_text: survey.intro_text, outro_text: survey.outro_text,
      language: survey.language, est_minutes: survey.est_minutes ? Number(survey.est_minutes) : null,
      target_group: survey.target_group, device_model: survey.device_model, status: survey.status,
      reward_id: survey.reward_id || null, reminders_enabled: survey.reminders_enabled,
      reminder_days: (() => {
        const v = survey.reminder_days;
        const arr = Array.isArray(v) ? v.map(Number) : String(v ?? '').split(',').map((s: string) => Number(s.trim()));
        const clean = arr.filter((n: number) => Number.isFinite(n) && n > 0);
        return clean.length ? clean : [7];
      })(),
      starts_at: survey.starts_at || null, ends_at: survey.ends_at || null,
    };
    if (isNew) {
      const { data, error } = await sb.from('surveys').insert(payload).select().single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success('Umfrage angelegt');
      nav(`/umfragen/${data.id}`, { replace: true });
    } else {
      const { error } = await sb.from('surveys').update(payload).eq('id', id);
      setSaving(false);
      if (error) toast.error(error.message); else toast.success('Gespeichert');
    }
  }

  async function addQuestion() {
    const { data, error } = await sb.from('survey_questions').insert({
      survey_id: id, qtype: 'stars', label: 'Neue Frage', position: questions.length + 1, required: false,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setQuestions(qs => [...qs, data]);
  }

  async function patchQuestion(qid: string, patch: any) {
    setQuestions(qs => qs.map(q => q.id === qid ? { ...q, ...patch } : q));
    await sb.from('survey_questions').update(patch).eq('id', qid);
  }

  async function removeQuestion(qid: string) {
    await sb.from('survey_questions').delete().eq('id', qid);
    setQuestions(qs => qs.filter(q => q.id !== qid));
  }

  async function move(qid: string, dir: -1 | 1) {
    const idx = questions.findIndex(q => q.id === qid);
    const to = idx + dir;
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    [next[idx], next[to]] = [next[to], next[idx]];
    setQuestions(next);
    await Promise.all(next.map((q, i) => sb.from('survey_questions').update({ position: i + 1 }).eq('id', q.id)));
  }

  async function addOption(qid: string) {
    const list = options[qid] ?? [];
    const { data, error } = await sb.from('survey_question_options').insert({
      question_id: qid, label: `Option ${list.length + 1}`, value: `opt${list.length + 1}`, position: list.length + 1,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setOptions(o => ({ ...o, [qid]: [...list, data] }));
  }
  async function patchOption(qid: string, oid: string, patch: any) {
    setOptions(o => ({ ...o, [qid]: (o[qid] ?? []).map(x => x.id === oid ? { ...x, ...patch } : x) }));
    await sb.from('survey_question_options').update(patch).eq('id', oid);
  }
  async function removeOption(qid: string, oid: string) {
    await sb.from('survey_question_options').delete().eq('id', oid);
    setOptions(o => ({ ...o, [qid]: (o[qid] ?? []).filter(x => x.id !== oid) }));
  }

  async function searchCustomers() {
    if (custQuery.trim().length < 2) { toast.error('Bitte mindestens 2 Zeichen eingeben'); return; }
    const term = `%${custQuery.trim()}%`;
    const { data, error } = await sb.from('customers')
      .select('id, external_customer_id, company_name, contact_name, email')
      .or(`company_name.ilike.${term},email.ilike.${term},external_customer_id.ilike.${term},contact_name.ilike.${term}`)
      .limit(25);
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []).map((c: any) => ({
      id: c.id,
      customer_number: c.external_customer_id,
      company_name: c.company_name,
      first_name: null,
      last_name: c.contact_name,
      email: c.email,
    }));
    setCustResults(rows);
    if (!rows.length) toast.info('Keine Kunden gefunden');
  }

  async function addRecipient(c: any) {
    if (!c.email) { toast.error('Kunde hat keine E-Mail-Adresse'); return; }
    const { data, error } = await sb.from('survey_recipients').insert({
      survey_id: id, customer_id: c.id ?? null, customer_number: c.customer_number ?? null,
      company_name: c.company_name ?? null, first_name: c.first_name ?? null, last_name: c.last_name ?? null,
      email: c.email, language: survey.language ?? 'de', consent_status: 'offen',
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setRecipients(r => [data, ...r]);
    toast.success('Empfänger hinzugefügt');
  }


  async function removeRecipient(rid: string) {
    await sb.from('survey_recipients').delete().eq('id', rid);
    setRecipients(r => r.filter(x => x.id !== rid));
  }

  async function sendInvites() {
    if (!id) return;
    const { data, error } = await sb.functions.invoke('survey-send-invites', { body: { survey_id: id, kind: 'einladung' } });
    if (error) { toast.error(error.message); return; }
    toast.success(`${data?.sent ?? 0} Einladungen versendet`);
    load();
  }

  async function sendReminders() {
    const { data, error } = await sb.functions.invoke('survey-send-invites', { body: { survey_id: id, kind: 'erinnerung' } });
    if (error) { toast.error(error.message); return; }
    toast.success(`${data?.sent ?? 0} Erinnerungen versendet`);
    load();
  }

  const publicBase = useMemo(() => publicUrl('/umfrage'), []);

  return (
    <div className="space-y-5">
      <FeedbackHeader
        title={isNew ? 'Neue Umfrage' : survey.name || 'Umfrage'}
        subtitle={isNew ? 'Grunddaten erfassen und Fragen ergänzen' : `Status: ${SURVEY_STATUS[survey.status] ?? survey.status}`}
        action={<Button onClick={saveSurvey} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? 'Speichere …' : 'Speichern'}</Button>}
      />

      <Tabs defaultValue="basis">
        <TabsList>
          <TabsTrigger value="basis">Grundlagen</TabsTrigger>
          <TabsTrigger value="fragen" disabled={isNew}>Fragen</TabsTrigger>
          <TabsTrigger value="empfaenger" disabled={isNew}>Empfänger</TabsTrigger>
          <TabsTrigger value="versand" disabled={isNew}>Versand</TabsTrigger>
        </TabsList>

        <TabsContent value="basis" className="mt-4">
          <Card><CardContent className="p-5 grid gap-4 md:grid-cols-2 max-w-4xl">
            <div className="md:col-span-2"><Label>Interner Name</Label><Input value={survey.name ?? ''} onChange={e => setSurvey({ ...survey, name: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Öffentlicher Titel</Label><Input value={survey.public_title ?? ''} onChange={e => setSurvey({ ...survey, public_title: e.target.value })} placeholder="Ihre Erfahrung. Unsere Weiterentwicklung." /></div>
            <div className="md:col-span-2"><Label>Einleitungstext</Label><Textarea rows={3} value={survey.intro_text ?? ''} onChange={e => setSurvey({ ...survey, intro_text: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Abschlusstext</Label><Textarea rows={3} value={survey.outro_text ?? ''} onChange={e => setSurvey({ ...survey, outro_text: e.target.value })} /></div>
            <div>
              <Label>Sprache</Label>
              <Select value={survey.language ?? 'de'} onValueChange={v => setSurvey({ ...survey, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={survey.status ?? 'entwurf'} onValueChange={v => setSurvey({ ...survey, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SURVEY_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Geschätzte Dauer (Minuten)</Label><Input type="number" value={survey.est_minutes ?? ''} onChange={e => setSurvey({ ...survey, est_minutes: e.target.value })} /></div>
            <div><Label>Zielgruppe</Label><Input value={survey.target_group ?? ''} onChange={e => setSurvey({ ...survey, target_group: e.target.value })} placeholder="z. B. Bestandskunden 2025" /></div>
            <div><Label>Start</Label><Input type="date" value={survey.starts_at ? String(survey.starts_at).slice(0, 10) : ''} onChange={e => setSurvey({ ...survey, starts_at: e.target.value || null })} /></div>
            <div><Label>Ende</Label><Input type="date" value={survey.ends_at ? String(survey.ends_at).slice(0, 10) : ''} onChange={e => setSurvey({ ...survey, ends_at: e.target.value || null })} /></div>
            <div>
              <Label>Belohnung nach Abschluss</Label>
              <Select value={survey.reward_id ?? 'none'} onValueChange={v => setSurvey({ ...survey, reward_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Belohnung</SelectItem>
                  {rewards.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={!!survey.reminders_enabled} onCheckedChange={v => setSurvey({ ...survey, reminders_enabled: v })} />
              <span className="text-sm">Erinnerungen aktiv</span>
              <Input className="w-32" value={Array.isArray(survey.reminder_days) ? survey.reminder_days.join(', ') : (survey.reminder_days ?? 7)} onChange={e => setSurvey({ ...survey, reminder_days: e.target.value })} />
              <span className="text-sm text-muted-foreground">Tage (z. B. 7, 14)</span>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fragen" className="mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{questions.length} Fragen</p>
            <Button size="sm" onClick={addQuestion}><Plus className="h-4 w-4 mr-2" />Frage hinzufügen</Button>
          </div>
          {questions.map((q, i) => (
            <Card key={q.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-2">{i + 1}</Badge>
                  <div className="flex-1 grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-2"><Label>Fragetext</Label><Input value={q.label ?? ''} onChange={e => patchQuestion(q.id, { label: e.target.value })} /></div>
                    <div>
                      <Label>Fragetyp</Label>
                      <Select value={q.qtype} onValueChange={v => patchQuestion(q.id, { qtype: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2"><Label>Hilfetext</Label><Input value={q.help_text ?? ''} onChange={e => patchQuestion(q.id, { help_text: e.target.value })} /></div>
                    <div className="flex items-end gap-3 pb-1">
                      <div className="flex items-center gap-2"><Switch checked={!!q.required} onCheckedChange={v => patchQuestion(q.id, { required: v })} /><span className="text-sm">Pflicht</span></div>
                      <div className="flex items-center gap-2"><Switch checked={q.visible !== false} onCheckedChange={v => patchQuestion(q.id, { visible: v })} /><span className="text-sm">Sichtbar</span></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(q.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(q.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeQuestion(q.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>

                {OPTION_TYPES.includes(q.qtype) && (
                  <div className="pl-10 space-y-2">
                    {(options[q.id] ?? []).map(o => (
                      <div key={o.id} className="flex gap-2 items-center">
                        <Input className="max-w-md" value={o.label ?? ''} onChange={e => patchOption(q.id, o.id, { label: e.target.value })} />
                        <Input className="w-28" type="number" value={o.score ?? ''} placeholder="Punkte" onChange={e => patchOption(q.id, o.id, { score: e.target.value === '' ? null : Number(e.target.value) })} />
                        <Button size="icon" variant="ghost" onClick={() => removeOption(q.id, o.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addOption(q.id)}><Plus className="h-3 w-3 mr-1" />Antwortoption</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {questions.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">Noch keine Fragen. Fügen Sie die erste Frage hinzu.</CardContent></Card>}
        </TabsContent>

        <TabsContent value="empfaenger" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" />Kunden suchen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 max-w-xl">
                <Input placeholder="Firma, Name, Kundennummer oder E-Mail" value={custQuery}
                  onChange={e => setCustQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchCustomers()} />
                <Button variant="outline" onClick={searchCustomers}>Suchen</Button>
              </div>
              {custResults.length > 0 && (
                <div className="rounded-md border border-border divide-y divide-border max-h-72 overflow-auto">
                  {custResults.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 text-sm">
                      <div>
                        <div className="font-medium">{c.company_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`}</div>
                        <div className="text-xs text-muted-foreground">{c.customer_number} · {c.email ?? 'keine E-Mail'}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => addRecipient(c)}><Plus className="h-3 w-3 mr-1" />Hinzufügen</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Empfängerliste ({recipients.length})</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left"><tr><th className="p-3">Kunde</th><th className="p-3">E-Mail</th><th className="p-3">Sprache</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
                <tbody>
                  {recipients.map(r => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-3">{r.company_name || `${r.first_name ?? ''} ${r.last_name ?? ''}`}<div className="text-xs text-muted-foreground">{r.customer_number}</div></td>
                      <td className="p-3">{r.email}</td>
                      <td className="p-3 uppercase">{r.language}</td>
                      <td className="p-3">{r.unsubscribed_at ? <Badge variant="outline" className="border-destructive/40 text-destructive">Abgemeldet</Badge> : <Badge variant="outline">{r.status}</Badge>}</td>
                      <td className="p-3 text-right"><Button size="icon" variant="ghost" onClick={() => removeRecipient(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                  {recipients.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Noch keine Empfänger ausgewählt.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versand" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Versand & Erinnerungen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Jeder Empfänger erhält einen persönlichen, einmaligen Link. Abgemeldete Kunden werden automatisch übersprungen.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={sendInvites} disabled={survey.status !== 'aktiv'}><Send className="h-4 w-4 mr-2" />Einladungen versenden</Button>
                <Button variant="outline" onClick={sendReminders} disabled={survey.status !== 'aktiv'}>Erinnerungen versenden</Button>
              </div>
              {survey.status !== 'aktiv' && <p className="text-xs text-amber-400">Setzen Sie die Umfrage auf „Aktiv“, um Einladungen zu versenden.</p>}
              <div className="pt-2 text-sm flex items-center gap-2 text-muted-foreground">
                <Link2 className="h-4 w-4" /> Öffentliche Basis-URL: <code className="text-xs">{publicBase}/&lt;token&gt;</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
