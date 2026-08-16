import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import Turnstile from '@/components/Turnstile';
import { supabase } from '@/integrations/supabase/client';
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

function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'E-Mail ist ein Pflichtfeld.';
  if (v.length > 255) return 'E-Mail ist zu lang.';
  if (!EMAIL_RE.test(v)) return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  if (/\.\./.test(v)) return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
  return null;
}

function validatePhone(code: string, value: string): string | null {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  if (!value.trim()) return 'Telefonnummer ist ein Pflichtfeld.';
  if (!digits) return 'Bitte geben Sie eine gültige Telefonnummer ein.';
  const c = findCountry(code);
  const min = c?.min ?? 6;
  const max = c?.max ?? 14;
  if (digits.length < min) return `Die Nummer ist zu kurz (mind. ${min} Ziffern für ${c?.label ?? code}).`;
  if (digits.length > max) return `Die Nummer ist zu lang (max. ${max} Ziffern für ${c?.label ?? code}).`;
  return null;
}


const STEP_LABELS = ['PROFIL', 'ANWENDUNG', 'BEDARF', 'ABSCHLUSS'];

const csvList = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
const csvHas = (v: string, item: string) => csvList(v).includes(item);
const csvToggle = (v: string, item: string) => {
  const list = csvList(v);
  return (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]).join(', ');
};


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
  const [step, setStep] = useState(0);
  const [data, setData] = useState<State>(INITIAL);
  const [customCode, setCustomCode] = useState(false);
  const [touched, setTouched] = useState<{ last_name?: boolean; email?: boolean; phone?: boolean }>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaUnavailable, setCaptchaUnavailable] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const devices = useMemo(() => devicesForCategory(data.category), [data.category]);


  const toggleAdditional = (v: string) =>
    setData((d) => ({
      ...d,
      additional_interests: d.additional_interests.includes(v)
        ? d.additional_interests.filter((x) => x !== v)
        : [...d.additional_interests, v],
    }));

  const emailError = validateEmail(data.email);
  const phoneError = validatePhone(data.country_code, data.phone);
  const lastNameError = data.last_name.trim() ? null : 'Nachname ist ein Pflichtfeld.';

  function canContinue(): boolean {
    switch (step) {
      case 1:
        return !lastNameError && !emailError && !phoneError;

      case 2:
        return !!data.category;
      case 3:
        return !!data.delivery_preference && !!data.consultation_type;
      case LAST_STEP:
        return data.consent_data && data.consent_contact && (publicMode && !captchaUnavailable ? !!captchaToken : true);
      default:
        return true;
    }
  }

  function selectCategory(cat: PremiumCategory) {
    setData((d) => ({ ...d, category: cat, devices: [] }));
    setAnalyzing(true);
    window.setTimeout(() => {
      setAnalyzing(false);
      setStep(3);
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
      if (fnError) throw new Error(fnError.message || 'Fehler beim Absenden');
      if (json?.error) throw new Error(json.message || json.error);
      setDone(true);
      setStep(DONE_STEP);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
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
      <header className="px-5 md:px-10 py-6 flex items-center justify-between">
        <a href="https://www.alix-lasers.de" target="_blank" rel="noopener noreferrer" aria-label="ALIX Lasers Webseite">
          <img src={logoAsset.url} alt="ALIX Lasers" className="h-8 md:h-9 w-auto transition-opacity hover:opacity-80" />
        </a>
        <span className="text-[10px] md:text-[11px] tracking-[0.35em] !text-slate-500 uppercase">
          Alix Smart Consult
        </span>
      </header>

      {/* Progress */}
      {step > 0 && step <= LAST_STEP && (
        <div className="px-5 md:px-10">
          <div className="mx-auto max-w-4xl flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-[11px] tracking-[0.24em] uppercase">
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
          <div className="mx-auto max-w-4xl mt-3">
            <div className="flex items-center justify-between text-[10px] md:text-[11px] tracking-[0.2em] uppercase !text-slate-500 mb-1.5">
              <span>
                Schritt {step} von {STEP_LABELS.length} · {STEP_LABELS[step - 1]}
              </span>
              <span className="tabular-nums">
                {Math.round((step / STEP_LABELS.length) * 100)} %
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-[width] duration-500 ease-out"
                style={{ width: `${(step / STEP_LABELS.length) * 100}%` }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={STEP_LABELS.length}
                aria-valuenow={step}
                aria-label="Fortschritt der Beratung"
              />
            </div>
          </div>

          <div className="mx-auto max-w-4xl mt-4 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
        </div>
      )}


      <main className="px-5 md:px-10 pb-28 pt-8 md:pt-12">
        <div className="mx-auto max-w-4xl">
          {/* 0 — Intro */}
          {step === 0 && (
            <section className="text-center py-10 md:py-20 animate-in fade-in duration-700">
              <p className="text-[11px] tracking-[0.4em] uppercase !text-slate-500">Premium Consult</p>
              <h1 className="!text-slate-900 mt-6 text-4xl md:text-6xl font-light tracking-tight leading-[1.05]">
                IHRE ALIX BERATUNG
              </h1>
              <p className="mt-6 max-w-xl mx-auto text-slate-500 text-base md:text-lg font-light">
                In wenigen Schritten zu den passenden ALIX Systemen — persönlich, unverbindlich und
                direkt von einem ALIX Berater begleitet.
              </p>
              <button
                onClick={() => setStep(1)}
                className="mt-10 inline-flex items-center gap-3 h-14 px-10 rounded-full bg-slate-900 text-white text-sm tracking-[0.2em] uppercase shadow-[0_25px_60px_-25px_rgba(15,23,42,0.6)] hover:bg-slate-800 transition"
              >
                Beratung starten <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          )}

          {/* 1 — Profil */}
          {step === 1 && (
            <Chapter title="IHRE KONTAKTDATEN" sub="Damit ein ALIX Berater Sie erreichen kann.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Labeled label="Vorname">
                  <input className={fieldCls} value={data.first_name} onChange={(e) => setData({ ...data, first_name: e.target.value })} />
                </Labeled>
                <Labeled label="Nachname *" error={touched.last_name ? lastNameError : null}>
                  <input
                    className={cn(fieldCls, touched.last_name && lastNameError && '!border-red-300 focus:!ring-red-200')}
                    value={data.last_name}
                    maxLength={100}
                    onBlur={() => setTouched((t) => ({ ...t, last_name: true }))}
                    onChange={(e) => setData({ ...data, last_name: e.target.value })}
                  />
                </Labeled>
                <Labeled label="Unternehmen (optional)">
                  <input className={fieldCls} value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} />
                </Labeled>
                <Labeled label="E-Mail *" error={touched.email ? emailError : null}>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={255}
                    placeholder="name@praxis.de"
                    className={cn(fieldCls, touched.email && emailError && '!border-red-300 focus:!ring-red-200')}
                    value={data.email}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    onChange={(e) => setData({ ...data, email: e.target.value })}
                  />
                </Labeled>
                <Labeled label="Telefon *" error={touched.phone ? phoneError : null}>
                  <div className="flex gap-2">
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
                      className={cn(fieldCls, 'w-[132px] shrink-0 px-3')}
                      aria-label="Ländervorwahl"
                    >
                      <option value={CUSTOM_CODE}>➕ Andere…</option>
                      <optgroup label="Europa">
                        {EU_CODES.map((c) => (
                          <option key={`eu-${c.label}`} value={c.code}>
                            {c.flag} {c.code} · {c.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Weltweit">
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
                        aria-label="Vorwahl frei eingeben"
                        className={cn(fieldCls, 'w-[96px] shrink-0')}
                        value={data.country_code}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d+]/g, '');
                          setData({ ...data, country_code: v.startsWith('+') ? v : `+${v.replace(/\+/g, '')}` });
                        }}
                      />
                    )}
                    <input
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={20}
                      placeholder="171 1651000"
                      className={cn(fieldCls, touched.phone && phoneError && '!border-red-300 focus:!ring-red-200')}
                      value={data.phone}
                      onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                      onChange={(e) => setData({ ...data, phone: e.target.value.replace(/[^\d\s+()/-]/g, '') })}
                    />
                  </div>
                  <p className="text-[11px] !text-slate-400">
                    {customCode
                      ? 'Freie Ländervorwahl — ohne führende 0'
                      : `${findCountry(data.country_code)?.label ?? ''} — ohne führende 0`}
                  </p>
                </Labeled>
              </div>

            </Chapter>
          )}

          {/* 2 — Anwendung */}
          {step === 2 && (
            <Chapter
              title="WAS MÖCHTEN SIE BEHANDELN?"
              sub="Wählen Sie Ihren Schwerpunkt – wir führen Sie anschließend zu den passenden ALIX Systemen."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                {PREMIUM_CATEGORIES.map((c) => {
                  const active = data.category === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => selectCategory(c.key)}
                      className={cn(
                        'group relative text-left rounded-[26px] p-[1px] transition-transform duration-500 hover:-translate-y-[3px]',
                        chrome,
                        active && 'ring-2 ring-sky-300/70',
                      )}
                    >
                      <div className="relative overflow-hidden rounded-[25px] !bg-white shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]">
                        <div className="relative h-52 md:h-60 overflow-hidden">
                          <img
                            src={c.img}
                            alt={c.key}
                            loading="lazy"
                            width={1024}
                            height={768}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/10 to-transparent" />
                          <span className="absolute top-4 left-5 text-[11px] tracking-[0.3em] text-slate-500">{c.no}</span>
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -inset-x-1 top-0 h-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.7)_50%,transparent_65%)]"
                          />
                        </div>
                        <div className="px-6 pb-6 pt-4">
                          <h3 className="!text-slate-900 text-xl md:text-2xl font-light tracking-tight uppercase">{c.key}</h3>
                          <p className="mt-2 text-sm text-slate-500 font-light">{c.desc}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Chapter>
          )}

          {/* 3 — Bedarf */}
          {step === 3 && (
            <Chapter title="IHR BEDARF" sub={`Schwerpunkt: ${data.category}`}>
              <div className="space-y-10">
                <Group label="Gewünschter Lieferzeitraum (Mehrfachauswahl)">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {DELIVERY.map((d) => (
                      <Pill key={d} active={csvHas(data.delivery_preference, d)} onClick={() => setData({ ...data, delivery_preference: csvToggle(data.delivery_preference, d) })}>
                        {d}
                      </Pill>
                    ))}
                  </div>
                </Group>
                <Group label="Beratungsart (Mehrfachauswahl)">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CONSULTATION.map((c) => (
                      <Pill key={c} active={csvHas(data.consultation_type, c)} onClick={() => setData({ ...data, consultation_type: csvToggle(data.consultation_type, c) })}>
                        {c}
                      </Pill>
                    ))}
                  </div>
                </Group>

                <Group label="Weitere Interessen (optional)">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ADDITIONAL.map((a) => (
                      <Pill key={a} active={data.additional_interests.includes(a)} onClick={() => toggleAdditional(a)}>
                        {a}
                      </Pill>
                    ))}
                  </div>
                </Group>
                <Group label="Ihre Nachricht (optional)">
                  <textarea
                    rows={5}
                    value={data.notes}
                    onChange={(e) => setData({ ...data, notes: e.target.value })}
                    className={cn(fieldCls, 'h-auto py-3 resize-none')}
                  />
                </Group>
              </div>
            </Chapter>
          )}

          {/* 4 — Abschluss */}
          {step === LAST_STEP && (
            <Chapter title="ABSCHLUSS" sub="Bitte bestätigen Sie die Datenschutzhinweise.">
              <div className="space-y-4 max-w-2xl">
                <label className="flex items-start gap-3 rounded-2xl border !border-slate-200 !bg-white p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.consent_data}
                    onChange={(e) => setData({ ...data, consent_data: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-sky-500"
                  />
                  <span className="text-sm !text-slate-600 font-light">
                    Ich stimme der Verarbeitung meiner Daten zur Bearbeitung meiner Anfrage zu.
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border !border-slate-200 !bg-white p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.consent_contact}
                    onChange={(e) => setData({ ...data, consent_contact: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-sky-500"
                  />
                  <span className="text-sm !text-slate-600 font-light">
                    Ich bin mit einer Kontaktaufnahme per Telefon, E-Mail oder WhatsApp einverstanden.
                  </span>
                </label>
                {publicMode && !captchaUnavailable && (
                  <Turnstile
                    theme="light"
                    onToken={(tok) => setCaptchaToken(tok)}
                    onExpire={() => setCaptchaToken(null)}
                    onUnavailable={() => setCaptchaUnavailable(true)}
                  />
                )}
                {error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">{error}</div>
                )}
              </div>
            </Chapter>
          )}

          {/* 6 — Danke */}
          {step === DONE_STEP && done && (
            <section className="text-center py-16 md:py-24 animate-in fade-in duration-700">
              <div className="mx-auto h-16 w-16 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-[0_25px_60px_-35px_rgba(15,23,42,0.5)]">
                <Check className="h-7 w-7 text-slate-800" />
              </div>
              <h2 className="!text-slate-900 mt-8 text-3xl md:text-5xl font-light tracking-tight">VIELEN DANK.</h2>
              <p className="mt-5 text-slate-500 font-light">
                Ihre ALIX Beratung wurde erfolgreich übermittelt.
              </p>
              <p className="mt-2 text-sm !text-slate-500 font-light">
                Ein ALIX Berater kann nun Ihre Auswahl und Anforderungen einsehen.
              </p>
            </section>
          )}
        </div>
      </main>

      {/* Sticky Navigation */}
      {step > 0 && step <= LAST_STEP && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-5 md:px-10 py-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={submitting}
              className="h-13 min-h-[52px] px-6 rounded-full border border-slate-200 bg-white !text-slate-600 text-[12px] tracking-[0.2em] uppercase hover:text-slate-900 transition disabled:opacity-40"
            >
              <ArrowLeft className="inline h-4 w-4 mr-2" /> Zurück
            </button>
            <div className="flex-1" />
            {step < LAST_STEP ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue() || submitting}
                className="h-13 min-h-[52px] px-8 rounded-full bg-slate-900 text-white text-[12px] tracking-[0.2em] uppercase shadow-[0_20px_45px_-25px_rgba(15,23,42,0.8)] hover:bg-slate-800 transition disabled:bg-slate-300 disabled:shadow-none"
              >
                Weiter <ArrowRight className="inline h-4 w-4 ml-2" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canContinue() || submitting}
                className="h-13 min-h-[52px] px-8 rounded-full bg-slate-900 text-white text-[12px] tracking-[0.2em] uppercase shadow-[0_20px_45px_-25px_rgba(15,23,42,0.8)] hover:bg-slate-800 transition disabled:bg-slate-300"
              >
                {submitting ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> : <Send className="inline h-4 w-4 mr-2" />}
                Beratung absenden
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
          <p className="mt-8 text-[11px] tracking-[0.4em] uppercase text-slate-800">Alix Smart Consult</p>
          <p className="mt-2 text-[11px] tracking-[0.3em] uppercase !text-slate-500">Analyzing your selection</p>
          <style>{`@keyframes a2scan{0%{transform:translateX(0)}100%{transform:translateX(300%)}}`}</style>
        </div>
      )}
    </div>
  );
}

function Chapter({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h2 className="!text-slate-900 text-2xl md:text-4xl font-light tracking-tight uppercase">{title}</h2>
      {sub && <p className="mt-3 !text-slate-500 font-light max-w-2xl">{sub}</p>}
      <div className="mt-10 md:mt-12">{children}</div>
    </section>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.28em] uppercase !text-slate-500 mb-4">{label}</p>
      {children}
    </div>
  );
}

function Labeled({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] tracking-[0.24em] uppercase !text-slate-500">{label}</label>
      {children}
      {error && <p className="text-[12px] !text-red-500 font-light">{error}</p>}
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
