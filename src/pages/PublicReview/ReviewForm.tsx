import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Star, CheckCircle2, AlertTriangle } from 'lucide-react';

type Context = {
  customer_name: string | null;
  order_number: string | null;
  product_name: string | null;
  delivery_date: string | null;
};

export default function PublicReviewForm() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'invalid' | 'expired' | 'submitted' | 'ready' | 'sending' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [ctx, setCtx] = useState<Context | null>(null);

  const [delivery, setDelivery] = useState(0);
  const [driver, setDriver] = useState(0);
  const [training, setTraining] = useState<'ja' | 'teilweise' | 'nein' | ''>('');
  const [trainingText, setTrainingText] = useState('');
  const [improvement, setImprovement] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke('get-review-context', { body: { token } });
      if (error) { setState('invalid'); return; }
      const d = data as any;
      if (d?.error === 'already_submitted') { setState('submitted'); return; }
      if (d?.error === 'expired') { setState('expired'); return; }
      if (d?.error) { setState('invalid'); return; }
      setCtx(d);
      setState('ready');
    })();
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!delivery || !driver || !training) {
      setErrorMsg('Bitte beantworten Sie alle Pflichtfragen (Sterne und Einweisung).');
      return;
    }
    setErrorMsg('');
    setState('sending');
    const { data, error } = await supabase.functions.invoke('submit-review', {
      body: {
        token,
        rating_delivery: delivery,
        rating_driver_friendliness: driver,
        training_answer: training,
        rating_training_text: trainingText || null,
        improvement_text: improvement || null,
      },
    });
    if (error || (data as any)?.error) {
      setErrorMsg((data as any)?.error || error?.message || 'Fehler beim Senden');
      setState('error');
      return;
    }
    navigate('/bewertung/danke', { replace: true });
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col items-center px-4 py-10">
      <header className="w-full max-w-2xl flex items-center justify-center mb-8">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-tight">Alix Lasers</div>
          <div className="text-xs uppercase tracking-widest text-neutral-500 mt-1">Kundenbewertung</div>
        </div>
      </header>

      {state === 'loading' && (
        <div className="flex items-center gap-2 text-neutral-600"><Loader2 className="h-5 w-5 animate-spin" /> Bewertung wird geladen…</div>
      )}

      {state === 'invalid' && (
        <InfoCard icon={<AlertTriangle className="h-6 w-6 text-red-500" />} title="Link ungültig">
          Dieser Bewertungslink ist ungültig oder abgelaufen.
        </InfoCard>
      )}
      {state === 'expired' && (
        <InfoCard icon={<AlertTriangle className="h-6 w-6 text-amber-500" />} title="Link abgelaufen">
          Dieser Bewertungslink ist nicht mehr gültig.
        </InfoCard>
      )}
      {state === 'submitted' && (
        <InfoCard icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />} title="Bereits bewertet">
          Vielen Dank. Für diesen Auftrag wurde bereits eine Bewertung abgegeben.
        </InfoCard>
      )}

      {(state === 'ready' || state === 'sending' || state === 'error') && ctx && (
        <form onSubmit={submit} className="w-full max-w-2xl bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold">Ihre Bewertung zu Ihrer Lieferung</h1>
            <p className="text-sm text-neutral-600">
              {ctx.customer_name ? `Hallo ${ctx.customer_name}, ` : ''}vielen Dank, dass Sie sich kurz Zeit nehmen.
            </p>
            <div className="text-xs text-neutral-500 pt-2">
              {ctx.order_number && <>Auftrag: <span className="font-mono">{ctx.order_number}</span></>}
              {ctx.product_name && <> · Produkt: {ctx.product_name}</>}
              {ctx.delivery_date && <> · Liefertermin: {new Date(ctx.delivery_date).toLocaleDateString('de-DE')}</>}
            </div>
          </div>

          <Question label="Wie waren Sie mit der Lieferung des Produktes zufrieden?">
            <StarPicker value={delivery} onChange={setDelivery} />
          </Question>

          <Question label="War der Fahrer freundlich?">
            <StarPicker value={driver} onChange={setDriver} />
            <textarea
              value={trainingText}
              onChange={e => setTrainingText(e.target.value)}
              placeholder="Optional: Anmerkungen zum Fahrer"
              className="mt-3 w-full rounded-md border border-neutral-300 p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-neutral-900"
              maxLength={2000}
            />
          </Question>

          <Question label="Hat er Sie geschult und am Gerät eingewiesen?">
            <div className="flex flex-wrap gap-2">
              {(['ja', 'teilweise', 'nein'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTraining(v)}
                  className={`px-4 py-2 rounded-md border text-sm transition ${
                    training === v ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {v === 'ja' ? 'Ja' : v === 'teilweise' ? 'Teilweise' : 'Nein'}
                </button>
              ))}
            </div>
          </Question>

          <Question label="Welche Verbesserungen haben Sie für den Service?">
            <textarea
              value={improvement}
              onChange={e => setImprovement(e.target.value)}
              placeholder="Ihre Anregungen (optional)"
              className="w-full rounded-md border border-neutral-300 p-3 text-sm min-h-[110px] focus:outline-none focus:ring-2 focus:ring-neutral-900"
              maxLength={4000}
            />
          </Question>

          {errorMsg && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{errorMsg}</div>
          )}

          <button
            type="submit"
            disabled={state === 'sending'}
            className="w-full bg-neutral-900 text-white text-base font-semibold rounded-xl py-4 hover:bg-neutral-800 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
            Bewertung absenden
          </button>

          <p className="text-xs text-neutral-500 text-center">
            Ihre Angaben werden ausschließlich zur Verbesserung unseres Services verwendet.
          </p>
        </form>
      )}
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl shadow-sm p-8 text-center space-y-3">
      <div className="flex justify-center">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-neutral-600">{children}</p>
    </div>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-neutral-900">{label}</div>
      {children}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-1"
          aria-label={`${n} Sterne`}
        >
          <Star className={`h-8 w-8 ${n <= display ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'}`} />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm text-neutral-600">{value}/5</span>}
    </div>
  );
}
