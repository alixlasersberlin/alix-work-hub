import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { LOGIC_ACTIONS, LOGIC_OPERATORS, type LogicRule } from '@/lib/feedback/logic';

export default function SurveyLogicTab({ surveyId, questions }: { surveyId: string; questions: any[] }) {
  const sb = supabase as any;
  const [rules, setRules] = useState<LogicRule[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await sb.from('survey_logic_rules').select('*').eq('survey_id', surveyId).order('position');
    setRules(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [surveyId]);

  async function addRule() {
    if (questions.length < 1) { toast.error('Bitte zuerst Fragen anlegen'); return; }
    const { data, error } = await sb.from('survey_logic_rules').insert({
      survey_id: surveyId,
      source_question_id: questions[0].id,
      operator: 'eq',
      compare_value: { value: '' },
      action: 'show',
      target_question_id: questions[questions.length - 1]?.id ?? null,
      position: rules.length + 1,
      status: 'aktiv',
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setRules(r => [...r, data]);
  }

  async function patch(rid: string, p: any) {
    setRules(rs => rs.map(r => r.id === rid ? { ...r, ...p } : r));
    const { error } = await sb.from('survey_logic_rules').update(p).eq('id', rid);
    if (error) toast.error(error.message);
  }

  async function remove(rid: string) {
    await sb.from('survey_logic_rules').delete().eq('id', rid);
    setRules(rs => rs.filter(r => r.id !== rid));
  }

  const qLabel = (qid?: string | null) => {
    const i = questions.findIndex(q => q.id === qid);
    return i < 0 ? '–' : `${i + 1}. ${questions[i].label ?? ''}`.slice(0, 70);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rules.length} Regeln · Fragen abhängig von Antworten zeigen, überspringen oder die Umfrage beenden
        </p>
        <Button size="sm" onClick={addRule}><Plus className="h-4 w-4 mr-2" />Regel hinzufügen</Button>
      </div>

      {!loading && rules.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Workflow className="h-6 w-6 mx-auto mb-2 opacity-60" />
          Noch keine Logik hinterlegt. Alle Fragen werden allen Teilnehmern gezeigt.
        </CardContent></Card>
      )}

      {rules.map((r, i) => {
        const op = LOGIC_OPERATORS.find(o => o.value === r.operator);
        const act = LOGIC_ACTIONS.find(a => a.value === r.action);
        const cmp = r.compare_value && typeof r.compare_value === 'object' && 'value' in (r.compare_value as any)
          ? (r.compare_value as any).value : (r.compare_value ?? '');
        const src = questions.find(q => q.id === r.source_question_id);
        const opts = src?.__options ?? [];
        return (
          <Card key={r.id}>
            <CardContent className="p-4 grid gap-3 md:grid-cols-12 items-end">
              <div className="md:col-span-3">
                <Label>Wenn Frage {i + 1}</Label>
                <Select value={r.source_question_id ?? ''} onValueChange={v => patch(r.id, { source_question_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Frage wählen" /></SelectTrigger>
                  <SelectContent>
                    {questions.map(q => <SelectItem key={q.id} value={q.id}>{qLabel(q.id)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Bedingung</Label>
                <Select value={r.operator} onValueChange={v => patch(r.id, { operator: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOGIC_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Wert</Label>
                {opts.length > 0 && op?.needsValue ? (
                  <Select value={String(cmp ?? '')} onValueChange={v => patch(r.id, { compare_value: { value: v } })}>
                    <SelectTrigger><SelectValue placeholder="Antwort" /></SelectTrigger>
                    <SelectContent>{opts.map((o: any) => <SelectItem key={o.id} value={String(o.value ?? o.label)}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input
                    disabled={!op?.needsValue}
                    value={String(cmp ?? '')}
                    onChange={e => patch(r.id, { compare_value: { value: e.target.value } })}
                    placeholder={op?.needsValue ? 'z. B. 6' : '–'}
                  />
                )}
              </div>
              <div className="md:col-span-2">
                <Label>Dann</Label>
                <Select value={r.action} onValueChange={v => patch(r.id, { action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOGIC_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Zielfrage</Label>
                <Select
                  value={r.target_question_id ?? ''}
                  onValueChange={v => patch(r.id, { target_question_id: v })}
                >
                  <SelectTrigger disabled={!act?.needsTarget}><SelectValue placeholder={act?.needsTarget ? 'Frage wählen' : '–'} /></SelectTrigger>
                  <SelectContent>{questions.map(q => <SelectItem key={q.id} value={q.id}>{qLabel(q.id)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-1 flex items-center justify-end gap-2">
                <Switch
                  checked={(r.status ?? 'aktiv') === 'aktiv'}
                  onCheckedChange={v => patch(r.id, { status: v ? 'aktiv' : 'inaktiv' })}
                />
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
