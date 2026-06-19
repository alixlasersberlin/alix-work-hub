import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Check, Loader2, Send, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import Turnstile from '@/components/Turnstile';
import { supabase } from '@/integrations/supabase/client';
import bgAsset from '@/assets/wizard/alix-lasers-bg.jpg.asset.json';
import WizardLanguageSwitcher from '@/components/WizardLanguageSwitcher';
import { useWizardLang } from '@/i18n/wizard';
import logoAsset from '@/assets/alix-lasers-logo-gold-new.png.asset.json';
import { ALIX_LASERS_MODELS, ALIX_BEAUTY_MODELS } from '@/lib/alix-models';

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
  laser_model: string;
  beauty_model: string;
  delivery_preference: string;
  first_name: string;
  last_name: string;
  company: string;
  is_startup: boolean;
  studio_years: string;
  studio_in_germany: boolean;
  has_nisv: '' | 'ja' | 'nein';
  country_code: string;
  phone: string;
  email: string;
  consultation_type: string;
  notes: string;
  consent_data: boolean;
  consent_contact: boolean;
  service_rating: number;
  flex_price: string;
  flex_down: string;
  flex_term: number;
};

const INITIAL: State = {
  interests: [],
  additional_interests: [],
  laser_model: '',
  beauty_model: '',
  delivery_preference: '',
  first_name: '',
  last_name: '',
  company: '',
  is_startup: false,
  studio_years: '',
  studio_in_germany: false,
  has_nisv: '',
  country_code: '+49',
  phone: '',
  email: '',
  consultation_type: '',
  notes: '',
  consent_data: false,
  consent_contact: false,
  service_rating: 0,
  flex_price: '',
  flex_down: '',
  flex_term: 24,
};

const FLEX_TERMS = [12, 24, 36, 48, 60] as const;

const TOTAL_STEPS = 14;

interface Props {
  /** When true the wizard renders the full public landing chrome (logo, watermark). */
  publicMode?: boolean;
}

// Shared input styling for the light premium look
// `!` important utilities override the global `.design-aurora.dark input/select` theme rules.
const inputCls =
  '!bg-white !text-slate-900 !border-slate-200 placeholder:text-slate-400 focus-visible:ring-amber-300/60 focus-visible:!border-amber-300 shadow-sm';
const selectCls =
  'w-full h-11 rounded-xl border px-3 text-sm !bg-white !text-slate-900 !border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300/60 shadow-sm';

export default function SalesWizard({ publicMode = false }: Props) {
  const { t } = useWizardLang();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<State>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; category: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const progress = useMemo(() => Math.round(((step + 1) / (TOTAL_STEPS + 1)) * 100), [step]);

  const goNext = () => { setDirection('forward'); setStep((s) => s + 1); };
  const goBack = () => { setDirection('backward'); setStep((s) => Math.max(0, s - 1)); };

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
      case 4: return !!data.delivery_preference;
      case 5: return !!data.first_name.trim() && !!data.last_name.trim();
      case 7: return data.phone.trim().length >= 3;
      case 9: return /.+@.+\..+/.test(data.email.trim());
      case 10: return !!data.consultation_type;
      case 12: return data.consent_data && data.consent_contact && (publicMode ? !!captchaToken : true);
      default: return true;
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const deviceLines: string[] = [];
      if (data.laser_model) deviceLines.push(`Wunschgerät (Alix Lasers): ${data.laser_model}`);
      if (data.beauty_model) deviceLines.push(`Wunschgerät (Alix Beauty): ${data.beauty_model}`);
      if (data.studio_in_germany) {
        deviceLines.push(`Studio in Deutschland: Ja`);
        if (data.has_nisv) deviceLines.push(`NISV: ${data.has_nisv === 'ja' ? 'Ja' : 'Nein'}`);
      }
      if (data.is_startup) deviceLines.push(`Neueröffnung / Startup: Ja`);
      else if (data.studio_years) deviceLines.push(`Studio besteht seit: ${data.studio_years} Jahr(e)`);
      const mergedNotes = [deviceLines.join('\n'), data.notes].filter(Boolean).join('\n\n');
      const { laser_model, beauty_model, studio_in_germany, has_nisv, is_startup, studio_years, ...rest } = data;
      const { data: json, error: fnError } = await supabase.functions.invoke('sales-wizard-submit', {
        body: {
          ...rest,
          notes: mergedNotes,
          additional_interests: [
            ...data.additional_interests,
            ...(laser_model ? [`Gerät: ${laser_model}`] : []),
            ...(beauty_model ? [`Gerät: ${beauty_model}`] : []),
            ...(studio_in_germany ? ['Studio: Deutschland'] : []),
            ...(studio_in_germany && has_nisv ? [`NISV: ${has_nisv === 'ja' ? 'Ja' : 'Nein'}`] : []),
            ...(is_startup ? ['Neueröffnung/Startup'] : []),
            ...(!is_startup && studio_years ? [`Studio besteht: ${studio_years} Jahr(e)`] : []),
          ],
          source: publicMode ? 'alixwork_wizard_public' : 'alixwork_wizard_internal',
          turnstile_token: captchaToken,
        },
      });
      if (fnError) throw new Error(fnError.message || 'Fehler beim Absenden');
      if (json?.error) throw new Error(json.message || json.error);
      setResult({ score: json.score, category: json.category });
      setDirection('forward');
      setStep(TOTAL_STEPS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const shellWrap = publicMode
    ? 'min-h-screen w-full relative overflow-hidden bg-cover bg-center bg-no-repeat bg-fixed'
    : 'w-full';

  return (
    <div
      className={shellWrap}
      style={
        publicMode
          ? {
              backgroundImage: `linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(247,246,242,0.9) 60%, rgba(238,240,245,0.92) 100%), url(${bgAsset.url})`,
            }
          : undefined
      }
    >
      {publicMode && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04] flex items-center justify-center select-none"
          >
            <div className="text-[18vw] font-black tracking-tighter text-slate-900 whitespace-nowrap">
              ALIX
            </div>
          </div>
          <div className="absolute inset-x-0 top-0 z-30 px-6 py-6 flex items-center justify-between">
            <img src={logoAsset.url} alt="Alix Lasers" className="h-9 md:h-10 w-auto" />
            <div className="flex items-center gap-4">
              <div className="text-xs text-slate-500 hidden md:block">100% AI Full Technologie</div>
              <WizardLanguageSwitcher variant="light" />
            </div>
          </div>
        </>
      )}
      {!publicMode && (
        <div className="relative z-30 flex justify-end mb-3">
          <WizardLanguageSwitcher variant="light" />
        </div>
      )}

      <div className={cn('relative z-20 mx-auto w-full max-w-2xl px-3 sm:px-4', publicMode ? 'pt-24 pb-10' : 'py-4')}>
        {/* Premium step bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-[11px] font-medium tracking-wide mb-2">
            <span className="text-slate-500">
              {t.step_of(Math.min(step + 1, TOTAL_STEPS), TOTAL_STEPS)}
            </span>
            <span className="text-slate-700">{progress}%</span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 via-rose-300 to-sky-300 shadow-[0_0_12px_rgba(251,191,36,0.55)] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 3D stage */}
        <div className="relative [perspective:1800px]">
          {/* Silver gradient border */}
          <div className="relative rounded-[28px] p-[1px] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(203,213,225,0.6)_40%,rgba(255,255,255,0.95)_70%,rgba(217,180,107,0.55))] shadow-[0_40px_120px_-30px_rgba(15,23,42,0.25),0_10px_30px_-10px_rgba(15,23,42,0.12)]">
            <div
              className={cn(
                'relative overflow-hidden rounded-[27px] border border-white/80',
                'bg-[radial-gradient(120%_120%_at_0%_0%,rgba(254,243,199,0.55),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(186,230,253,0.45),transparent_55%),linear-gradient(180deg,#ffffff_0%,#fbfaf7_100%)]',
                'backdrop-blur-2xl text-slate-900',
                'transition-transform duration-700 will-change-transform [transform:rotateX(0.4deg)]',
              )}
            >
              {/* Top highlight */}
              <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
              {/* Inner soft shine */}
              <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-white/70 blur-3xl" />

              <div className="relative p-6 md:p-9">
                <Slide key={step} direction={direction}>
                  {step === 0 && (
                    <div className="text-center space-y-6 py-4">
                      <img src={logoAsset.url} alt="Alix Lasers" className="mx-auto h-12 md:h-16 w-auto drop-shadow-[0_10px_25px_rgba(217,119,6,0.25)]" />
                      <div>
                        <p className="mt-2 text-xs md:text-sm text-slate-500 tracking-[0.22em] uppercase">
                          {t.brand_tag}
                        </p>
                      </div>
                      <p className="max-w-md mx-auto text-slate-600">{t.welcome_lead}</p>
                      <Button
                        size="lg"
                        onClick={goNext}
                        className="mt-2 px-10 h-12 rounded-xl bg-gradient-to-b from-[#d8b56a] to-[#b8893a] hover:from-[#e2c179] hover:to-[#c4953f] text-white shadow-[0_15px_40px_-15px_rgba(184,137,58,0.65),inset_0_1px_0_rgba(255,255,255,0.35)] transition"
                      >
                        {t.start} <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {step === 1 && (
                    <Section title={t.s_interests} hint={t.multi_select}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {INTERESTS.map((it) => {
                          const active = data.interests.includes(it.key);
                          const label = t.interests[it.key] || it.key;
                          return (
                            <button
                              key={it.key}
                              type="button"
                              onClick={() => toggle('interests', it.key)}
                              className={cn(
                                'relative aspect-square rounded-2xl overflow-hidden border transition-all group shadow-sm hover:-translate-y-0.5 hover:shadow-lg',
                                active
                                  ? 'border-amber-400 ring-2 ring-amber-300/60 shadow-[0_15px_40px_-15px_rgba(217,119,6,0.5)]'
                                  : 'border-white/80',
                              )}
                            >
                              <img src={it.img} alt={label} loading="lazy" width={768} height={768} className="absolute inset-0 w-full h-full object-cover opacity-95 group-hover:scale-[1.04] transition-transform duration-500" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/20 to-transparent" />
                              <div className="absolute inset-x-0 bottom-0 p-2.5 text-xs font-semibold text-white text-left drop-shadow">
                                {label}
                              </div>
                              {active && (
                                <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-amber-400 text-white flex items-center justify-center shadow-md">
                                  <Check className="h-4 w-4" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </Section>
                  )}

                  {step === 2 && (
                    <Section title={t.s_wish_device} hint={t.s_wish_device_hint}>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <Label style={{ color: '#000' }} className="text-[11px] font-semibold uppercase tracking-wide">{t.alix_lasers_label}</Label>
                          <select
                            value={data.laser_model}
                            onChange={(e) => setData({ ...data, laser_model: e.target.value })}
                            className={selectCls}
                          >
                            <option value="">{t.no_device}</option>
                            {ALIX_LASERS_MODELS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label style={{ color: '#000' }} className="text-[11px] font-semibold uppercase tracking-wide">{t.alix_beauty_label}</Label>
                          <select
                            value={data.beauty_model}
                            onChange={(e) => setData({ ...data, beauty_model: e.target.value })}
                            className={selectCls}
                          >
                            <option value="">{t.no_device}</option>
                            {ALIX_BEAUTY_MODELS.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </Section>
                  )}

                  {step === 3 && (
                    <Section title={t.s_additional} hint={t.optional_multi}>
                      <div className="space-y-2.5">
                        {ADDITIONAL.map((a) => {
                          const active = data.additional_interests.includes(a);
                          const label = t.additional[a] || a;
                          return (
                            <button
                              key={a}
                              type="button"
                              onClick={() => toggle('additional_interests', a)}
                              className={cn(
                                'w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
                                active
                                  ? 'border-amber-300 bg-amber-50/80 shadow-[0_8px_24px_-12px_rgba(217,119,6,0.45)]'
                                  : 'border-slate-200/80 bg-white/80 hover:border-amber-200 hover:bg-white',
                              )}
                            >
                              <div className={cn(
                                'h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition',
                                active ? 'border-amber-400 bg-amber-400' : 'border-slate-300',
                              )}>
                                {active && <Check className="h-3.5 w-3.5 text-white" />}
                              </div>
                              <span className="text-sm text-slate-800">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </Section>
                  )}

                  {step === 4 && (
                    <Section title={t.s_delivery}>
                      <RadioGroup value={data.delivery_preference} onValueChange={(v) => setData({ ...data, delivery_preference: v })} className="gap-2.5">
                        {DELIVERY.map((d) => (
                          <label key={d} className={cn(
                            'flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all',
                            data.delivery_preference === d
                              ? 'border-amber-300 bg-amber-50/80 shadow-[0_8px_24px_-12px_rgba(217,119,6,0.45)]'
                              : 'border-slate-200/80 bg-white/80 hover:border-amber-200 hover:bg-white',
                          )}>
                            <RadioGroupItem value={d} className="!border-amber-400 !text-amber-600 data-[state=checked]:!border-amber-500 data-[state=checked]:!bg-white [&_svg]:!fill-amber-600 [&_svg]:!text-amber-600" />
                            <span className="text-sm text-slate-800">{t.delivery[d] || d}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </Section>
                  )}

                  {step === 5 && (
                    <Section title={t.s_name} hint={t.required}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label={t.first_name}>
                          <Input value={data.first_name} onChange={(e) => setData({ ...data, first_name: e.target.value })} className={inputCls} />
                        </Field>
                        <Field label={t.last_name}>
                          <Input value={data.last_name} onChange={(e) => setData({ ...data, last_name: e.target.value })} className={inputCls} />
                        </Field>
                      </div>

                      <div className="mt-5 space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={data.studio_in_germany}
                            onChange={(e) => setData({ ...data, studio_in_germany: e.target.checked, has_nisv: e.target.checked ? data.has_nisv : '' })}
                            className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                          />
                          <span className="text-sm text-slate-700">
                            {t.studio_in_germany_label} <span className="text-slate-400">({t.optional})</span>
                          </span>
                        </label>

                        {data.studio_in_germany && (
                          <div className="pl-7 flex flex-wrap items-center gap-4">
                            <span className="text-sm text-slate-700">{t.has_nisv_q}</span>
                            <div className="flex gap-2">
                              {(['ja', 'nein'] as const).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setData({ ...data, has_nisv: v })}
                                  className={cn(
                                    'px-4 py-1.5 rounded-lg text-sm border transition',
                                    data.has_nisv === v
                                      ? 'border-amber-400 bg-amber-50 text-slate-900'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200',
                                  )}
                                >
                                  {v === 'ja' ? t.yes : t.no}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  {step === 6 && (
                    <Section title={t.s_company} hint={t.optional}>
                      <Input value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder={t.company_name} className={inputCls} />

                      <div className="mt-5 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={data.is_startup}
                            onChange={(e) => setData({ ...data, is_startup: e.target.checked, studio_years: e.target.checked ? '' : data.studio_years })}
                            className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                          />
                          <span className="text-sm text-slate-700">{t.startup_label}</span>
                        </label>

                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-700 whitespace-nowrap">{t.studio_exists_since}</span>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={999}
                            maxLength={3}
                            value={data.studio_years}
                            disabled={data.is_startup}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, '').slice(0, 3);
                              setData({ ...data, studio_years: v });
                            }}
                            placeholder={t.example_short}
                            className={cn(inputCls, 'w-28 disabled:opacity-40')}
                          />
                          <span className="text-sm text-slate-700">{t.years_label}</span>
                        </div>
                      </div>
                    </Section>
                  )}

                  {step === 7 && (
                    <Section title={t.s_phone} hint={t.required}>
                      <div className="flex gap-2">
                        <select
                          value={data.country_code}
                          onChange={(e) => setData({ ...data, country_code: e.target.value })}
                          className={cn(selectCls, 'w-auto')}
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>{c.label}</option>
                          ))}
                        </select>
                        <Input
                          value={data.phone}
                          onChange={(e) => setData({ ...data, phone: e.target.value })}
                          placeholder={t.phone_placeholder}
                          inputMode="tel"
                          className={inputCls}
                        />
                      </div>
                    </Section>
                  )}

                  {step === 8 && (() => {
                    const price = parseFloat(String(data.flex_price ?? '').replace(',', '.')) || 0;
                    const down = parseFloat(String(data.flex_down ?? '').replace(',', '.')) || 0;
                    const base = Math.max(0, price - down);
                    const monthly = data.flex_term > 0 ? base / data.flex_term : 0;
                    const fmt = (v: number) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
                    return (
                      <Section title="Alix Flex 0%" hint="Finanzierungsrechner – 0% effektiver Jahreszins (unverbindlich)">
                        <div className="space-y-4">
                          <Field label="Gesamtbetrag (€)">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              value={data.flex_price}
                              onChange={(e) => setData({ ...data, flex_price: e.target.value })}
                              placeholder="z. B. 25000"
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Anzahlung (€)">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              inputMode="decimal"
                              value={data.flex_down}
                              onChange={(e) => setData({ ...data, flex_down: e.target.value })}
                              placeholder="z. B. 5000"
                              className={inputCls}
                            />
                          </Field>
                          <Field label="Laufzeit">
                            <select
                              value={String(data.flex_term)}
                              onChange={(e) => setData({ ...data, flex_term: Number(e.target.value) })}
                              className={selectCls}
                            >
                              {FLEX_TERMS.map((m) => (
                                <option key={m} value={m}>{m} Monate</option>
                              ))}
                            </select>
                          </Field>

                          <div
                            className="relative overflow-hidden rounded-2xl p-[1px]"
                            style={{ background: 'linear-gradient(135deg,#f5d28a,#b8893a 50%,#f5d28a)' }}
                          >
                            <div
                              className="relative rounded-[15px] p-5"
                              style={{ background: 'linear-gradient(135deg,#fffaf0 0%,#fef3c7 55%,#fde9b3 100%)' }}
                            >
                              <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/70 blur-2xl" />
                              <div className="relative flex items-end justify-between gap-3">
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.28em] font-semibold" style={{ color: '#8a6314' }}>
                                    Monatliche Rate
                                  </div>
                                  <div className="mt-2 text-4xl md:text-5xl font-extrabold tabular-nums leading-none" style={{ color: '#1f2937' }}>
                                    {fmt(monthly)}
                                  </div>
                                  <div className="mt-3 text-[11px]" style={{ color: '#6b5733' }}>
                                    Finanzierungssumme <span className="font-semibold tabular-nums" style={{ color: '#1f2937' }}>{fmt(base)}</span> · {data.flex_term} Monate · 0,00 % eff. p. a.
                                  </div>
                                </div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full shadow-[0_10px_25px_-8px_rgba(184,137,58,0.6)]" style={{ background: 'linear-gradient(135deg,#e6c275,#b8893a)' }}>
                                  <Sparkles className="h-6 w-6 text-white" />
                                </div>
                              </div>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Beispielrechnung. Repräsentatives Angebot vorbehaltlich Bonitätsprüfung des Finanzierungspartners. Keine Garantie für endgültige Konditionen.
                          </p>
                        </div>
                      </Section>
                    );
                  })()}

                  {step === 9 && (
                    <Section title={t.s_email} hint={t.required}>
                      <Input type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder={t.email_placeholder} className={inputCls} />
                    </Section>
                  )}

                  {step === 10 && (
                    <Section title={t.s_consultation}>
                      <RadioGroup value={data.consultation_type} onValueChange={(v) => setData({ ...data, consultation_type: v })} className="gap-2.5">
                        {CONSULTATION.map((c) => (
                          <label key={c} className={cn(
                            'flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all',
                            data.consultation_type === c
                              ? 'border-amber-300 bg-amber-50/80 shadow-[0_8px_24px_-12px_rgba(217,119,6,0.45)]'
                              : 'border-slate-200/80 bg-white/80 hover:border-amber-200 hover:bg-white',
                          )}>
                            <RadioGroupItem value={c} className="!border-amber-400 !text-amber-600 data-[state=checked]:!border-amber-500 data-[state=checked]:!bg-white [&_svg]:!fill-amber-600 [&_svg]:!text-amber-600" />
                            <span className="text-sm text-slate-800">{t.consultation[c] || c}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </Section>
                  )}

                  {step === 11 && (
                    <Section title={t.s_notes} hint={t.s_notes_hint}>
                      <Textarea rows={5} value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} className={inputCls} />
                    </Section>
                  )}

                  {step === 12 && (
                    <Section title={t.s_privacy}>
                      <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200/80 bg-white/70 p-3.5">
                          <Checkbox checked={data.consent_data} onCheckedChange={(v) => setData({ ...data, consent_data: v === true })} />
                          <span className="text-sm text-slate-700">{t.consent_data}</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200/80 bg-white/70 p-3.5">
                          <Checkbox checked={data.consent_contact} onCheckedChange={(v) => setData({ ...data, consent_contact: v === true })} />
                          <span className="text-sm text-slate-700">{t.consent_contact}</span>
                        </label>
                        {publicMode && (
                          <div className="pt-2">
                            <Turnstile theme="light" onToken={(tok) => setCaptchaToken(tok)} onExpire={() => setCaptchaToken(null)} />
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  {step === 13 && (
                    <Section title={t.s_rating} hint={t.s_rating_hint}>
                      <div className="flex justify-center gap-2 py-3">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setData({ ...data, service_rating: n })}
                            className="transition hover:scale-110"
                          >
                            <Star
                              className={cn(
                                'h-10 w-10 transition',
                                n <= data.service_rating ? 'fill-amber-400 text-amber-400 drop-shadow-[0_4px_10px_rgba(251,191,36,0.5)]' : 'text-slate-300',
                              )}
                            />
                          </button>
                        ))}
                      </div>
                      {error && (
                        <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                          {error}
                        </div>
                      )}
                    </Section>
                  )}

                  {step === TOTAL_STEPS && result && (
                    <div className="text-center space-y-4 py-6">
                      <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center shadow-[0_10px_30px_-10px_rgba(16,185,129,0.45)]">
                        <Check className="h-8 w-8 text-emerald-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900">{t.thanks_title}</h2>
                      <p className="text-slate-600">{t.thanks_text}</p>
                      <div className="inline-block rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-slate-800">
                        {t.priority}: <strong>{result.category}</strong>
                      </div>
                    </div>
                  )}
                </Slide>

                {/* Navigation */}
                {step > 0 && step < TOTAL_STEPS && (
                  <div className="mt-7 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={goBack}
                      disabled={submitting}
                      className="h-11 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    >
                      <ArrowLeft className="h-4 w-4" /> {t.back}
                    </Button>
                    {step < 13 ? (
                      <Button
                        type="button"
                        onClick={goNext}
                        disabled={!canContinue() || submitting}
                        className="h-11 px-7 rounded-xl bg-gradient-to-b from-[#d8b56a] to-[#b8893a] hover:from-[#e2c179] hover:to-[#c4953f] text-white shadow-[0_15px_40px_-18px_rgba(184,137,58,0.7),inset_0_1px_0_rgba(255,255,255,0.35)] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none transition"
                      >
                        {t.next} <ArrowRight className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={submit}
                        disabled={submitting}
                        className="h-11 px-7 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white shadow-[0_15px_40px_-15px_rgba(217,119,6,0.6)] transition"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {t.submit}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {publicMode && (
          <p className="mt-6 text-center text-[11px] text-slate-500">{t.footer}</p>
        )}
      </div>
    </div>
  );
}

/** Slide transition for each step. Forward slides in from right, backward from left. */
function Slide({ children, direction }: { children: React.ReactNode; direction: 'forward' | 'backward' }) {
  const cls =
    direction === 'forward'
      ? 'animate-in slide-in-from-right-8 fade-in duration-500 ease-out'
      : 'animate-in slide-in-from-left-8 fade-in duration-500 ease-out';
  return <div className={cls}>{children}</div>;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl md:text-2xl font-bold tracking-tight !text-slate-900">{title}</h2>
        {hint && <p className="text-xs mt-1 !text-slate-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide !text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
