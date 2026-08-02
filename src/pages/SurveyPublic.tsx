import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Gift, CheckCircle2, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  mergeDesign, ensureFontLoaded, designVars, tokenVars, backgroundStyle,
  buttonCss, shadowCss, animClasses, personalize,
} from '@/lib/feedback/design';
import { resolveMediaUrl } from '@/lib/feedback/media';

const STATIC_TYPES = ['heading', 'description', 'divider'];
const AUTO_ADVANCE = ['yesno', 'stars', 'nps', 'scale10', 'single', 'dropdown'];

export default function SurveyPublic() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [reward, setReward] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [anim, setAnim] = useState<'in-right' | 'in-left' | 'out-left' | 'out-right'>('in-right');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroUrl, setHeroUrl] = useState('');
  const [bgUrl, setBgUrl] = useState('');
  const timer = useRef<any>(null);

  const design = useMemo(() => mergeDesign(data?.survey?.design), [data]);

  useEffect(() => {
    (async () => {
      const { data: res, error: err } = await (supabase as any).functions.invoke('survey-public', { body: { action: 'load', token } });
      if (err || res?.error) { setError(res?.error ?? 'Der Link ist ungültig oder abgelaufen.'); setState('error'); return; }
      if (res.already_completed) { setState('done'); setData(res); return; }
      setData(res); setAnswers(res.draft_answers ?? {}); setState('ready');
    })();
  }, [token]);

  useEffect(() => { ensureFontLoaded(design.font); }, [design.font]);
  useEffect(() => { resolveMediaUrl(design.media.logoUrl).then(setLogoUrl); }, [design.media.logoUrl]);
  useEffect(() => { resolveMediaUrl(design.media.heroUrl).then(setHeroUrl); }, [design.media.heroUrl]);
  useEffect(() => { resolveMediaUrl(design.background.imageUrl).then(setBgUrl); }, [design.background.imageUrl]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Gruppiert Überschriften/Beschreibungen mit der folgenden Frage zu einem Slide
  const slides = useMemo(() => {
    const qs: any[] = data?.questions ?? [];
    const out: { intro: any[]; q: any | null; index: number }[] = [];
    let intro: any[] = [];
    let n = 0;
    for (const q of qs) {
      if (STATIC_TYPES.includes(q.qtype)) { intro.push(q); continue; }
      n += 1;
      out.push({ intro, q, index: n });
      intro = [];
    }
    if (intro.length) out.push({ intro, q: null, index: n });
    return out;
  }, [data]);

  function setAnswer(qid: string, v: any) { setAnswers(a => ({ ...a, [qid]: v })); }

  function isAnswered(q: any) {
    if (!q) return true;
    const v = answers[q.id];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== '' && v !== null;
  }

  function go(dir: 1 | -1) {
    const next = step + dir;
    if (next < 0 || next >= slides.length) return;
    if (design.animation === 'none') { setStep(next); return; }
    setAnim(dir === 1 ? 'out-left' : 'out-right');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setStep(next);
      setAnim(dir === 1 ? 'in-right' : 'in-left');
    }, 220);
  }

  function next() {
    const cur = slides[step];
    if (cur?.q?.required && !isAnswered(cur.q)) { toast.error('Bitte beantworten Sie diese Frage.'); return; }
    go(1);
  }

  function handleAnswer(q: any, v: any) {
    setAnswer(q.id, v);
    if (design.onePerPage && AUTO_ADVANCE.includes(q.qtype) && step < slides.length - 1) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => go(1), 260);
    }
  }

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

  const shellStyle: any = {
    ...tokenVars(design),
    ...designVars(design),
    ...backgroundStyle({ ...design, background: { ...design.background, imageUrl: bgUrl } }),
  };

  if (state === 'loading') return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /></Centered>;
  if (state === 'error') return <Centered><p className="text-sm text-muted-foreground">{error}</p></Centered>;

  const vars = {
    name: data?.recipient?.name ?? '',
    firma: data?.recipient?.firma ?? '',
    umfrage: data?.survey?.public_title ?? data?.survey?.name ?? '',
  };

  if (state === 'done') return (
    <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-lg w-full" style={{ borderRadius: design.radius, boxShadow: shadowCss(design.shadow) }}>
        <CardContent className="p-8 text-center space-y-4">
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: design.media.logoHeight }} className="mx-auto object-contain" />}
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
        </CardContent>
      </Card>
    </div>
  );

  const s = data.survey;
  const total = slides.length || 1;
  const current = slides[step];
  const isLast = step === slides.length - 1;
  const animClass = animClasses(design, anim);
  const greeting = personalize(design.personalization.greeting, vars);
  const split = design.layout === 'split' && !!heroUrl;
  const flat = design.layout === 'minimal';

  const header = (
    <header className="space-y-3">
      {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: design.media.logoHeight }} className="object-contain" />}
      {!split && heroUrl && (
        <img src={heroUrl} alt="" style={{ height: design.media.heroHeight, borderRadius: design.radius }} className="w-full object-cover" />
      )}
      {greeting && <p className="text-sm text-muted-foreground">{greeting}</p>}
      <h1 className="text-2xl font-semibold tracking-tight">{s.public_title || s.name}</h1>
      {step === 0 && s.intro_text && <p className="text-sm text-muted-foreground whitespace-pre-line">{s.intro_text}</p>}
      {step === 0 && s.est_minutes && <p className="text-xs text-muted-foreground">Dauer: ca. {s.est_minutes} Minuten</p>}
    </header>
  );

  const footer = (design.footer.text || design.footer.privacyUrl || design.footer.imprintUrl) ? (
    <footer className="pb-10 pt-2 text-[11px] text-muted-foreground space-x-3">
      {design.footer.text && <span>{design.footer.text}</span>}
      {design.footer.privacyUrl && <a href={design.footer.privacyUrl} target="_blank" rel="noreferrer" className="underline">Datenschutz</a>}
      {design.footer.imprintUrl && <a href={design.footer.imprintUrl} target="_blank" rel="noreferrer" className="underline">Impressum</a>}
    </footer>
  ) : null;

  // ---- Startseite ----
  if (design.startPage.enabled && !started) {
    return (
      <div style={shellStyle} className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-6 text-center">
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ height: design.media.logoHeight }} className="mx-auto object-contain" />}
          {heroUrl && <img src={heroUrl} alt="" style={{ height: design.media.heroHeight, borderRadius: design.radius }} className="w-full object-cover" />}
          {greeting && <p className="text-sm text-muted-foreground">{greeting}</p>}
          <h1 className="text-3xl font-semibold tracking-tight">{personalize(design.startPage.headline, vars) || s.public_title || s.name}</h1>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{personalize(design.startPage.text, vars) || s.intro_text}</p>
          <button className="px-6 py-3 text-sm font-medium" style={buttonCss(design)} onClick={() => setStarted(true)}>
            {design.startPage.button || 'Umfrage starten'}
          </button>
          {s.est_minutes && <p className="text-xs text-muted-foreground">Dauer: ca. {s.est_minutes} Minuten</p>}
          {footer}
        </div>
      </div>
    );
  }

  const progress = design.progress === 'none' ? null : (
    <div className="space-y-2">
      {design.progress === 'bar' && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      )}
      {design.progress === 'dots' && (
        <div className="flex flex-wrap gap-1.5">
          {slides.map((_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`} />)}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Frage {step + 1} von {total}</p>
    </div>
  );

  const cardStyle: any = {
    borderRadius: design.radius,
    boxShadow: flat ? 'none' : shadowCss(design.shadow),
    background: flat ? 'transparent' : undefined,
    border: flat ? 'none' : undefined,
  };

  // ---- Alle Fragen auf einer Seite ----
  if (!design.onePerPage) {
    return (
      <div style={shellStyle} className="min-h-screen py-10 px-4">
        <div className={`mx-auto space-y-6 ${design.layout === 'fullscreen' ? 'max-w-3xl' : 'max-w-2xl'}`}>
          {header}
          {slides.map(sl => (
            <Card key={sl.q?.id ?? `intro-${sl.index}`} style={cardStyle}>
              <CardContent className="p-6 space-y-4">
                {sl.intro?.map((h: any) => (
                  h.qtype === 'heading' ? <h2 key={h.id} className="text-lg font-semibold">{h.label}</h2>
                  : h.qtype === 'divider' ? <hr key={h.id} className="border-border" />
                  : <p key={h.id} className="text-sm text-muted-foreground whitespace-pre-line">{h.label}</p>
                ))}
                {sl.q && (
                  <>
                    <Label className="text-base">{sl.index}. {sl.q.label} {sl.q.required && <span className="text-destructive">*</span>}</Label>
                    {sl.q.help_text && <p className="text-xs text-muted-foreground">{sl.q.help_text}</p>}
                    <QuestionInput q={sl.q} value={answers[sl.q.id]} onChange={(v: any) => setAnswer(sl.q.id, v)} />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-end pb-4">
            <button className="px-6 py-3 text-sm font-medium" style={buttonCss(design)} onClick={submit} disabled={submitting}>
              {submitting ? 'Wird gesendet …' : 'Antworten absenden'}
            </button>
          </div>
          {footer}
        </div>
      </div>
    );
  }

  const questionBlock = (
    <div className="overflow-hidden">
      <Card key={step} className={`transition-all duration-200 ease-out ${animClass} ${design.layout === 'chat' ? 'rounded-br-none' : ''}`} style={cardStyle}>
        <CardContent className="p-6 space-y-4 min-h-[220px]">
          {current?.intro?.map((h: any) => (
            h.qtype === 'heading' ? <h2 key={h.id} className="text-lg font-semibold">{h.label}</h2>
            : h.qtype === 'divider' ? <hr key={h.id} className="border-border" />
            : <p key={h.id} className="text-sm text-muted-foreground whitespace-pre-line">{h.label}</p>
          ))}
          {current?.q && (
            <>
              <Label className="text-base">
                {current.index}. {current.q.label} {current.q.required && <span className="text-destructive">*</span>}
              </Label>
              {current.q.help_text && <p className="text-xs text-muted-foreground">{current.q.help_text}</p>}
              <QuestionInput q={current.q} value={answers[current.q.id]} onChange={(v: any) => handleAnswer(current.q, v)} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const navBlock = (
    <div className="flex items-center justify-between pb-10">
      <button className="px-4 py-2 text-sm disabled:opacity-40" style={buttonCss(design, 'ghost')} onClick={() => go(-1)} disabled={step === 0}>
        <ArrowLeft className="h-4 w-4 mr-1 inline" /> Zurück
      </button>
      {isLast ? (
        <button className="px-6 py-3 text-sm font-medium" style={buttonCss(design)} onClick={submit} disabled={submitting}>
          {submitting ? 'Wird gesendet …' : 'Antworten absenden'}
        </button>
      ) : (
        <button className="px-6 py-3 text-sm font-medium" style={buttonCss(design)} onClick={next}>
          Weiter <ArrowRight className="h-4 w-4 ml-1 inline" />
        </button>
      )}
    </div>
  );

  if (split) {
    return (
      <div style={shellStyle} className="min-h-screen grid md:grid-cols-2">
        <div className="hidden md:block bg-cover bg-center" style={{ backgroundImage: `url(${heroUrl})` }} />
        <div className="p-6 md:p-10 flex items-center">
          <div className="w-full max-w-xl space-y-6">
            {header}
            {progress}
            {questionBlock}
            {navBlock}
            {footer}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle} className={`min-h-screen px-4 ${design.layout === 'fullscreen' ? 'py-0 flex items-center' : 'py-10'}`}>
      <div className={`mx-auto w-full space-y-6 ${design.layout === 'fullscreen' ? 'max-w-3xl py-10' : 'max-w-2xl'}`}>
        {header}
        {progress}
        {questionBlock}
        {navBlock}
        {footer}
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
