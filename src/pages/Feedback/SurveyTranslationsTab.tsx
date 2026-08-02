// Übersetzungs-Tab: pflegt survey_questions.translations je Sprache.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LANGUAGES } from './_shared';
import { Save, Languages } from 'lucide-react';
import { toast } from 'sonner';

type Q = { id: string; label: string; help_text: string | null; position: number; translations: Record<string, any> };

export default function SurveyTranslationsTab({ surveyId, baseLanguage }: { surveyId: string; baseLanguage?: string }) {
  const [lang, setLang] = useState('en');
  const [rows, setRows] = useState<Q[]>([]);
  const [draft, setDraft] = useState<Record<string, { label: string; help_text: string }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('survey_questions')
        .select('id, label, help_text, position, translations').eq('survey_id', surveyId).order('position');
      setRows((data ?? []) as Q[]);
    })();
  }, [surveyId]);

  useEffect(() => {
    const d: Record<string, { label: string; help_text: string }> = {};
    for (const q of rows) {
      const t = (q.translations ?? {})[lang] ?? {};
      d[q.id] = { label: t.label ?? '', help_text: t.help_text ?? '' };
    }
    setDraft(d);
  }, [rows, lang]);

  async function save() {
    setBusy(true);
    for (const q of rows) {
      const next = { ...(q.translations ?? {}), [lang]: draft[q.id] ?? { label: '', help_text: '' } };
      const { error } = await (supabase as any).from('survey_questions').update({ translations: next }).eq('id', q.id);
      if (error) { toast.error(error.message); setBusy(false); return; }
    }
    setRows(rs => rs.map(q => ({ ...q, translations: { ...(q.translations ?? {}), [lang]: draft[q.id] } })));
    setBusy(false);
    toast.success('Übersetzungen gespeichert');
  }

  const langs = LANGUAGES.filter(l => l.code !== (baseLanguage ?? 'de'));

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Zielsprache</Label>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {langs.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={busy}><Save className="h-4 w-4 mr-2" />Speichern</Button>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Languages className="h-3.5 w-3.5" /> Leere Felder fallen automatisch auf die Ausgangssprache zurück.
        </p>
      </CardContent></Card>

      <div className="space-y-2">
        {rows.map(q => (
          <Card key={q.id}><CardContent className="p-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Original</Label>
              <p className="text-sm mt-1">{q.label}</p>
              {q.help_text && <p className="text-xs text-muted-foreground mt-1">{q.help_text}</p>}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Übersetzte Frage"
                value={draft[q.id]?.label ?? ''}
                onChange={e => setDraft(d => ({ ...d, [q.id]: { ...d[q.id], label: e.target.value } }))}
              />
              <Input
                placeholder="Übersetzter Hilfetext (optional)"
                value={draft[q.id]?.help_text ?? ''}
                onChange={e => setDraft(d => ({ ...d, [q.id]: { ...d[q.id], help_text: e.target.value } }))}
              />
            </div>
          </CardContent></Card>
        ))}
        {rows.length === 0 && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Zuerst Fragen anlegen.</CardContent></Card>
        )}
      </div>
    </div>
  );
}
