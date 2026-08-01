import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Gift, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SurveyPublic() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [reward, setReward] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: res, error: err } = await (supabase as any).functions.invoke('survey-public', { body: { action: 'load', token } });
      if (err || res?.error) { setError(res?.error ?? 'Der Link ist ungültig oder abgelaufen.'); setState('error'); return; }
      if (res.already_completed) { setState('done'); setData(res); return; }
      setData(res); setAnswers(res.draft_answers ?? {}); setState('ready');
    })();
  }, [token]);

  function setAnswer(qid: string, v: any) { setAnswers(a => ({ ...a, [qid]: v })); }

  async function submit() {
    const missing = (data?.questions ?? []).filter((q: any) => q.required && (answers[q.id] === undefined || answers[q.id] === '' || answers[q.id] === null));
    if (missing.length) { toast.error('Bitte beantworten Sie alle Pflichtfragen.'); return; }
    setSubmitting(true);
    const { data: res, error: err } = await (supabase as any).functions.invoke('survey-public', { body: { action: 'submit', token, answers } });
    setSubmitting(false);
    if (err || res?.error) { toast.error(res?.error ?? 'Speichern fehlgeschlagen'); return; }
    setReward(res.reward ?? null);
    setState('done');
  }

  if (state === 'loading') return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /></Centered>;
  if (state === 'error') return <Centered><p className="text-sm text-muted-foreground">{error}</p></Centered>;

  if (state === 'done') return (
    <Centered>
      <Card className="max-w-lg w-full"><CardContent className="p-8 text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
        <h1 className="text-xl font-semibold">Vielen Dank für Ihre Rückmeldung!</h1>
        <p className="text-sm text-muted-foreground">{data?.survey?.outro_text ?? 'Ihre Antworten helfen uns, unsere Leistungen weiter zu verbessern.'}</p>
        {reward && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-left">
            <div className="flex items-center gap-2 font-medium"><Gift className="h-4 w-4 text-primary" />{reward.name}</div>
            {reward.description && <p className="text-sm text-muted-foreground mt-1">{reward.description}</p>}
            {reward.code && <p className="mt-2 text-sm">Ihr Code: <code className="font-mono text-primary">{reward.code}</code></p>}
          </div>
        )}
      </CardContent></Card>
    </Centered>
  );

  const s = data.survey;
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{s.public_title || s.name}</h1>
          {s.intro_text && <p className="text-sm text-muted-foreground whitespace-pre-line">{s.intro_text}</p>}
          {s.est_minutes && <p className="text-xs text-muted-foreground">Dauer: ca. {s.est_minutes} Minuten</p>}
        </header>

        {data.questions.map((q: any, i: number) => (
          <Card key={q.id}><CardContent className="p-5 space-y-3">
            {q.qtype === 'heading' ? <h2 className="text-lg font-semibold">{q.label}</h2>
              : q.qtype === 'description' ? <p className="text-sm text-muted-foreground">{q.label}</p>
              : q.qtype === 'divider' ? <hr className="border-border" />
              : (
                <>
                  <Label className="text-base">
                    {i + 1}. {q.label} {q.required && <span className="text-destructive">*</span>}
                  </Label>
                  {q.help_text && <p className="text-xs text-muted-foreground">{q.help_text}</p>}
                  <QuestionInput q={q} value={answers[q.id]} onChange={(v: any) => setAnswer(q.id, v)} />
                </>
              )}
          </CardContent></Card>
        ))}

        <div className="flex justify-end pb-10">
          <Button size="lg" onClick={submit} disabled={submitting}>{submitting ? 'Wird gesendet …' : 'Antworten absenden'}</Button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: any }) {
  return <div className="min-h-screen flex items-center justify-center bg-background p-6">{children}</div>;
}

function QuestionInput({ q, value, onChange }: { q: any; value: any; onChange: (v: any) => void }) {
  const opts = q.options ?? [];
  switch (q.qtype) {
    case 'textarea':
      return <Textarea rows={4} value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'number':
      return <Input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'date':
      return <Input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'yesno':
      return (
        <div className="flex gap-2">
          {['Ja', 'Nein'].map(v => (
            <Button key={v} type="button" variant={value === v ? 'default' : 'outline'} onClick={() => onChange(v)}>{v}</Button>
          ))}
        </div>
      );
    case 'stars':
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} Sterne`}>
              <Star className={`h-7 w-7 ${Number(value) >= n ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
      );
    case 'scale10':
    case 'nps': {
      const range = q.qtype === 'nps' ? Array.from({ length: 11 }, (_, i) => i) : Array.from({ length: 10 }, (_, i) => i + 1);
      return (
        <div className="flex flex-wrap gap-1">
          {range.map(n => (
            <Button key={n} type="button" size="sm" variant={Number(value) === n ? 'default' : 'outline'} onClick={() => onChange(n)}>{n}</Button>
          ))}
        </div>
      );
    }
    case 'slider':
      return (
        <div className="space-y-1">
          <input type="range" min={1} max={10} value={Number(value) || 5} onChange={e => onChange(Number(e.target.value))} className="w-full accent-primary" />
          <div className="text-sm text-muted-foreground">Wert: {Number(value) || 5}</div>
        </div>
      );
    case 'single':
    case 'dropdown':
      return (
        <div className="space-y-2">
          {opts.map((o: any) => (
            <button key={o.id} type="button" onClick={() => onChange(o.value ?? o.label)}
              className={`block w-full text-left rounded-md border px-3 py-2 text-sm ${value === (o.value ?? o.label) ? 'border-primary bg-primary/10' : 'border-border'}`}>
              {o.label}
            </button>
          ))}
        </div>
      );
    case 'multi':
    case 'ranking': {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {opts.map((o: any) => {
            const v = o.value ?? o.label;
            const checked = arr.includes(v);
            return (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={c => onChange(c ? [...arr, v] : arr.filter(x => x !== v))} />
                {o.label}
              </label>
            );
          })}
        </div>
      );
    }
    case 'consent':
    case 'contact_ok':
    case 'testimonial_ok':
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={!!value} onCheckedChange={c => onChange(!!c)} /> Ich stimme zu
        </label>
      );
    default:
      return <Input value={value ?? ''} onChange={e => onChange(e.target.value)} />;
  }
}
