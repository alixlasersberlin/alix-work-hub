import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const FIELDS: Array<{ key: string; label: string }> = [
  { key: 'target_audience', label: 'Zielgruppe' },
  { key: 'tone', label: 'Tonalität / Markenstimme' },
  { key: 'usp', label: 'USP / Alleinstellungsmerkmale' },
  { key: 'competitors', label: 'Wettbewerber' },
  { key: 'goals', label: 'Ziele (Reichweite, Leads, Verkäufe…)' },
  { key: 'content_pillars', label: 'Content-Säulen / Themen' },
  { key: 'do_dont', label: 'Do & Don\'ts' },
  { key: 'hashtags', label: 'Standard-Hashtags' },
];

export default function SocialFragebogen() {
  const [clients, setClients] = useState<Array<{ id: string; company_name: string }>>([]);
  const [clientId, setClientId] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('social_clients').select('id,company_name').is('deleted_at', null).order('company_name').then(({ data }) => setClients(data ?? []));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    supabase.from('social_questionnaire').select('id,answers').eq('client_id', clientId).is('deleted_at', null).maybeSingle().then(({ data }) => {
      setAnswers((data?.answers as any) ?? {});
      setExistingId(data?.id ?? null);
    });
  }, [clientId]);

  async function save() {
    if (!clientId) return toast.error('Bitte Kunde wählen');
    setSaving(true);
    const payload = { client_id: clientId, answers, submitted_at: new Date().toISOString() };
    const q = existingId
      ? supabase.from('social_questionnaire').update(payload).eq('id', existingId)
      : supabase.from('social_questionnaire').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Fragebogen gespeichert');
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Marketing-Fragebogen</h1>
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
        <Card>
          <CardHeader><CardTitle>Fragen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.map(f => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Textarea rows={2} value={answers[f.key] ?? ''} onChange={e => setAnswers({ ...answers, [f.key]: e.target.value })} />
              </div>
            ))}
            <Button onClick={save} disabled={saving}>{saving ? 'Speichere…' : 'Fragebogen speichern'}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
