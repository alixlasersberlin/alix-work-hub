import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import Turnstile from '@/components/Turnstile';
import { supabase } from '@/integrations/supabase/client';
import logoAsset from '@/assets/alix-lasers-logo-gold-new.png.asset.json';

/**
 * ALIX PREMIUM MIETANFRAGE (/miete/premium).
 * Design, Abstände, Progress und Mobile-Verhalten identisch zu /beratung/premium.
 * Geräte & Mietpreise kommen ausschließlich aus dem Product Hub (Edge Function
 * `rental-devices`); gespeichert wird über die bestehende Lead-Logik.
 */

export interface RentalDevice {
  id: string;
  name: string;
  slug: string | null;
  model: string | null;
  technology: string | null;
  image_url: string | null;
  short_description: string | null;
  from_monthly: number;
  currency: string;
  terms: { term: number; monthly: number }[];
  deposit_percent: number;
  deposit_fixed: number | null;
  delivery_days: number | null;
  rent_note: string | null;
}

const STEP_LABELS = ['Gerät', 'Mietmodell', 'Unternehmen', 'Kontaktdaten', 'Anschrift', 'Angaben', 'Prüfung'];
const LAST_STEP = STEP_LABELS.length;

const fieldCls =
  'w-full h-12 rounded-xl border !border-slate-200 !bg-white px-4 text-[15px] !text-slate-900 placeholder:!text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] focus:outline-none focus:ring-2 focus:ring-sky-200/70 focus:border-sky-200 transition';

const TERMS = [12, 24, 36, 48, 60];
const START_OPTIONS = ['Schnellstmöglich', 'Innerhalb 2 Wochen', 'Innerhalb 4 Wochen', 'Innerhalb 2 Monaten', 'Später'];
const CUSTOMER_TYPES = ['Unternehmen / Studio', 'Einzelunternehmen', 'Freiberuflich / Selbstständig', 'Neugründung', 'Privatperson'];
const INDUSTRIES = ['Kosmetikstudio', 'Beauty Studio', 'Arztpraxis', 'Ästhetische Praxis', 'Klinik', 'Friseur / Beauty', 'Tattoo Studio', 'Neugründung', 'Sonstige'];
const EMPLOYEES = ['1', '2–5', '6–10', '11–25', 'über 25'];
const BUDGETS = ['bis 150 €', '150–250 €', '250–500 €', 'über 500 €'];
const POSITIONS = ['Geschäftsführer', 'Inhaber', 'Praxisinhaber', 'Angestellter', 'Sonstige'];
const SALUTATIONS = ['Frau', 'Herr', 'Divers', 'Keine Angabe'];
const TRADE_STATUS = ['Ja', 'Nein', 'in Beantragung'];

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

type State = {
  product_hub_id: string;
  term: number | null;
  term_custom: string;
  requested_start: string;
  requested_start_date: string;

  customer_type: string;
  company_name: string;
  legal_form: string;
  company_foundation_date: string;
  commercial_register: string;
  commercial_register_number: string;
  vat_id: string;
  tax_number: string;
  website: string;
  social_media: string;
  industry: string;

  salutation: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  position: string;
  email: string;
  mobile: string;
  phone: string;

  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;

  delivery_same: boolean;
  delivery_company: string;
  delivery_contact: string;
  delivery_street: string;
  delivery_house_number: string;
  delivery_postal_code: string;
  delivery_city: string;
  delivery_country: string;

  company_since: string;
  employees: string;
  studio_open: string;
  planned_opening_date: string;
  existing_devices: string;
  existing_devices_text: string;
  monthly_budget: string;
  location_available: string;
  trade_registration_status: string;
  rental_start_mode: string;
  startup_support: boolean;
  notes: string;

  consultation_wanted: boolean;
  consent_correct: boolean;
  consent_data: boolean;
  consent_contact: boolean;
};

const INITIAL: State = {
  product_hub_id: '', term: null, term_custom: '', requested_start: '', requested_start_date: '',
  customer_type: '', company_name: '', legal_form: '', company_foundation_date: '', commercial_register: '',
  commercial_register_number: '', vat_id: '', tax_number: '', website: '', social_media: '', industry: '',
  salutation: '', first_name: '', last_name: '', birth_date: '', position: '', email: '', mobile: '', phone: '',
  street: '', house_number: '', postal_code: '', city: '', country: 'Deutschland',
  delivery_same: true, delivery_company: '', delivery_contact: '', delivery_street: '', delivery_house_number: '',
  delivery_postal_code: '', delivery_city: '', delivery_country: 'Deutschland',
  company_since: '', employees: '', studio_open: '', planned_opening_date: '', existing_devices: '',
  existing_devices_text: '', monthly_budget: '', location_available: '', trade_registration_status: '',
  rental_start_mode: '', startup_support: false, notes: '',
  consultation_wanted: false, consent_correct: false, consent_data: false, consent_contact: false,
};

const money = (v: number | null | undefined, currency = 'EUR') =>
  v === null || v === undefined
    ? '—'
    : Number(v).toLocaleString('de-DE', { style: 'currency', currency, maximumFractionDigits: 0 });

export default function PremiumRentalWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<State>(INITIAL);
  const [devices, setDevices] = useState<RentalDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const preselected = useRef(false);

  const set = <K extends keyof State>(k: K, v: State[K]) => setData((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    let alive = true;
    supabase.functions
      .invoke('rental-devices', { body: {} })
      .then(({ data: json, error: e }) => {
        if (!alive) return;
        if (e) { setLoadError('Die Mietgeräte konnten nicht geladen werden.'); return; }
        setDevices((json?.devices || []) as RentalDevice[]);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  /** Vorauswahl über ?product_id= / ?product= (Preise werden nie aus der URL übernommen). */
  useEffect(() => {
    if (preselected.current || !devices.length) return;
    const byId = params.get('product_id');
    const bySlug = params.get('product');
    const hit =
      (byId && devices.find((d) => d.id === byId)) ||
      (bySlug && devices.find((d) => d.slug === bySlug || d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === bySlug.toLowerCase()));
    if (hit) {
      preselected.current = true;
      setData((d) => ({ ...d, product_hub_id: hit.id }));
      setStep(2);
    }
  }, [devices, params]);

  const device = useMemo(() => devices.find((d) => d.id === data.product_hub_id) || null, [devices, data.product_hub_id]);

  const effectiveTerm = data.term === -1 ? Number(data.term_custom || 0) : data.term || 0;
  const monthly = useMemo(() => {
    if (!device) return null;
    const exact = device.terms.find((t) => t.term === effectiveTerm);
    return exact ? exact.monthly : device.from_monthly;
  }, [device, effectiveTerm]);

  const isCompany = data.customer_type && data.customer_type !== 'Privatperson';
  const isStartup = data.customer_type === 'Neugründung';

  function canContinue(): boolean {
    switch (step) {
      case 1: return !!data.product_hub_id;
      case 2: return effectiveTerm >= 1 && effectiveTerm <= 120 && !!data.requested_start;
      case 3: return !!data.customer_type && (!isCompany || !!data.company_name.trim()) && !!data.industry;
      case 4:
        return (
          !!data.salutation && data.first_name.trim().length > 1 && data.last_name.trim().length > 1 &&
          EMAIL_RE.test(data.email.trim()) && data.mobile.replace(/\D/g, '').length >= 6 && !!data.birth_date
        );
      case 5:
        return (
          !!data.street.trim() && !!data.house_number.trim() && data.postal_code.trim().length >= 3 &&
          !!data.city.trim() && !!data.country.trim() &&
          (data.delivery_same ||
            (!!data.delivery_street.trim() && !!data.delivery_house_number.trim() &&
              !!data.delivery_postal_code.trim() && !!data.delivery_city.trim() && !!data.delivery_country.trim()))
        );
      case 6: return true;
      case LAST_STEP: return data.consent_correct && data.consent_data;
      default: return true;
    }
  }

  const goNext = () => {
    if (!canContinue()) { setAttempted((a) => ({ ...a, [step]: true })); return; }
    setStep((s) => Math.min(LAST_STEP, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  async function submit() {
    if (!device) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: json, error: fnError } = await supabase.functions.invoke('rental-request-submit', {
        body: {
          product_hub_id: device.id,
          requested_term_months: effectiveTerm,
          requested_start: data.requested_start,
          requested_start_date: data.requested_start_date,
          customer_type: data.customer_type,
          company_name: data.company_name,
          legal_form: data.legal_form,
          company_foundation_date: data.company_foundation_date,
          commercial_register: data.commercial_register,
          commercial_register_number: data.commercial_register_number,
          vat_id: data.vat_id,
          tax_number: data.tax_number,
          website: data.website,
          social_media: data.social_media,
          industry: data.industry,
          salutation: data.salutation,
          first_name: data.first_name,
          last_name: data.last_name,
          birth_date: data.birth_date,
          position: data.position,
          email: data.email,
          mobile: data.mobile,
          phone: data.phone,
          street: data.street,
          house_number: data.house_number,
          postal_code: data.postal_code,
          city: data.city,
          country: data.country,
          delivery_same: data.delivery_same,
          delivery_company: data.delivery_company,
          delivery_contact: data.delivery_contact,
          delivery_street: data.delivery_street,
          delivery_house_number: data.delivery_house_number,
          delivery_postal_code: data.delivery_postal_code,
          delivery_city: data.delivery_city,
          delivery_country: data.delivery_country,
          company_since: data.company_since,
          employees: data.employees,
          studio_open: data.studio_open,
          planned_opening_date: data.planned_opening_date,
          existing_devices: data.existing_devices,
          existing_devices_text: data.existing_devices_text,
          monthly_budget: data.monthly_budget,
          startup: isStartup,
          location_available: data.location_available,
          trade_registration_status: data.trade_registration_status,
          rental_start_mode: data.rental_start_mode,
          startup_support: data.startup_support,
          notes: [data.notes, data.consultation_wanted ? 'Kunde wünscht Beratung.' : ''].filter(Boolean).join('\n'),
          source_url: params.get('source_url') || '',
          campaign: params.get('campaign') || params.get('utm_campaign') || '',
          finder_result: params.get('finder_result') || '',
          consent_correct: true,
          consent_data: true,
          consent_contact: data.consent_contact,
          turnstile_token: captchaToken,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (json?.error) throw new Error(json.message || json.error);
      navigate('/miete/premium/erfolgreich', {
        state: {
          request_number: json.request_number,
          product_name: device.name,
          image_url: device.image_url,
          monthly: json.rental_price_snapshot,
          currency: device.currency,
          term: effectiveTerm,
        },
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Die Anfrage konnte nicht gesendet werden.');
    } finally {
      setSubmitting(false);
    }
  }

  const err = (cond: boolean, msg: string) => (attempted[step] && cond ? msg : null);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-gradient-to-b from-[#fdfdfc] via-[#f5f6f7] to-[#eceef1] !text-slate-900">
      <header className="px-4 sm:px-6 md:px-10 py-4 sm:py-5 md:py-6 flex items-center justify-between gap-3">
        <a href="https://www.alix-lasers.de" target="_blank" rel="noopener noreferrer" aria-label="ALIX Lasers Webseite">
          <img src={logoAsset.url} alt="ALIX Lasers" className="h-7 sm:h-8 md:h-9 w-auto transition-opacity hover:opacity-80" />
        </a>
        <span className="text-[10px] md:text-[11px] tracking-[0.3em] md:tracking-[0.35em] !text-slate-500 uppercase text-right whitespace-nowrap">
          Unverbindliche Mietanfrage
        </span>
      </header>

      {/* Progress */}
      <div className="px-4 sm:px-6 md:px-10">
        <div className="mx-auto max-w-4xl hidden sm:flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] md:text-[11px] tracking-[0.24em] uppercase">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? 'done' : n === step ? 'active' : 'todo';
            return (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn('tabular-nums', state === 'active' && 'text-sky-600 font-semibold', state === 'done' && '!text-slate-500', state === 'todo' && 'text-slate-300')}>
                  {state === 'done' ? <Check className="inline h-3 w-3" /> : `0${n}`}
                </span>
                <span className={cn(state === 'active' && 'text-slate-900', state === 'done' && '!text-slate-500', state === 'todo' && 'text-slate-300')}>{label}</span>
                {i < STEP_LABELS.length - 1 && <span className="text-slate-200 ml-2">—</span>}
              </span>
            );
          })}
        </div>
        <div className="mx-auto max-w-4xl sm:mt-3">
          <div className="flex items-center justify-between gap-3 text-[10px] md:text-[11px] tracking-[0.16em] sm:tracking-[0.2em] uppercase !text-slate-500 mb-1.5">
            <span className="truncate">Schritt {step} von {LAST_STEP} · {STEP_LABELS[step - 1]}</span>
            <span className="tabular-nums shrink-0">{Math.round((step / LAST_STEP) * 100)} %</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-[width] duration-500 ease-out"
              style={{ width: `${(step / LAST_STEP) * 100}%` }}
              role="progressbar" aria-valuemin={0} aria-valuemax={LAST_STEP} aria-valuenow={step} aria-label="Fortschritt"
            />
          </div>
        </div>
        <div className="mx-auto max-w-4xl mt-3 sm:mt-4 h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
      </div>

      <main className="px-4 sm:px-6 md:px-10 pt-6 sm:pt-8 md:pt-12 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <div key={`step-${step}`} className="mx-auto max-w-4xl animate-in fade-in slide-in-from-right-8 duration-500">

          {/* Mietkonditionen dauerhaft sichtbar */}
          {device && step > 1 && (
            <div className="mb-6 sm:mb-8 rounded-2xl border !border-slate-200 bg-white/85 p-4 sm:p-5 flex items-center gap-4">
              {device.image_url && (
                <img src={device.image_url} alt={device.name} className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-xl bg-white" loading="lazy" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] tracking-[0.28em] uppercase !text-slate-500">Ihr Mietgerät</p>
                <p className="truncate text-slate-900 font-light text-base sm:text-lg">{device.name}</p>
                <p className="text-[13px] !text-slate-500 font-light">
                  {device.delivery_days ? `Lieferzeit ca. ${device.delivery_days} Tage` : 'Lieferzeit auf Anfrage'}
                  {effectiveTerm ? ` · Laufzeit ${effectiveTerm} Monate` : ''}
                  {monthly ? ` · ${money(monthly, device.currency)} / Monat` : ''}
                </p>


              </div>
            </div>
          )}

          {/* 1 — Gerät */}
          {step === 1 && (
            <Chapter title="Welches Gerät möchten Sie mieten?" sub="Wählen Sie ein Gerät. Alle Angaben stammen direkt aus unserem Produktsystem.">
              {loading && <p className="!text-slate-500 font-light">Mietgeräte werden geladen …</p>}
              {loadError && <p className="!text-red-500 font-light">{loadError}</p>}
              {!loading && !loadError && devices.length === 0 && (
                <p className="!text-slate-500 font-light">Aktuell ist kein Gerät zur Miete verfügbar. Bitte kontaktieren Sie uns direkt.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {devices.map((d) => {
                  const active = data.product_hub_id === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => { set('product_hub_id', d.id); set('term', null); }}
                      className={cn(
                        'text-left rounded-2xl border p-4 sm:p-5 transition min-h-[140px] bg-white',
                        active ? '!border-emerald-400 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.6)]' : '!border-slate-200 hover:!border-slate-300',
                      )}
                    >
                      <div className="flex items-start gap-4">
                        {d.image_url && <img src={d.image_url} alt={d.name} className="h-20 w-20 object-contain shrink-0" loading="lazy" />}
                        <div className="min-w-0">
                          <p className="text-slate-900 font-light text-lg leading-tight">{d.name}</p>
                          {d.technology && <p className="text-[12px] !text-slate-500 uppercase tracking-[0.16em] mt-1">{d.technology}</p>}
                          <p className="mt-3 text-[12px] !text-slate-500">
                            {d.delivery_days ? `Lieferzeit: ${d.delivery_days} Tage` : 'Lieferzeit auf Anfrage'}
                          </p>

                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <label className="mt-6 flex items-start gap-3 text-sm font-light !text-slate-600">
                <input type="checkbox" className="mt-1 h-5 w-5 rounded" checked={data.consultation_wanted} onChange={(e) => set('consultation_wanted', e.target.checked)} />
                Noch unsicher? Beratung gewünscht.
              </label>
              {err(!data.product_hub_id, 'Bitte wählen Sie ein Gerät.') && (
                <p className="mt-3 text-[12px] !text-red-500">Bitte wählen Sie ein Gerät.</p>
              )}
            </Chapter>
          )}

          {/* 2 — Mietmodell */}
          {step === 2 && (
            <Chapter title="Wie lange möchten Sie das Gerät mieten?" sub="Unverbindliche Angabe – die endgültigen Konditionen erhalten Sie im individuellen Mietangebot.">
              <div className="space-y-8">
                <Group label="Gewünschte Mietdauer *">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {TERMS.map((t) => (
                      <Pill key={t} active={data.term === t} onClick={() => set('term', t)}>{t} Monate</Pill>
                    ))}
                    <Pill active={data.term === -1} onClick={() => set('term', -1)}>Andere Laufzeit</Pill>
                  </div>
                  {data.term === -1 && (
                    <input
                      type="number" min={1} max={120} inputMode="numeric"
                      placeholder="Laufzeit in Monaten"
                      className={cn(fieldCls, 'mt-3')}
                      value={data.term_custom}
                      onChange={(e) => set('term_custom', e.target.value)}
                    />
                  )}
                </Group>
                <Group label="Gewünschter Mietbeginn *">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {START_OPTIONS.map((o) => (
                      <Pill key={o} active={data.requested_start === o} onClick={() => set('requested_start', o)}>{o}</Pill>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Labeled label="Konkretes Wunschdatum (optional)">
                      <input type="date" className={fieldCls} value={data.requested_start_date} onChange={(e) => set('requested_start_date', e.target.value)} />
                    </Labeled>
                  </div>
                </Group>
                {attempted[2] && !canContinue() && <p className="text-[12px] !text-red-500">Bitte Laufzeit und Mietbeginn wählen.</p>}
              </div>
            </Chapter>
          )}

          {/* 3 — Unternehmen */}
          {step === 3 && (
            <Chapter title="Zu wem gehört die Mietanfrage?" sub="Diese Angaben brauchen wir für die Prüfung Ihrer Mietanfrage.">
              <div className="space-y-8">
                <Group label="Art des Kunden *">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CUSTOMER_TYPES.map((o) => (
                      <Pill key={o} active={data.customer_type === o} onClick={() => set('customer_type', o)}>{o}</Pill>
                    ))}
                  </div>
                </Group>

                {isCompany && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    <Labeled label="Firmenname *" error={err(!data.company_name.trim(), 'Bitte Firmenname angeben.')}>
                      <input className={fieldCls} maxLength={160} value={data.company_name} onChange={(e) => set('company_name', e.target.value)} />
                    </Labeled>
                    <Labeled label="Rechtsform">
                      <input className={fieldCls} maxLength={80} placeholder="z. B. GmbH, e.K." value={data.legal_form} onChange={(e) => set('legal_form', e.target.value)} />
                    </Labeled>
                    <Labeled label="Gründungsdatum">
                      <input type="date" className={fieldCls} value={data.company_foundation_date} onChange={(e) => set('company_foundation_date', e.target.value)} />
                    </Labeled>
                    <Labeled label="Handelsregister">
                      <input className={fieldCls} maxLength={120} placeholder="z. B. Amtsgericht Berlin" value={data.commercial_register} onChange={(e) => set('commercial_register', e.target.value)} />
                    </Labeled>
                    <Labeled label="Handelsregisternummer">
                      <input className={fieldCls} maxLength={60} value={data.commercial_register_number} onChange={(e) => set('commercial_register_number', e.target.value)} />
                    </Labeled>
                    <Labeled label="USt-IdNr.">
                      <input className={fieldCls} maxLength={40} value={data.vat_id} onChange={(e) => set('vat_id', e.target.value)} />
                    </Labeled>
                    <Labeled label="Steuernummer (optional)">
                      <input className={fieldCls} maxLength={40} value={data.tax_number} onChange={(e) => set('tax_number', e.target.value)} />
                    </Labeled>
                    <Labeled label="Website (optional)">
                      <input className={fieldCls} maxLength={200} placeholder="https://" value={data.website} onChange={(e) => set('website', e.target.value)} />
                    </Labeled>
                    <Labeled label="Instagram / Social Media (optional)">
                      <input className={fieldCls} maxLength={200} value={data.social_media} onChange={(e) => set('social_media', e.target.value)} />
                    </Labeled>
                  </div>
                )}

                <Group label="Branche *" error={err(!data.industry, 'Bitte Branche wählen.')}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INDUSTRIES.map((o) => (
                      <Pill key={o} active={data.industry === o} onClick={() => set('industry', o)}>{o}</Pill>
                    ))}
                  </div>
                </Group>
              </div>
            </Chapter>
          )}

          {/* 4 — Kontaktdaten */}
          {step === 4 && (
            <Chapter title="Ihre Kontaktdaten" sub="Damit wir Sie zu Ihrer Mietanfrage erreichen können.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <Labeled label="Anrede *" error={err(!data.salutation, 'Bitte Anrede wählen.')}>
                  <select className={fieldCls} value={data.salutation} onChange={(e) => set('salutation', e.target.value)}>
                    <option value="">Bitte wählen</option>
                    {SALUTATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Geburtsdatum *" error={err(!data.birth_date, 'Bitte Geburtsdatum angeben.')}>
                  <input type="date" className={fieldCls} value={data.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
                </Labeled>
                <Labeled label="Vorname *" error={err(data.first_name.trim().length < 2, 'Bitte Vorname angeben.')}>
                  <input className={fieldCls} maxLength={80} autoComplete="given-name" value={data.first_name} onChange={(e) => set('first_name', e.target.value)} />
                </Labeled>
                <Labeled label="Nachname *" error={err(data.last_name.trim().length < 2, 'Bitte Nachname angeben.')}>
                  <input className={fieldCls} maxLength={80} autoComplete="family-name" value={data.last_name} onChange={(e) => set('last_name', e.target.value)} />
                </Labeled>
                <Labeled label="E-Mail *" error={err(!EMAIL_RE.test(data.email.trim()), 'Bitte gültige E-Mail angeben.')}>
                  <input type="email" inputMode="email" autoComplete="email" className={fieldCls} maxLength={160} value={data.email} onChange={(e) => set('email', e.target.value)} />
                </Labeled>
                <Labeled label="Mobiltelefon *" error={err(data.mobile.replace(/\D/g, '').length < 6, 'Bitte Mobilnummer angeben.')}>
                  <input inputMode="tel" autoComplete="tel" className={fieldCls} maxLength={40} placeholder="+49 …" value={data.mobile} onChange={(e) => set('mobile', e.target.value)} />
                </Labeled>
                <Labeled label="Festnetz (optional)">
                  <input inputMode="tel" className={fieldCls} maxLength={40} value={data.phone} onChange={(e) => set('phone', e.target.value)} />
                </Labeled>
                {isCompany && (
                  <Labeled label="Position / Funktion">
                    <select className={fieldCls} value={data.position} onChange={(e) => set('position', e.target.value)}>
                      <option value="">Bitte wählen</option>
                      {POSITIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Labeled>
                )}
              </div>
            </Chapter>
          )}

          {/* 5 — Anschrift */}
          {step === 5 && (
            <Chapter title="Ihre Anschrift" sub="Rechnungs- und Lieferanschrift für das Mietgerät.">
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <Labeled label="Straße *" error={err(!data.street.trim(), 'Pflichtfeld')}>
                    <input className={fieldCls} maxLength={120} autoComplete="address-line1" value={data.street} onChange={(e) => set('street', e.target.value)} />
                  </Labeled>
                  <Labeled label="Hausnummer *" error={err(!data.house_number.trim(), 'Pflichtfeld')}>
                    <input className={fieldCls} maxLength={20} value={data.house_number} onChange={(e) => set('house_number', e.target.value)} />
                  </Labeled>
                  <Labeled label="PLZ *" error={err(data.postal_code.trim().length < 3, 'Pflichtfeld')}>
                    <input className={fieldCls} maxLength={12} inputMode="numeric" autoComplete="postal-code" value={data.postal_code} onChange={(e) => set('postal_code', e.target.value)} />
                  </Labeled>
                  <Labeled label="Ort *" error={err(!data.city.trim(), 'Pflichtfeld')}>
                    <input className={fieldCls} maxLength={80} autoComplete="address-level2" value={data.city} onChange={(e) => set('city', e.target.value)} />
                  </Labeled>
                  <Labeled label="Land *">
                    <input className={fieldCls} maxLength={60} value={data.country} onChange={(e) => set('country', e.target.value)} />
                  </Labeled>
                </div>

                <label className="flex items-start gap-3 text-sm font-light !text-slate-600">
                  <input type="checkbox" className="mt-1 h-5 w-5 rounded" checked={data.delivery_same} onChange={(e) => set('delivery_same', e.target.checked)} />
                  Lieferanschrift entspricht der Firmenanschrift.
                </label>

                {!data.delivery_same && (
                  <Group label="Lieferanschrift">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                      <Labeled label="Firma / Studio">
                        <input className={fieldCls} maxLength={160} value={data.delivery_company} onChange={(e) => set('delivery_company', e.target.value)} />
                      </Labeled>
                      <Labeled label="Ansprechpartner">
                        <input className={fieldCls} maxLength={120} value={data.delivery_contact} onChange={(e) => set('delivery_contact', e.target.value)} />
                      </Labeled>
                      <Labeled label="Straße *" error={err(!data.delivery_street.trim(), 'Pflichtfeld')}>
                        <input className={fieldCls} maxLength={120} value={data.delivery_street} onChange={(e) => set('delivery_street', e.target.value)} />
                      </Labeled>
                      <Labeled label="Hausnummer *" error={err(!data.delivery_house_number.trim(), 'Pflichtfeld')}>
                        <input className={fieldCls} maxLength={20} value={data.delivery_house_number} onChange={(e) => set('delivery_house_number', e.target.value)} />
                      </Labeled>
                      <Labeled label="PLZ *" error={err(!data.delivery_postal_code.trim(), 'Pflichtfeld')}>
                        <input className={fieldCls} maxLength={12} value={data.delivery_postal_code} onChange={(e) => set('delivery_postal_code', e.target.value)} />
                      </Labeled>
                      <Labeled label="Ort *" error={err(!data.delivery_city.trim(), 'Pflichtfeld')}>
                        <input className={fieldCls} maxLength={80} value={data.delivery_city} onChange={(e) => set('delivery_city', e.target.value)} />
                      </Labeled>
                      <Labeled label="Land *">
                        <input className={fieldCls} maxLength={60} value={data.delivery_country} onChange={(e) => set('delivery_country', e.target.value)} />
                      </Labeled>
                    </div>
                  </Group>
                )}
              </div>
            </Chapter>
          )}

          {/* 6 — Angaben */}
          {step === 6 && (
            <Chapter title="Angaben zu Ihrem Betrieb" sub="Kurze Einordnung für die Prüfung Ihrer Mietanfrage.">
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <Labeled label="Unternehmen besteht seit">
                    <input type="date" className={fieldCls} value={data.company_since} onChange={(e) => set('company_since', e.target.value)} />
                  </Labeled>
                  <Labeled label="Anzahl Mitarbeiter">
                    <select className={fieldCls} value={data.employees} onChange={(e) => set('employees', e.target.value)}>
                      <option value="">Bitte wählen</option>
                      {EMPLOYEES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Labeled>
                </div>

                <Group label="Studio bereits eröffnet?">
                  <div className="grid grid-cols-2 gap-3">
                    <Pill active={data.studio_open === 'Ja'} onClick={() => set('studio_open', 'Ja')}>Ja</Pill>
                    <Pill active={data.studio_open === 'Nein'} onClick={() => set('studio_open', 'Nein')}>Nein</Pill>
                  </div>
                  {data.studio_open === 'Nein' && (
                    <div className="mt-4">
                      <Labeled label="Geplante Eröffnung">
                        <input type="date" className={fieldCls} value={data.planned_opening_date} onChange={(e) => set('planned_opening_date', e.target.value)} />
                      </Labeled>
                    </div>
                  )}
                </Group>

                <Group label="Bestehende Beauty-/Lasergeräte?">
                  <div className="grid grid-cols-2 gap-3">
                    <Pill active={data.existing_devices === 'Ja'} onClick={() => set('existing_devices', 'Ja')}>Ja</Pill>
                    <Pill active={data.existing_devices === 'Nein'} onClick={() => set('existing_devices', 'Nein')}>Nein</Pill>
                  </div>
                  {data.existing_devices === 'Ja' && (
                    <textarea
                      className={cn(fieldCls, 'h-28 py-3 resize-none mt-4')}
                      maxLength={600} placeholder="Welche Geräte?"
                      value={data.existing_devices_text} onChange={(e) => set('existing_devices_text', e.target.value)}
                    />
                  )}
                </Group>

                <Group label="Monatliches gewünschtes Budget">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BUDGETS.map((o) => (
                      <Pill key={o} active={data.monthly_budget === o} onClick={() => set('monthly_budget', o)}>{o}</Pill>
                    ))}
                  </div>
                </Group>

                {isStartup && (
                  <Group label="Angaben zur Neugründung">
                    <div className="space-y-4">
                      <Labeled label="Standort bereits vorhanden?">
                        <div className="grid grid-cols-2 gap-3">
                          <Pill active={data.location_available === 'Ja'} onClick={() => set('location_available', 'Ja')}>Ja</Pill>
                          <Pill active={data.location_available === 'Nein'} onClick={() => set('location_available', 'Nein')}>Nein</Pill>
                        </div>
                      </Labeled>
                      <Labeled label="Gewerbeanmeldung vorhanden?">
                        <div className="grid grid-cols-3 gap-3">
                          {TRADE_STATUS.map((o) => (
                            <Pill key={o} active={data.trade_registration_status === o} onClick={() => set('trade_registration_status', o)}>{o}</Pill>
                          ))}
                        </div>
                      </Labeled>
                      <Labeled label="Mietstart">
                        <div className="grid grid-cols-2 gap-3">
                          <Pill active={data.rental_start_mode === 'sofort'} onClick={() => set('rental_start_mode', 'sofort')}>sofort</Pill>
                          <Pill active={data.rental_start_mode === 'nach Geschäftseröffnung'} onClick={() => set('rental_start_mode', 'nach Geschäftseröffnung')}>nach Geschäftseröffnung</Pill>
                        </div>
                      </Labeled>
                      <label className="flex items-start gap-3 text-sm font-light !text-slate-600">
                        <input type="checkbox" className="mt-1 h-5 w-5 rounded" checked={data.startup_support} onChange={(e) => set('startup_support', e.target.checked)} />
                        Ich wünsche zusätzlich Unterstützung bei der Studio-Gründung.
                      </label>
                    </div>
                  </Group>
                )}

                <Labeled label="Bemerkungen zur Anfrage (optional)">
                  <textarea className={cn(fieldCls, 'h-32 py-3 resize-none')} maxLength={2000} value={data.notes} onChange={(e) => set('notes', e.target.value)} />
                </Labeled>
              </div>
            </Chapter>
          )}

          {/* 7 — Prüfung */}
          {step === LAST_STEP && device && (
            <Chapter title="Bitte prüfen Sie Ihre Mietanfrage" sub="Unverbindliche Mietanfrage – noch kein Mietvertrag.">
              <div className="space-y-4">
                <SummaryCard title="Gerät" onEdit={() => setStep(1)}>
                  <div className="flex items-center gap-4">
                    {device.image_url && <img src={device.image_url} alt={device.name} className="h-16 w-16 object-contain" loading="lazy" />}
                    <div>
                      <p className="text-slate-900 font-light">{device.name}</p>
                      <p className="text-[11px] !text-slate-400">Product-Hub-ID {device.id}</p>
                    </div>
                  </div>
                </SummaryCard>

                <SummaryCard title="Mietmodell" onEdit={() => setStep(2)}>
                  <Row k="Gewünschte Laufzeit" v={`${effectiveTerm} Monate`} />

                  <Row k="Gewünschter Beginn" v={[data.requested_start, data.requested_start_date].filter(Boolean).join(' · ')} />
                </SummaryCard>

                <SummaryCard title="Kunde" onEdit={() => setStep(3)}>
                  <Row k="Art" v={data.customer_type} />
                  <Row k="Firma" v={data.company_name || '—'} />
                  <Row k="Rechtsform" v={data.legal_form || '—'} />
                  <Row k="Branche" v={data.industry} />
                  <Row k="Ansprechpartner" v={`${data.salutation} ${data.first_name} ${data.last_name}`.trim()} />
                  <Row k="E-Mail" v={data.email} />
                  <Row k="Telefon" v={[data.mobile, data.phone].filter(Boolean).join(' · ')} />
                </SummaryCard>

                <SummaryCard title="Anschrift" onEdit={() => setStep(5)}>
                  <Row k="Adresse" v={`${data.street} ${data.house_number}, ${data.postal_code} ${data.city}, ${data.country}`} />
                  {!data.delivery_same && (
                    <Row k="Lieferanschrift" v={`${data.delivery_street} ${data.delivery_house_number}, ${data.delivery_postal_code} ${data.delivery_city}, ${data.delivery_country}`} />
                  )}
                </SummaryCard>

                <SummaryCard title="Weitere Angaben" onEdit={() => setStep(6)}>
                  <Row k="Neugründung" v={isStartup ? 'Ja' : 'Nein'} />
                  <Row k="Studio eröffnet" v={data.studio_open || '—'} />
                  <Row k="Geplante Eröffnung" v={data.planned_opening_date || '—'} />
                  <Row k="Budget" v={data.monthly_budget || '—'} />
                  <Row k="Bemerkungen" v={data.notes || '—'} />
                </SummaryCard>

                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 text-sm font-light !text-slate-600">
                    <input type="checkbox" className="mt-1 h-5 w-5 rounded" checked={data.consent_correct} onChange={(e) => set('consent_correct', e.target.checked)} />
                    Ich bestätige, dass meine Angaben vollständig und korrekt sind.
                  </label>
                  <label className="flex items-start gap-3 text-sm font-light !text-slate-600">
                    <input type="checkbox" className="mt-1 h-5 w-5 rounded" checked={data.consent_data} onChange={(e) => set('consent_data', e.target.checked)} />
                    Ich habe die Datenschutzhinweise gelesen.
                  </label>
                  <label className="flex items-start gap-3 text-sm font-light !text-slate-600">
                    <input type="checkbox" className="mt-1 h-5 w-5 rounded" checked={data.consent_contact} onChange={(e) => set('consent_contact', e.target.checked)} />
                    Ich möchte telefonisch zu meiner Mietanfrage beraten werden.
                  </label>
                </div>

                <div className="pt-2">
                  <Turnstile onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} theme="light" />
                </div>

                {error && <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">{error}</div>}

                <p className="text-[12px] !text-slate-500 font-light">
                  Die Anfrage ist unverbindlich. Nach Prüfung erhalten Sie ein individuelles Mietangebot.
                </p>
              </div>
            </Chapter>
          )}
        </div>
      </main>

      {/* Sticky Navigation */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 md:px-10 py-3 sm:py-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+env(safe-area-inset-bottom))] flex items-center gap-2 sm:gap-3">
          <button
            type="button" onClick={goBack} disabled={submitting || step === 1}
            className="h-13 min-h-[52px] px-4 sm:px-6 rounded-full border border-slate-200 bg-white !text-slate-600 text-[11px] sm:text-[12px] tracking-[0.16em] sm:tracking-[0.2em] uppercase whitespace-nowrap hover:text-slate-900 transition disabled:opacity-40"
          >
            <ArrowLeft className="inline h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Zurück</span>
          </button>
          <div className="flex-1" />
          {step < LAST_STEP ? (
            <button
              type="button" onClick={goNext} aria-disabled={!canContinue()} disabled={submitting}
              className={cn(
                'h-13 min-h-[52px] flex-1 sm:flex-none px-6 sm:px-8 rounded-full text-white text-[11px] sm:text-[12px] tracking-[0.16em] sm:tracking-[0.2em] uppercase whitespace-nowrap transition',
                canContinue() ? 'bg-slate-900 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.8)] hover:bg-slate-800' : 'bg-slate-300',
              )}
            >
              Weiter <ArrowRight className="inline h-4 w-4 ml-2" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => (canContinue() ? submit() : setAttempted((a) => ({ ...a, [step]: true })))}
              aria-disabled={!canContinue()} disabled={submitting}
              className={cn(
                'h-13 min-h-[52px] flex-1 sm:flex-none px-6 sm:px-8 rounded-full text-white text-[11px] sm:text-[12px] tracking-[0.16em] sm:tracking-[0.2em] uppercase whitespace-nowrap transition',
                canContinue() ? 'bg-slate-900 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.8)] hover:bg-slate-800' : 'bg-slate-300',
              )}
            >
              {submitting ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> : <Send className="inline h-4 w-4 mr-2" />}
              Mietanfrage senden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Chapter({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h1 className="!text-slate-900 text-lg sm:text-xl md:text-2xl font-light tracking-tight uppercase text-balance">{title}</h1>
      {sub && <p className="mt-1.5 sm:mt-2 !text-slate-500 font-light max-w-2xl text-[13px] sm:text-sm text-pretty">{sub}</p>}
      <div className="mt-4 sm:mt-6 md:mt-8">{children}</div>
    </section>
  );
}

function Group({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] sm:text-[11px] tracking-[0.22em] sm:tracking-[0.28em] uppercase !text-slate-500 mb-3 sm:mb-4">{label}</p>
      {children}
      {error && <p role="alert" className="mt-2 text-[12px] !text-red-500 font-light">{error}</p>}
    </div>
  );
}

function Labeled({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase !text-slate-500">{label}</label>
      {children}
      {error && <p role="alert" className="text-[12px] !text-red-500 font-light">{error}</p>}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-pressed={active} onClick={onClick}
      className={cn(
        'relative min-h-[56px] w-full rounded-2xl border pl-12 pr-5 text-left text-sm font-light transition',
        active
          ? '!border-emerald-400 !bg-white !text-slate-900 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.6)]'
          : '!border-slate-200 !bg-white/80 !text-slate-700 hover:!border-slate-300',
      )}
    >
      {active && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      {children}
    </button>
  );
}

function SummaryCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border !border-slate-200 bg-white/85 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] tracking-[0.28em] uppercase !text-slate-500">{title}</p>
        <button type="button" onClick={onEdit} className="text-[11px] uppercase tracking-[0.2em] !text-sky-600 hover:!text-sky-700">Ändern</button>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-wrap gap-x-3 text-[13px] font-light">
      <span className="!text-slate-500 min-w-[140px]">{k}</span>
      <span className="!text-slate-900 break-words">{v || '—'}</span>
    </div>
  );
}
