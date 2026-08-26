import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import Turnstile from '@/components/Turnstile';
import { supabase } from '@/integrations/supabase/client';
import { loadBeratungFormOverride, type BeratungFormOverride } from '@/lib/beratung/formSettings';
import { loadBeratungLayoutFor, visibleSequence, defaultLayout, resolveOptions, fieldLabel, fieldPlaceholder, isFieldVisible, DEFAULT_ADDITIONAL, DEFAULT_DELIVERY, DEFAULT_CONSULTATION, type BeratungFormLayout } from '@/lib/beratung/formLayout';
import logoAsset from '@/assets/alix-lasers-logo-gold-new.png.asset.json';
import {
  PREMIUM_CATEGORIES,
  devicesForCategory,
  type PremiumCategory,
} from '@/lib/beratung-premium/categories';
import {
  EU_CODES,
  WORLD_CODES,
  CUSTOM_CODE,
  findCountry,
} from '@/lib/beratung-premium/country-codes';
import { usePremiumLang, tv, type PDict } from '@/i18n/premium-wizard';
import PremiumLanguageSwitcher from '@/components/PremiumLanguageSwitcher';

/**
 * ALIX Premium Beratung — zweite, eigenständige Beratungsstrecke (/beratung/premium).
 * Nutzt exakt dieselbe Angebots-/Lead-Logik wie /beratung (Edge Function
 * `sales-wizard-submit` → sales_leads → AlixWork Angebote). Kein eigenes Backend.
 */

const DELIVERY = ['schnellstmöglich', '2–4 Wochen', '4–8 Wochen', 'mehr als 8 Wochen'];

const ADDITIONAL = [
  'NiSV Ausbildung',
  'Laserschulung',
  'Finanzierungsmöglichkeiten',
  'Mietkauf / Miete / Smart Impulse',
  'Katalog anfordern',
];

const CONSULTATION = [
  'Telefonische Beratung',
  'WhatsApp Beratung',
  'Studio Beratung',
  'Alix Showroom',
  'Videoberatung',
];

// Ländervorwahlen: EU oben, dann weltweit (siehe country-codes.ts)


const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

function validateEmail(value: string, t: PDict): string | null {
  const v = value.trim();
  if (!v) return t.v_email_required;
  if (v.length > 255) return t.v_email_long;
  if (!EMAIL_RE.test(v)) return t.v_email_invalid;
  if (/\.\./.test(v)) return t.v_email_invalid;
  return null;
}

function validatePhone(code: string, value: string, t: PDict): string | null {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  if (!value.trim()) return t.v_phone_required;
  if (!digits) return t.v_phone_invalid;
  const c = findCountry(code);
  const min = c?.min ?? 6;
  const max = c?.max ?? 14;
  if (digits.length < min) return t.v_phone_short(min, c?.label ?? code);
  if (digits.length > max) return t.v_phone_long(max, c?.label ?? code);
  return null;
}

function validateName(value: string, label: string, required: boolean, t: PDict): string | null {
  const v = value.trim();
  if (!v) return required ? t.v_required(label) : null;
  if (v.length < 2) return t.v_min2(label);
  if (v.length > 100) return t.v_max100(label);
  if (/\d/.test(v)) return t.v_no_digits(label);
  return null;
}

function validateCompany(value: string, t: PDict): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length > 150) return t.v_company_max;
  return null;
}

function validateCountryCode(code: string, t: PDict): string | null {
  const v = code.trim();
  if (!v || v === '+') return t.v_code_required;
  if (!/^\+\d{1,4}$/.test(v)) return t.v_code_format;
  return null;
}

function validateNotes(value: string, t: PDict): string | null {
  if (value.length > 2000) return t.v_notes_long(value.length);
  return null;
}


const csvList = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
const csvHas = (v: string, item: string) => csvList(v).includes(item);
const csvToggle = (v: string, item: string) => {
  const list = csvList(v);
  return (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]).join(', ');
};

type FieldKey = 'first_name' | 'last_name' | 'company' | 'email' | 'country_code' | 'phone' | 'notes';


type State = {
  first_name: string;
  last_name: string;
  company: string;
  country_code: string;
  phone: string;
  email: string;
  category: PremiumCategory | '';
  devices: string[];
  delivery_preference: string;
  additional_interests: string[];
  consultation_type: string;
  notes: string;
  consent_data: boolean;
  consent_contact: boolean;
};

const INITIAL: State = {
  first_name: '',
  last_name: '',
  company: '',
  country_code: '+49',
  phone: '',
  email: '',
  category: '',
  devices: [],
  delivery_preference: '',
  additional_interests: [],
  consultation_type: '',
  notes: '',
  consent_data: false,
  consent_contact: false,
};

const LAST_STEP = 4; // ABSCHLUSS
const DONE_STEP = 5;

const chrome =
  'bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(203,213,225,0.55)_45%,rgba(255,255,255,0.95)_70%,rgba(186,214,232,0.6))]';

const fieldCls =
  'w-full h-12 rounded-xl border !border-slate-200 !bg-white px-4 text-[15px] !text-slate-900 placeholder:!text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] focus:outline-none focus:ring-2 focus:ring-sky-200/70 focus:border-sky-200 transition';

interface Props {
  publicMode?: boolean;
}

export default function PremiumSalesWizard({ publicMode = true }: Props) {
  const { lang, setLang, t } = usePremiumLang();
  const [step, setStep] = useState(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const slideBy = (dir: number) => {
    const el = sliderRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
  };
  const [data, setData] = useState<State>(INITIAL);
  const [customCode, setCustomCode] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [override, setOverride] = useState<BeratungFormOverride>({});
  const [layout, setLayout] = useState<BeratungFormLayout>(() => defaultLayout('premium'));
  useEffect(() => { loadBeratungFormOverride('premium').then(setOverride); }, []);
  useEffect(() => { loadBeratungLayoutFor('premium').then(setLayout); }, []);
  const seq = useMemo(() => visibleSequence('premium', layout), [layout]);
  const lastSlot = seq.length;
  const cur = step > 0 && step <= lastSlot ? seq[step - 1] : step === 0 ? 0 : 99;
  const so = (id: number) => layout.steps?.[String(id)] || {};
  const fl = (key: string, fallback: string) => fieldLabel(layout, key, fallback);
  const fp = (key: string, fallback?: string) => fieldPlaceholder(layout, key, fallback);
  const fVisible = (key: string) => isFieldVisible('premium', layout, key);
  const additionalOptions = useMemo(() => resolveOptions(layout, 'additional', DEFAULT_ADDITIONAL), [layout]);
  const deliveryOptions = useMemo(() => resolveOptions(layout, 'delivery', DEFAULT_DELIVERY), [layout]);
  const consultationOptions = useMemo(() => resolveOptions(layout, 'consultation', DEFAULT_CONSULTATION), [layout]);
  const STEP_LABELS = useMemo(
    () => seq.map((id) => layout.steps?.[String(id)]?.title || t.steps[id - 1] || `0${id}`),
    [seq, layout, t],
  );
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  /** Unterschritte: pro Schritt nur eine Frage. */
  const step1Subs = useMemo(
    () => ['name', ...(isFieldVisible('premium', layout, 'company') ? ['company'] : []), 'email', 'phone'] as const,
    [layout],
  );
  const SUB_COUNT: Record<number, number> = { 1: step1Subs.length, 3: 4 };
  const subTotal = SUB_COUNT[cur] ?? 1;
  const [sub, setSub] = useState(0);
  useEffect(() => { setSub(0); }, [cur]);
  const s1 = step1Subs[sub];


  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, sub]);

  const devices = useMemo(() => devicesForCategory(data.category), [data.category]);


  const toggleAdditional = (v: string) =>
    setData((d) => ({
      ...d,
      additional_interests: d.additional_interests.includes(v)
        ? d.additional_interests.filter((x) => x !== v)
        : [...d.additional_interests, v],
    }));

  const errors: Record<FieldKey, string | null> = {
    first_name: validateName(data.first_name, t.first_name, false, t),
    last_name: validateName(data.last_name, t.last_name.replace(' *', ''), true, t),
    company: validateCompany(data.company, t),
    email: validateEmail(data.email, t),
    country_code: validateCountryCode(data.country_code, t),
    phone: validatePhone(data.country_code, data.phone, t),
    notes: validateNotes(data.notes, t),
  };

  /** Sofort-Validierung: Fehler sobald das Feld angefasst oder „Weiter“ versucht wurde. */
  const showError = (k: FieldKey) => (touched[k] || attempted[cur] ? errors[k] : null);
  const isValid = (k: FieldKey) => !!touched[k] && !errors[k] && String(data[k] ?? '').trim().length > 0;
  const markTouched = (k: FieldKey) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const update = (k: FieldKey, v: string) => {
    markTouched(k);
    setData((d) => ({ ...d, [k]: v }));
  };

  const step1Ok = (['first_name', 'last_name', 'company', 'email', 'country_code', 'phone'] as FieldKey[]).every(
    (k) => !errors[k],
  );

  function canContinue(): boolean {
    switch (cur) {
      case 1:
        if (s1 === 'name') return !errors.first_name && !errors.last_name;
        if (s1 === 'company') return !errors.company;
        if (s1 === 'email') return !errors.email;
        if (s1 === 'phone') return !errors.country_code && !errors.phone;
        return step1Ok;

      case 2:
        return !!data.category;
      case 3:
        if (sub === 0) return !!data.delivery_preference;
        if (sub === 1) return !!data.consultation_type;
        if (sub === 2) return true;
        return !errors.notes;
      case LAST_STEP:
        return data.consent_data && data.consent_contact && (publicMode && !captchaUnavailable ? !!captchaToken : true);
      default:
        return true;
    }
  }

  /** Weiter: erst Unterfrage, dann Schritt. */
  function goNext() {
    if (!canContinue()) { revealStepErrors(); return; }
    if (sub < subTotal - 1) { setSub((s) => s + 1); return; }
    setStep((s) => s + 1);
  }

  function goBack() {
    if (sub > 0) { setSub((s) => s - 1); return; }
    setStep((s) => Math.max(0, s - 1));
  }

  /** Antwort gegeben → automatisch zur nächsten Frage sliden. */
  function autoAdvance() {
    window.setTimeout(() => {
      setSub((s) => (s < subTotal - 1 ? s + 1 : s));
    }, 650);
  }

  /** Blockierter „Weiter“-Klick: alle Fehler des Schritts sichtbar machen. */
  function revealStepErrors() {
    setAttempted((a) => ({ ...a, [cur]: true }));
    if (cur === 1) {
      setTouched({
        first_name: true,
        last_name: true,
        company: true,
        email: true,
        country_code: true,
        phone: true,
      });
    }
  }


  function selectCategory(cat: PremiumCategory) {
    setData((d) => ({ ...d, category: cat, devices: [] }));
    setAnalyzing(true);
    window.setTimeout(() => {
      setAnalyzing(false);
      setStep((s) => s + 1);
    }, 1500);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const recommended = devices.map((d) => d.name);
      const answerLines = [
        `Quelle: ALIX Premium Beratung`,
        `consultation_category: ${data.category}`,
        `Lieferzeitraum: ${data.delivery_preference || '—'}`,
        `Beratungsart: ${data.consultation_type || '—'}`,
        `Weitere Interessen: ${data.additional_interests.join(', ') || '—'}`,
        `Empfohlene Systeme: ${recommended.join(', ') || '—'}`,
        `Ausgewählte Systeme: ${data.devices.join(', ') || '—'}`,
        `Firma: ${data.company || '—'}`,
        `Zeitpunkt: ${new Date().toLocaleString('de-DE')}`,
      ].join('\n');
      const mergedNotes = [answerLines, data.notes.trim()].filter(Boolean).join('\n\n').slice(0, 4000);

      const { data: json, error: fnError } = await supabase.functions.invoke('sales-wizard-submit', {
        body: {
          interests: [data.category].filter(Boolean),
          additional_interests: [
            `Kategorie: ${data.category}`,
            ...data.additional_interests,
            ...data.devices.map((d) => `Gerät: ${d}`),
          ],
          delivery_preference: data.delivery_preference || null,
          first_name: data.first_name,
          last_name: data.last_name,
          company: data.company || null,
          country_code: data.country_code,
          phone: `${data.country_code} ${data.phone.replace(/\D/g, '').replace(/^0+/, '')}`.trim(),
          email: data.email,
          consultation_type: data.consultation_type || null,
          notes: mergedNotes,
          consent_data: true,
          consent_contact: true,
          service_rating: 0,
          source: 'ALIX Premium Beratung',
          turnstile_token: captchaToken,
        },
      });
      if (fnError) throw new Error(fnError.message || t.err_submit);
      if (json?.error) throw new Error(json.message || json.error);
      setDone(true);
      setStep(lastSlot + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.err_unknown);
    } finally {
      setSubmitting(false);
    }
  }

  const activeWorld =
    PREMIUM_CATEGORIES.find((c) => c.key === data.category)?.world ??
    'from-[#fdfdfc] via-[#f5f6f7] to-[#eceef1]';

  return (
    <div className={cn('min-h-[100dvh] w-full flex flex-col bg-gradient-to-b !text-slate-900', activeWorld)}>
      {/* Header */}
      <header className="px-4 sm:px-6 md:px-10 py-4 sm:py-5 md:py-6 flex items-center justify-between gap-3">
        <a href="https://www.alix-lasers.de" target="_blank" rel="noopener noreferrer" aria-label="ALIX Lasers Webseite">
          <img src={logoAsset.url} alt="ALIX Lasers" className="h-7 sm:h-8 md:h-9 w-auto transition-opacity hover:opacity-80" />
        </a>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[10px] md:text-[11px] tracking-[0.3em] md:tracking-[0.35em] !text-slate-500 uppercase text-right whitespace-nowrap">
            {t.brand}
          </span>
          <PremiumLanguageSwitcher lang={lang} onChange={setLang} />
        </div>
      </header>

      {/* Progress */}
      {step > 0 && step <= lastSlot && (
        <div className="px-4 sm:px-6 md:px-10">
          <div className="mx-auto max-w-4xl hidden sm:flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-[11px] tracking-[0.24em] uppercase">

            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const state = n < step ? 'done' : n === step ? 'active' : 'todo';
              return (
                <span key={label} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'tabular-nums',
                      state === 'active' && 'text-sky-600 font-semibold',
                      state === 'done' && '!text-slate-500',
                      state === 'todo' && 'text-slate-300',
                    )}
                  >
                    {state === 'done' ? <Check className="inline h-3 w-3" /> : `0${n}`}
                  </span>
                  <span
                    className={cn(
                      state === 'active' && 'text-slate-900',
                      state === 'done' && '!text-slate-500',
                      state === 'todo' && 'text-slate-300',
                    )}
                  >
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && <span className="text-slate-200 ml-2">—</span>}
                </span>
              );
            })}
          </div>

          {/* Fortschrittsbalken */}
          <div className="mx-auto max-w-4xl sm:mt-3">
            <div className="flex items-center justify-between gap-3 text-[10px] md:text-[11px] tracking-[0.16em] sm:tracking-[0.2em] uppercase !text-slate-500 mb-1.5">
              <span className="truncate">
                {t.step_of(step, STEP_LABELS.length)} · {STEP_LABELS[step - 1]}
              </span>
              <span className="tabular-nums shrink-0">
                {Math.round(((step - 1 + (sub + 1) / subTotal) / STEP_LABELS.length) * 100)} %
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-[width] duration-500 ease-out"
                style={{ width: `${((step - 1 + (sub + 1) / subTotal) / STEP_LABELS.length) * 100}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={STEP_LABELS.length}
                aria-valuenow={step}
                aria-label={t.progress_aria}
              />
            </div>

          </div>

          <div className="mx-auto max-w-4xl mt-3 sm:mt-4 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
        </div>
      )}

      <main className="px-4 sm:px-6 md:px-10 pt-6 sm:pt-8 md:pt-12 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <div key={`step-${step}`} className="mx-auto max-w-4xl animate-in fade-in slide-in-from-right-8 duration-500">

          {/* 0 — Intro */}
          {step === 0 && (
            <section className="text-center py-8 sm:py-12 md:py-20 animate-in fade-in duration-700">
              <p className="text-[10px] sm:text-[11px] tracking-[0.3em] sm:tracking-[0.4em] uppercase !text-slate-500">{t.intro_kicker}</p>
              <h1 className="!text-slate-900 mt-4 sm:mt-6 text-3xl sm:text-4xl md:text-6xl font-light tracking-tight leading-[1.1] text-balance">
                {t.intro_title}
              </h1>
              <p className="mt-4 sm:mt-6 max-w-xl mx-auto text-slate-500 text-[15px] sm:text-base md:text-lg font-light text-pretty">
                {t.intro_lead}
              </p>
              <button
                onClick={() => setStep(1)}
                className="mt-8 sm:mt-10 inline-flex w-full sm:w-auto justify-center items-center gap-3 h-14 px-8 sm:px-10 rounded-full bg-slate-900 text-white text-sm tracking-[0.2em] uppercase shadow-[0_25px_60px_-25px_rgba(15,23,42,0.6)] hover:bg-slate-800 transition"
              >
                {t.intro_cta} <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          )}

          {/* 1 — Profil */}
          {cur === 1 && (
            <Chapter title={so(1).title || t.c1_title} sub={so(1).sub ?? t.c1_sub}>
              <div key={`p-sub-${sub}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 animate-in fade-in slide-in-from-right-8 duration-500">

                {s1 === 'name' && (<>
                <Labeled label={fl('first_name', t.first_name)} error={showError('first_name')} valid={isValid('first_name')}>
                  <input
                    className={cn(fieldCls, showError('first_name') && '!border-red-300 focus:!ring-red-200')}
                    value={data.first_name}
                    maxLength={100}
                    aria-invalid={!!showError('first_name')}
                    onBlur={() => markTouched('first_name')}
                    onChange={(e) => update('first_name', e.target.value)}
                  />
                </Labeled>
                <Labeled label={fl('last_name', t.last_name)} error={showError('last_name')} valid={isValid('last_name')}>
                  <input
                    className={cn(fieldCls, showError('last_name') && '!border-red-300 focus:!ring-red-200')}
                    value={data.last_name}
                    maxLength={100}
                    aria-invalid={!!showError('last_name')}
                    onBlur={() => markTouched('last_name')}
                    onChange={(e) => update('last_name', e.target.value)}
                  />
                </Labeled>
                </>)}
                {s1 === 'company' && (
                <Labeled label={fl('company', t.company)} error={showError('company')} valid={isValid('company')}>
                  <input
                    className={cn(fieldCls, showError('company') && '!border-red-300 focus:!ring-red-200')}
                    value={data.company}
                    maxLength={150}
                    placeholder={fp('company')}
                    aria-invalid={!!showError('company')}
                    onBlur={() => markTouched('company')}
                    onChange={(e) => update('company', e.target.value)}
                  />
                </Labeled>
                )}

                {s1 === 'email' && (
                <Labeled label={fl('email', t.email)} error={showError('email')} valid={isValid('email')}>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={255}
                    placeholder={fp('email', t.email_ph)}
                    className={cn(fieldCls, showError('email') && '!border-red-300 focus:!ring-red-200')}
                    value={data.email}
                    aria-invalid={!!showError('email')}
                    onBlur={() => markTouched('email')}
                    onChange={(e) => update('email', e.target.value)}
                  />
                </Labeled>
                )}
                {s1 === 'phone' && (
                <Labeled
                  label={fl('phone', t.phone)}

                  error={showError('country_code') ?? showError('phone')}
                  valid={isValid('phone') && !errors.country_code}
                >
                  <div className="flex flex-wrap gap-2">

                    <select
                      value={customCode ? CUSTOM_CODE : data.country_code}
                      onChange={(e) => {
                        if (e.target.value === CUSTOM_CODE) {
                          setCustomCode(true);
                          setData({ ...data, country_code: '+' });
                        } else {
                          setCustomCode(false);
                          setData({ ...data, country_code: e.target.value });
                        }
                      }}
                      className={cn(fieldCls, 'w-[120px] sm:w-[132px] shrink-0 px-3')}
                      aria-label={t.country_code_aria}
                    >
                      <option value={CUSTOM_CODE}>{t.code_other}</option>
                      <optgroup label={t.group_europe}>
                        {EU_CODES.map((c) => (
                          <option key={`eu-${c.label}`} value={c.code}>
                            {c.flag} {c.code} · {c.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t.group_world}>
                        {WORLD_CODES.map((c) => (
                          <option key={`w-${c.label}`} value={c.code}>
                            {c.flag} {c.code} · {c.label}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {customCode && (
                      <input
                        inputMode="tel"
                        maxLength={6}
                        placeholder="+000"
                        aria-label={t.code_custom_aria}
                        aria-invalid={!!showError('country_code')}
                        className={cn(
                          fieldCls,
                          'w-[96px] shrink-0',
                          showError('country_code') && '!border-red-300 focus:!ring-red-200',
                        )}
                        value={data.country_code}
                        onBlur={() => markTouched('country_code')}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d+]/g, '');
                          update('country_code', v.startsWith('+') ? v : `+${v.replace(/\+/g, '')}`);
                        }}
                      />
                    )}
                    <input
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={20}
                      placeholder={fp('phone', t.phone_ph)}
                      aria-invalid={!!showError('phone')}
                      className={cn(fieldCls, 'flex-1 min-w-[160px]', showError('phone') && '!border-red-300 focus:!ring-red-200')}
                      value={data.phone}
                      onBlur={() => markTouched('phone')}
                      onChange={(e) => update('phone', e.target.value.replace(/[^\d\s+()/-]/g, ''))}
                    />

                  </div>
                  <p className="text-[11px] !text-slate-400">
                    {customCode
                      ? t.hint_custom_code
                      : `${findCountry(data.country_code)?.label ?? ''} — ${t.hint_no_leading_zero}`}
                  </p>
                </Labeled>
                )}
              </div>

            </Chapter>
          )}

          {/* 2 — Anwendung */}
          {cur === 2 && (
            <Chapter
              title={so(2).title || t.c2_title}
              sub={so(2).sub ?? t.c2_sub}
            >
              <div className="relative">
                <div
                  ref={sliderRef}
                  className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-4 px-4 sm:mx-0 sm:px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {PREMIUM_CATEGORIES.map((c) => {
                    const active = data.category === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => selectCategory(c.key)}
                        className={cn(
                          'group relative shrink-0 snap-start text-left rounded-[26px] p-[1px] transition-transform duration-500 hover:-translate-y-[3px]',
                          'w-[78%] xs:w-[70%] sm:w-[46%] md:w-[32%] lg:w-[30%]',
                          chrome,
                          active && 'ring-2 ring-sky-300/70',
                        )}
                      >
                        <div className="relative flex h-full flex-col overflow-hidden rounded-[25px] !bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
                          <div className="relative aspect-[16/10] max-h-32 sm:max-h-36 overflow-hidden">
                            <img
                              src={c.img}
                              alt={c.key}
                              loading="lazy"
                              width={1024}
                              height={768}
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/10 to-transparent" />
                            <span className="absolute top-3 left-4 text-[10px] tracking-[0.3em] text-slate-500">{c.no}</span>
                            <span
                              aria-hidden
                              className="pointer-events-none absolute -inset-x-1 top-0 h-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.7)_50%,transparent_65%)]"
                            />
                          </div>
                          <div className="px-4 pb-4 pt-2.5">
                            <h3 className="!text-slate-900 text-sm sm:text-base font-light tracking-tight uppercase text-balance">{tv(t.categories, c.key)}</h3>
                            <p className="mt-1 text-[12px] leading-snug text-slate-500 font-light line-clamp-2">{t.category_desc[c.key] ?? c.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    aria-label="Zurück"
                    onClick={() => slideBy(-1)}
                    className="h-9 w-9 rounded-full border border-slate-200 bg-white/90 !text-slate-600 flex items-center justify-center shadow-sm hover:!text-slate-900 transition"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Weiter"
                    onClick={() => slideBy(1)}
                    className="h-9 w-9 rounded-full border border-slate-200 bg-white/90 !text-slate-600 flex items-center justify-center shadow-sm hover:!text-slate-900 transition"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

            </Chapter>
          )}

          {/* 3 — Bedarf */}
          {cur === 3 && (
            <Chapter title={so(3).title || t.c3_title} sub={so(3).sub ?? t.c3_sub(tv(t.categories, data.category))}>
              <div key={`sub-${sub}`} className="animate-in fade-in slide-in-from-right-8 duration-500">
                {sub === 0 && (
                  <Group
                    label={t.g_delivery}
                    valid={!!data.delivery_preference}
                    error={attempted[3] && !data.delivery_preference ? t.g_delivery_err : null}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {deliveryOptions.map((d) => (
                        <Pill key={d} active={csvHas(data.delivery_preference, d)} onClick={() => { setData({ ...data, delivery_preference: csvToggle(data.delivery_preference, d) }); autoAdvance(); }}>
                          {tv(t.delivery, d)}
                        </Pill>
                      ))}
                    </div>
                  </Group>
                )}

                {sub === 1 && (
                  <Group
                    label={t.g_consultation}
                    valid={!!data.consultation_type}
                    error={attempted[3] && !data.consultation_type ? t.g_consultation_err : null}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {consultationOptions.map((c) => (
                        <Pill key={c} active={csvHas(data.consultation_type, c)} onClick={() => { setData({ ...data, consultation_type: csvToggle(data.consultation_type, c) }); autoAdvance(); }}>
                          {tv(t.consultation, c)}
                        </Pill>
                      ))}
                    </div>
                  </Group>
                )}

                {sub === 2 && (
                  <Group label={t.g_additional}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {additionalOptions.map((a) => (
                        <Pill key={a} active={data.additional_interests.includes(a)} onClick={() => toggleAdditional(a)}>
                          {tv(t.additional, a)}
                        </Pill>
                      ))}
                    </div>
                  </Group>
                )}

                {sub === 3 && (
                  <Group label={t.g_notes} error={showError('notes')}>
                    <textarea
                      rows={5}
                      value={data.notes}
                      maxLength={2100}
                      aria-invalid={!!showError('notes')}
                      onBlur={() => markTouched('notes')}
                      onChange={(e) => update('notes', e.target.value)}
                      className={cn(fieldCls, 'h-auto py-3 resize-none', showError('notes') && '!border-red-300 focus:!ring-red-200')}
                    />
                    <p className={cn('mt-1 text-[11px] text-right', data.notes.length > 2000 ? '!text-red-500' : '!text-slate-400')}>
                      {data.notes.length}/2000
                    </p>
                  </Group>
                )}
              </div>

            </Chapter>
          )}

          {/* 4 — Abschluss */}
          {cur === LAST_STEP && (
            <Chapter title={so(4).title || t.c4_title} sub={so(4).sub ?? t.c4_sub}>
              <div className="space-y-4 max-w-2xl">
                <label
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border !bg-white p-4 cursor-pointer transition',
                    attempted[cur] && !data.consent_data ? '!border-red-300' : '!border-slate-200',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={data.consent_data}
                    aria-invalid={attempted[cur] && !data.consent_data}
                    onChange={(e) => setData({ ...data, consent_data: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-sky-500"
                  />
                  <span className="text-sm !text-slate-600 font-light">
                    {t.consent_data}
                  </span>
                </label>
                {attempted[cur] && !data.consent_data && (
                  <p role="alert" className="-mt-2 text-[12px] !text-red-500 font-light">
                    {t.consent_required}
                  </p>
                )}
                <label
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border !bg-white p-4 cursor-pointer transition',
                    attempted[cur] && !data.consent_contact ? '!border-red-300' : '!border-slate-200',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={data.consent_contact}
                    aria-invalid={attempted[cur] && !data.consent_contact}
                    onChange={(e) => setData({ ...data, consent_contact: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-sky-500"
                  />
                  <span className="text-sm !text-slate-600 font-light">
                    {t.consent_contact}
                  </span>
                </label>
                {attempted[cur] && !data.consent_contact && (
                  <p role="alert" className="-mt-2 text-[12px] !text-red-500 font-light">
                    {t.consent_required}
                  </p>
                )}
                {publicMode && !captchaUnavailable && (
                  <Turnstile
                    theme="light"
                    onToken={(tok) => setCaptchaToken(tok)}
                    onExpire={() => setCaptchaToken(null)}
                    onUnavailable={() => setCaptchaUnavailable(true)}
                  />
                )}
                {attempted[cur] && publicMode && !captchaUnavailable && !captchaToken && (
                  <p role="alert" className="text-[12px] !text-red-500 font-light">
                    {t.captcha_required}
                  </p>
                )}

                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">{error}</div>
                )}
              </div>
            </Chapter>
          )}

          {/* 6 — Danke */}
          {step > lastSlot && done && (
            <section className="text-center py-16 md:py-24 animate-in fade-in duration-700">
              <div className="mx-auto h-16 w-16 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-[0_25px_60px_-35px_rgba(15,23,42,0.5)]">
                <Check className="h-7 w-7 text-slate-800" />
              </div>
              <h2 className="!text-slate-900 mt-8 text-3xl md:text-5xl font-light tracking-tight">{override.thanks_title || t.done_title}</h2>
              <p className="mt-5 text-slate-500 font-light">
                {override.thanks_text || t.done_text}
              </p>
              <p className="mt-2 text-sm !text-slate-500 font-light">
                {override.thanks_hint || t.done_hint}
              </p>
            </section>
          )}
        </div>
      </main>

      {/* Sticky Navigation */}
      {step > 0 && step <= lastSlot && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-10 py-3 sm:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="h-13 min-h-[52px] px-4 sm:px-6 rounded-full border border-slate-200 bg-white !text-slate-600 text-[11px] sm:text-[12px] tracking-[0.16em] sm:tracking-[0.2em] uppercase whitespace-nowrap hover:text-slate-900 transition disabled:opacity-40"
            >
              <ArrowLeft className="inline h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">{t.back}</span>
            </button>
            <div className="flex-1" />
            {step < lastSlot ? (
              <button
                type="button"
                onClick={goNext}
                aria-disabled={!canContinue()}
                disabled={submitting}
                className={cn(
                  'h-13 min-h-[52px] flex-1 sm:flex-none px-6 sm:px-8 rounded-full text-white text-[11px] sm:text-[12px] tracking-[0.16em] sm:tracking-[0.2em] uppercase whitespace-nowrap transition',
                  canContinue()
                    ? 'bg-slate-900 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.8)] hover:bg-slate-800'
                    : 'bg-slate-300',
                )}
              >
                {t.next} <ArrowRight className="inline h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => (canContinue() ? submit() : revealStepErrors())}
                aria-disabled={!canContinue()}
                disabled={submitting}
                className={cn(
                  'h-13 min-h-[52px] flex-1 sm:flex-none px-6 sm:px-8 rounded-full text-white text-[11px] sm:text-[12px] tracking-[0.16em] sm:tracking-[0.2em] uppercase whitespace-nowrap transition',
                  canContinue()
                    ? 'bg-slate-900 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.8)] hover:bg-slate-800'
                    : 'bg-slate-300',
                )}
              >


                {submitting ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> : <Send className="inline h-4 w-4 mr-2" />}
                {t.send}
              </button>
            )}
          </div>
        </div>
      )}

      {/* SMART KI Moment */}
      {analyzing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/85 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative w-64 h-px overflow-hidden bg-slate-200">
            <span className="absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.9),transparent)] animate-[a2scan_1.2s_ease-in-out_infinite]" />
          </div>
          <p className="mt-8 text-[11px] tracking-[0.4em] uppercase text-slate-800">{t.brand}</p>
          <p className="mt-2 text-[11px] tracking-[0.3em] uppercase !text-slate-500">{t.analyzing}</p>
          <style>{`@keyframes a2scan{0%{transform:translateX(0)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}
    </div>
  );
}

function Chapter({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h2 className="!text-slate-900 text-lg sm:text-xl md:text-2xl font-light tracking-tight uppercase text-balance">{title}</h2>
      {sub && <p className="mt-1.5 sm:mt-2 !text-slate-500 font-light max-w-2xl text-[13px] sm:text-sm text-pretty">{sub}</p>}
      <div className="mt-4 sm:mt-6 md:mt-8">{children}</div>
    </section>
  );
}

function Group({
  label,
  error,
  valid,
  children,
}: {
  label: string;
  error?: string | null;
  valid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[10px] sm:text-[11px] tracking-[0.22em] sm:tracking-[0.28em] uppercase !text-slate-500 mb-3 sm:mb-4">
        {label}
        {valid && !error && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </p>

      {children}
      {error && (
        <p role="alert" aria-live="polite" className="mt-2 text-[12px] !text-red-500 font-light">
          {error}
        </p>
      )}
    </div>
  );
}


function Labeled({
  label,
  error,
  valid,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  valid?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase !text-slate-500">
        {label}
        {valid && !error && (
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p role="alert" aria-live="polite" className="text-[12px] !text-red-500 font-light">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] !text-slate-400 font-light">{hint}</p>
      ) : null}
    </div>
  );
}


function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'relative min-h-[56px] w-full rounded-2xl border pl-12 pr-5 text-left text-sm font-light transition',
        active
          ? '!border-emerald-400 !bg-white !text-slate-900 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.6)]'
          : '!border-slate-200 !bg-white/80 !text-slate-700 hover:!border-slate-300',
      )}
    >
      {active && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.9)] animate-in zoom-in duration-200">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      )}
      {children}
    </button>

  );
}
