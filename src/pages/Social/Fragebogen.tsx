import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS: Array<{ key: string; label: string }> = [
  { key: 'facebook_page', label: 'Facebook-Seite' },
  { key: 'x_profile', label: 'X-Profil (Twitter)' },
  { key: 'linkedin_personal', label: 'LinkedIn-Profil' },
  { key: 'linkedin_company', label: 'LinkedIn-Unternehmensseite' },
  { key: 'instagram', label: 'Instagram-Profil' },
  { key: 'google_business', label: 'Google-Unternehmensprofil' },
  { key: 'youtube', label: 'YouTube-Kanal' },
  { key: 'pinterest', label: 'Pinterest-Profil' },
  { key: 'tiktok', label: 'TikTok-Business-Profil' },
  { key: 'mastodon', label: 'Mastodon-Profil' },
  { key: 'threads', label: 'Threads-Profil' },
  { key: 'bluesky', label: 'Bluesky-Profil' },
];

const QUESTIONS: Array<{ key: string; label: string }> = [
  { key: 'q1_ads', label: '1. Aktuelle Werbemaßnahmen' },
  { key: 'q2_presence', label: '2. Online-Präsenz' },
  { key: 'q3_goals', label: '3. Ziele im Social Media Marketing' },
  { key: 'q4_audience', label: '4. Zielgruppe' },
  { key: 'q5_focus_products', label: '5. Zu bewerbende Produkte/Dienstleistungen' },
  { key: 'q6_promotions', label: '6. Aktuelle Aktionen / Angebote' },
  { key: 'q7_ci_guidelines', label: '7. Corporate-Design-Richtlinien' },
  { key: 'q8_content_types', label: '8. Gewünschte Inhalte' },
  { key: 'q9_frequency', label: '9. Beitrags-Frequenz' },
  { key: 'q10_competitors', label: '10. Interessante Mitbewerber' },
  { key: 'q11_hashtags', label: '11. Wichtige Hashtags / Suchbegriffe' },
  { key: 'q12_regions', label: '12. Zielregionen / Länder' },
  { key: 'q13_avoid', label: '13. Zu vermeidende Themen' },
  { key: 'q14_contact', label: '14. Ansprechpartner Kunde' },
  { key: 'q15_extra_access', label: '15. Weitere Zugänge' },
];

type Platform = { username?: string; password?: string; twofa?: string; admin_invited?: boolean };
type Answers = {
  platforms?: Record<string, Platform>;
  questions?: Record<string, string>;
  materials_note?: string;
};

export default function SocialFragebogen() {
  const [params, setParams] = useSearchParams();
  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [clientId, setClientId] = useState<string>(params.get('client') ?? '');
  const [answers, setAnswers] = useState<Answers>({});
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name').then(({ data }) => setClients(data ?? []));
  }, []);

  useEffect(() => {
    if (!clientId) { setAnswers({}); setExistingId(null); setSubmittedAt(null); return; }
    supabase.from('social_questionnaire').select('id,answers,submitted_at').eq('client_id', clientId).is('deleted_at', null).maybeSingle().then(({ data }) => {
      setAnswers((data?.answers as Answers) ?? {});
      setExistingId(data?.id ?? null);
      setSubmittedAt(data?.submitted_at ?? null);
    });
    setParams((p) => { p.set('client', clientId); return p; }, { replace: true });
  }, [clientId, setParams]);

  const platforms = useMemo(() => answers.platforms ?? {}, [answers]);
  const questions = useMemo(() => answers.questions ?? {}, [answers]);

  function setPlatform(key: string, patch: Platform) {
    setAnswers((a) => ({ ...a, platforms: { ...(a.platforms ?? {}), [key]: { ...(a.platforms?.[key] ?? {}), ...patch } } }));
  }
  function setQuestion(key: string, val: string) {
    setAnswers((a) => ({ ...a, questions: { ...(a.questions ?? {}), [key]: val } }));
  }

  async function save() {
    if (!clientId) return toast.error('Bitte Kunde wählen');
    setSaving(true);
    const payload = { client_id: clientId, answers };
    const q = existingId
      ? supabase.from('social_questionnaire').update(payload).eq('id', existingId)
      : supabase.from('social_questionnaire').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Fragebogen gespeichert');
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-bold">Marketing-Fragebogen</h1>
        {submittedAt && (
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Übermittelt {new Date(submittedAt).toLocaleDateString('de-DE')}</Badge>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Kunde wählen</CardTitle></CardHeader>
        <CardContent>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Kunde auswählen…" /></SelectTrigger>
            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {clientId && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Plattformen &amp; Zugangsdaten</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowSecrets((v) => !v)}>
                <Lock className="mr-2 h-4 w-4" />{showSecrets ? 'Passwörter verbergen' : 'Passwörter anzeigen'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {PLATFORMS.map((p) => {
                const v = platforms[p.key] ?? {};
                const hasData = v.username || v.password || v.twofa || v.admin_invited;
                return (
                  <div key={p.key} className={`border border-border rounded-lg p-3 space-y-3 ${hasData ? '' : 'opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{p.label}</div>
                      {v.admin_invited && <Badge variant="secondary">Als Admin eingeladen</Badge>}
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <Label>Benutzername / E-Mail</Label>
                        <Input value={v.username ?? ''} onChange={(e) => setPlatform(p.key, { username: e.target.value })} />
                      </div>
                      <div>
                        <Label>Passwort</Label>
                        <Input type={showSecrets ? 'text' : 'password'} value={v.password ?? ''} onChange={(e) => setPlatform(p.key, { password: e.target.value })} />
                      </div>
                      <div>
                        <Label>2FA</Label>
                        <Input value={v.twofa ?? ''} onChange={(e) => setPlatform(p.key, { twofa: e.target.value })} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fragen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {QUESTIONS.map((q) => (
                <div key={q.key}>
                  <Label>{q.label}</Label>
                  <Textarea rows={2} value={questions[q.key] ?? ''} onChange={(e) => setQuestion(q.key, e.target.value)} />
                </div>
              ))}
              <div>
                <Label>Unterlagen-Anmerkung</Label>
                <Textarea rows={2} value={answers.materials_note ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, materials_note: e.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? 'Speichere…' : 'Fragebogen speichern'}</Button>
          </div>
        </>
      )}
    </div>
  );
}
