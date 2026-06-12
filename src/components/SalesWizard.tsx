import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Check, Loader2, Send, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import Turnstile from '@/components/Turnstile';
import { supabase } from '@/integrations/supabase/client';
import bgAsset from '@/assets/wizard/alix-lasers-bg.jpg.asset.json';

import imgHair from '@/assets/wizard/haarentfernung.jpg';
import imgFace from '@/assets/wizard/gesicht.jpg';
import imgBody from '@/assets/wizard/koerper.jpg';
import imgMedical from '@/assets/wizard/medical.jpg';
import imgKurs from '@/assets/wizard/kurs.jpg';
import imgAcademy from '@/assets/wizard/academy.jpg';

const INTERESTS = [
  { key: 'Haarentfernung', img: imgHair },
  { key: 'Gesichtsbehandlungen', img: imgFace },
  { key: 'Körperbehandlungen', img: imgBody },
  { key: 'Medical Department', img: imgMedical },
  { key: 'Professional Kurs', img: imgKurs },
  { key: 'Alix Academy', img: imgAcademy },
] as const;

const ADDITIONAL = [
  'NiSV Ausbildung',
  'Laserschulung',
  'Finanzierungsmöglichkeiten',
  'Mietkauf / Miete / Smart Impulse',
  'Katalog anfordern',
];

const DELIVERY = ['schnellstmöglich', '2–4 Wochen', '4–8 Wochen', 'mehr als 8 Wochen'];

const CONSULTATION = [
  'Telefonische Beratung',
  'WhatsApp Beratung',
  'Studio Beratung',
  'Alix Showroom',
  'Videoberatung',
];

const COUNTRY_CODES = [
  { code: '+49', label: 'DE +49' },
  { code: '+43', label: 'AT +43' },
  { code: '+41', label: 'CH +41' },
  { code: '+39', label: 'IT +39' },
  { code: '+33', label: 'FR +33' },
  { code: '+31', label: 'NL +31' },
  { code: '+34', label: 'ES +34' },
  { code: '+44', label: 'UK +44' },
];

type State = {
  interests: string[];
  additional_interests: string[];
  delivery_preference: string;
  first_name: string;
  last_name: string;
  company: string;
  country_code: string;
  phone: string;
  email: string;
  consultation_type: string;
  notes: string;
  consent_data: boolean;
  consent_contact: boolean;
  service_rating: number;
};

const INITIAL: State = {
  interests: [],
  additional_interests: [],
  delivery_preference: '',
  first_name: '',
  last_name: '',
  company: '',
  country_code: '+49',
  phone: '',
  email: '',
  consultation_type: '',
  notes: '',
  consent_data: false,
  consent_contact: false,
  service_rating: 0,
};

const TOTAL_STEPS = 12;

interface Props {
  /** When true the wizard renders the full public landing chrome (logo, watermark). */
  publicMode?: boolean;
}

export default function SalesWizard({ publicMode = false }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<State>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; category: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const progress = useMemo(() => Math.round(((step + 1) / (TOTAL_STEPS + 1)) * 100), [step]);

  const toggle = (list: keyof Pick<State, 'interests' | 'additional_interests'>, value: string) => {
    setData((d) => {
      const arr = new Set(d[list]);
      if (arr.has(value)) arr.delete(value);
      else arr.add(value);
      return { ...d, [list]: Array.from(arr) };
    });
  };

  function canContinue(): boolean {
    switch (step) {
      case 1: return data.interests.length > 0;
      case 3: return !!data.delivery_preference;
      case 4: return !!data.first_name.trim() && !!data.last_name.trim();
      case 6: return data.phone.trim().length >= 3;
      case 7: return /.+@.+\..+/.test(data.email.trim());
      case 8: return !!data.consultation_type;
      case 10: return data.consent_data && data.consent_contact && (publicMode ? !!captchaToken : true);
      default: return true;
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { data: json, error: fnError } = await supabase.functions.invoke('sales-wizard-submit', {
        body: {
          ...data,
          source: publicMode ? 'alixwork_wizard_public' : 'alixwork_wizard_internal',
          turnstile_token: captchaToken,
        },
      });
      if (fnError) throw new Error(fnError.message || 'Fehler beim Absenden');
      if (json?.error) throw new Error(json.message || json.error);
      setResult({ score: json.score, category: json.category });
      setStep(TOTAL_STEPS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const shellWrap = publicMode
    ? 'min-h-screen w-full text-white relative overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed'
    : 'w-full';

  return (
    <div
      className={shellWrap}
      style={publicMode ? { backgroundImage: `url(${bgAsset.url})` } : undefined}
    >
      {publicMode && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06] flex items-center justify-center select-none"
          >
            <div className="text-[18vw] font-black tracking-tighter text-white whitespace-nowrap">
              ALIX
            </div>
          </div>
          <div className="absolute inset-x-0 top-0 z-10 px-6 py-6 flex items-center justify-between">
            <div className="text-2xl font-bold tracking-[0.18em]">Alix Lasers ®</div>
            <div className="text-xs text-blue-100/70 hidden md:block">
              100% AI Full Technologie
            </div>
          </div>
        </>
      )}

      <div className={cn(
        'relative z-20 mx-auto w-full max-w-2xl px-4',
        publicMode ? 'pt-24 pb-12' : 'py-6',
      )}>
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={'text-cyan-200/70'}>
              Schritt {Math.min(step + 1, TOTAL_STEPS)} von {TOTAL_STEPS}
            </span>
            <span className={'text-cyan-200/70'}>
              {progress}%
            </span>
          </div>
          <Progress value={progress} className={publicMode ? 'bg-white/10' : ''} />
        </div>

        <div className="relative [perspective:1600px]">
          {/* Ambient AI orbs */}
          <div aria-hidden className="pointer-events-none absolute -inset-10 overflow-hidden">
            <div className="absolute -top-16 -left-10 h-64 w-64 rounded-full bg-cyan-400/30 blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl animate-pulse [animation-delay:1s]" />
            <div className="absolute top-1/3 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-300/20 blur-3xl animate-pulse [animation-delay:2s]" />
          </div>
          {/* Gradient border shell */}
          <div className="relative rounded-3xl p-[1.5px] bg-[conic-gradient(from_140deg,rgba(34,211,238,0.9),rgba(217,119,6,0.7),rgba(232,121,249,0.9),rgba(34,211,238,0.9))] shadow-[0_30px_120px_-20px_rgba(34,211,238,0.5)]">
            <Card className={cn(
              'relative overflow-hidden p-6 md:p-9 rounded-[calc(1.5rem-1.5px)] border-0',
              'bg-[radial-gradient(120%_120%_at_0%_0%,rgba(34,211,238,0.12),transparent_50%),radial-gradient(120%_120%_at_100%_100%,rgba(217,70,239,0.14),transparent_55%),linear-gradient(160deg,#070b1a_0%,#0b1228_45%,#0a0f24_100%)]',
              'backdrop-blur-2xl text-slate-100',
              'before:absolute before:inset-0 before:bg-[linear-gradient(transparent_95%,rgba(255,255,255,0.04)_95%),linear-gradient(90deg,transparent_95%,rgba(255,255,255,0.04)_95%)] before:bg-[size:36px_36px] before:opacity-40 before:pointer-events-none',
              'after:absolute after:inset-x-8 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-cyan-300/70 after:to-transparent',
              '[transform:rotateX(0.5deg)] transition-transform duration-700',
            )}>


          {/* Step 0 – Willkommen */}
          {step === 0 && (
            <div className="text-center space-y-6 py-6">
              <Sparkles className="h-12 w-12 mx-auto text-blue-400" />
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Alix Lasers ®</h1>
              <p className="mt-2 text-sm md:text-base text-cyan-200/80 tracking-[0.18em] uppercase">
                  100% AI Full Technologie · Alix Lasers®
                </p>
              </div>
              <p className="max-w-md mx-auto text-slate-200/90">
                Lass dich von Profis beraten und dir das beste Angebot erstellen.
              </p>

              <Button size="lg" onClick={() => setStep(1)} className="mt-2 px-10">
                START <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 1 – Interessen */}
          {step === 1 && (
            <Section title="Welche Bereiche interessieren Sie?" hint="Mehrfachauswahl möglich" publicMode={publicMode}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {INTERESTS.map((it) => {
                  const active = data.interests.includes(it.key);
                  return (
                    <button
                      key={it.key}
                      type="button"
                      onClick={() => toggle('interests', it.key)}
                      className={cn(
                        'relative aspect-square rounded-xl overflow-hidden border-2 transition-all group',
                        active
                          ? 'border-blue-400 ring-2 ring-blue-400/50'
                          : publicMode ? 'border-white/15 hover:border-white/40' : 'border-border hover:border-primary/60',
                      )}
                    >
                      <img src={it.img} alt={it.key} loading="lazy" width={768} height={768} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 transition" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-2 text-xs font-semibold text-white text-left">
                        {it.key}
                      </div>
                      {active && (
                        <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Step 2 – Zusätzliche Interessen */}
          {step === 2 && (
            <Section title="Zusätzliche Interessen" hint="Optional, Mehrfachauswahl" publicMode={publicMode}>
              <div className="space-y-2">
                {ADDITIONAL.map((a) => {
                  const active = data.additional_interests.includes(a);
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggle('additional_interests', a)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg border p-3 text-left transition backdrop-blur-sm',
                        active
                          ? 'border-cyan-400/80 bg-cyan-400/10 shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]'
                          : 'border-white/15 hover:border-cyan-300/50 bg-white/5',
                      )}

                    >
                      <div className={cn(
                        'h-5 w-5 rounded border flex items-center justify-center shrink-0',
                        active ? 'border-blue-400 bg-blue-500' : publicMode ? 'border-white/40' : 'border-muted-foreground',
                      )}>
                        {active && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <span className="text-sm">{a}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Step 3 – Lieferzeitraum */}
          {step === 3 && (
            <Section title="Gewünschter Lieferzeitraum" publicMode={publicMode}>
              <RadioGroup value={data.delivery_preference} onValueChange={(v) => setData({ ...data, delivery_preference: v })}>
                {DELIVERY.map((d) => (
                  <label key={d} className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition backdrop-blur-sm',
                    data.delivery_preference === d
                      ? 'border-cyan-400/80 bg-cyan-400/10 shadow-[0_0_20px_-4px_rgba(34,211,238,0.6)]'
                      : 'border-white/15 hover:border-cyan-300/50 bg-white/5',
                  )}>

                    <RadioGroupItem value={d} />
                    <span className="text-sm">{d}</span>
                  </label>
                ))}
              </RadioGroup>
            </Section>
          )}

          {/* Step 4 – Name */}
          {step === 4 && (
            <Section title="Wie heißen Sie?" hint="Pflichtfeld" publicMode={publicMode}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Vorname *">
                  <Input value={data.first_name} onChange={(e) => setData({ ...data, first_name: e.target.value })} className='bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-cyan-400/60 focus-visible:border-cyan-300/60' />
                </Field>
                <Field label="Nachname *">
                  <Input value={data.last_name} onChange={(e) => setData({ ...data, last_name: e.target.value })} className='bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-cyan-400/60 focus-visible:border-cyan-300/60' />
                </Field>
              </div>
            </Section>
          )}

          {/* Step 5 – Firma */}
          {step === 5 && (
            <Section title="Firma" hint="Optional" publicMode={publicMode}>
              <Input value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder="Firmenname" className='bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-cyan-400/60 focus-visible:border-cyan-300/60' />
            </Section>
          )}

          {/* Step 6 – Telefon */}
          {step === 6 && (
            <Section title="Telefonnummer" hint="Pflichtfeld" publicMode={publicMode}>
              <div className="flex gap-2">
                <select
                  value={data.country_code}
                  onChange={(e) => setData({ ...data, country_code: e.target.value })}
                  className="h-10 rounded-md border px-3 text-sm bg-white/5 border-white/15 text-white"

                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="text-foreground">{c.label}</option>
                  ))}
                </select>
                <Input
                  value={data.phone}
                  onChange={(e) => setData({ ...data, phone: e.target.value })}
                  placeholder="Telefonnummer"
                  inputMode="tel"
                  className='bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-cyan-400/60 focus-visible:border-cyan-300/60'
                />
              </div>
            </Section>
          )}

          {/* Step 7 – Email */}
          {step === 7 && (
            <Section title="E-Mail-Adresse" hint="Pflichtfeld" publicMode={publicMode}>
              <Input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="name@firma.de" className='bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-cyan-400/60 focus-visible:border-cyan-300/60' />
            </Section>
          )}

          {/* Step 8 – Beratungsart */}
          {step === 8 && (
            <Section title="Beratungsart" publicMode={publicMode}>
              <RadioGroup value={data.consultation_type} onValueChange={(v) => setData({ ...data, consultation_type: v })}>
                {CONSULTATION.map((c) => (
                  <label key={c} className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 cursor-pointer',
                    data.consultation_type === c
                      ? 'border-blue-400 bg-blue-500/10'
                      : publicMode ? 'border-white/15' : 'border-border',
                  )}>
                    <RadioGroupItem value={c} />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </RadioGroup>
            </Section>
          )}

          {/* Step 9 – Weitere Infos */}
          {step === 9 && (
            <Section title="Weitere Informationen" hint="Möchten Sie uns noch etwas zur Angebotserstellung mitteilen?" publicMode={publicMode}>
              <Textarea rows={6} value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} className='bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:ring-cyan-400/60 focus-visible:border-cyan-300/60' />
            </Section>
          )}

          {/* Step 10 – Datenschutz + Captcha */}
          {step === 10 && (
            <Section title="Datenschutz" publicMode={publicMode}>
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={data.consent_data} onCheckedChange={(v) => setData({ ...data, consent_data: v === true })} />
                  <span className="text-sm">Ich stimme der Verarbeitung meiner Daten zu.</span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox checked={data.consent_contact} onCheckedChange={(v) => setData({ ...data, consent_contact: v === true })} />
                  <span className="text-sm">Ich stimme der Kontaktaufnahme zu.</span>
                </label>
                {publicMode && (
                  <div className="pt-2">
                    <Turnstile theme="dark" onToken={(t) => setCaptchaToken(t)} onExpire={() => setCaptchaToken(null)} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Step 11 – Bewertung */}
          {step === 11 && (
            <Section title="Wie haben Sie uns gefunden?" hint="Optional – bewerten Sie Ihren bisherigen Eindruck" publicMode={publicMode}>
              <div className="flex justify-center gap-2 py-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setData({ ...data, service_rating: n })}
                    className="transition"
                  >
                    <Star
                      className={cn(
                        'h-10 w-10',
                        n <= data.service_rating ? 'fill-yellow-400 text-yellow-400' : (publicMode ? 'text-white/30' : 'text-muted-foreground'),
                      )}
                    />
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            </Section>
          )}

          {/* Final – Success */}
          {step === TOTAL_STEPS && result && (
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold">Vielen Dank!</h2>
              <p className={publicMode ? 'text-blue-100/80' : 'text-muted-foreground'}>
                Ihre Anfrage ist bei uns eingegangen. Ein Berater meldet sich zeitnah.
              </p>
              <div className={cn(
                'inline-block rounded-lg border px-4 py-2 text-sm',
                publicMode ? 'border-white/15 bg-white/5' : 'border-border bg-muted',
              )}>
                Bearbeitungs-Priorität: <strong>{result.category}</strong>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step > 0 && step < TOTAL_STEPS && (
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={submitting}
              >
                <ArrowLeft className="h-4 w-4" /> Zurück
              </Button>
              {step < 11 ? (
                <Button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canContinue() || submitting}
                >
                  Weiter <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Anfrage absenden
                </Button>
              )}
            </div>
          )}
            </Card>
          </div>
        </div>


        {publicMode && (
          <p className="mt-6 text-center text-[11px] text-blue-100/40">
            © Alix Lasers® · Alle Anfragen werden vertraulich behandelt.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, hint, children, publicMode }: { title: string; hint?: string; children: React.ReactNode; publicMode?: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        {hint && (
          <p className={cn('text-xs mt-1', 'text-cyan-200/70')}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide opacity-80">{label}</Label>
      {children}
    </div>
  );
}
