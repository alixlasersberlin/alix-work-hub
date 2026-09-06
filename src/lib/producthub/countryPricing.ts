/** Länder-Preise für Product-Hub-Geräte (Brutto/Netto-Umschalter je Land). */

export type PhCountryCode = 'de' | 'at' | 'usa' | 'vietnam' | 'dubai';

export interface PhCountryDef {
  code: PhCountryCode;
  label: string;
  flag: string;
  currency: string;
  locale: string;
  vat: number;
}

export const PH_PRICE_COUNTRIES: PhCountryDef[] = [
  { code: 'de', label: 'Deutschland', flag: '🇩🇪', currency: 'EUR', locale: 'de-DE', vat: 19 },
  { code: 'at', label: 'Österreich', flag: '🇦🇹', currency: 'EUR', locale: 'de-AT', vat: 20 },
  { code: 'usa', label: 'USA', flag: '🇺🇸', currency: 'USD', locale: 'en-US', vat: 0 },
  { code: 'vietnam', label: 'Vietnam', flag: '🇻🇳', currency: 'VND', locale: 'vi-VN', vat: 10 },
  { code: 'dubai', label: 'Dubai', flag: '🇦🇪', currency: 'AED', locale: 'en-AE', vat: 5 },
];

export const PH_RENT_TERMS = [12, 24, 36] as const;
export type PhRentTerm = (typeof PH_RENT_TERMS)[number];

export interface PhRentTermConfig {
  enabled: boolean;
  /** Prozent der VK-Basis pro Monat oder fester Monatsbetrag */
  mode: 'percent' | 'fixed';
  value: number | null;
}

export interface PhCountryPrice {
  currency: string;
  vat_rate: number;
  /** Sind die eingetragenen Beträge Netto- oder Bruttowerte? */
  input_mode: 'net' | 'gross';
  public: boolean;
  uvp: number | null;
  vk_min_mode: 'fixed' | 'percent';
  vk_min_value: number | null;
  vk_max_mode: 'fixed' | 'percent';
  vk_max_value: number | null;
  promo_active: boolean;
  promo_name: string;
  /** Miete */
  rent_active: boolean;
  rent_public: boolean;
  /** Basis für die Mietberechnung */
  rent_base: 'vk_min' | 'vk_max' | 'uvp';
  rent_terms: Record<string, PhRentTermConfig>;
  rent_note: string;
  /** Kaution */
  deposit_active: boolean;
  deposit_mode: 'percent' | 'fixed';
  deposit_value: number | null;
  deposit_note: string;
}

export function emptyRentTerms(): Record<string, PhRentTermConfig> {
  const out: Record<string, PhRentTermConfig> = {};
  for (const t of PH_RENT_TERMS) out[String(t)] = { enabled: false, mode: 'percent', value: null };
  return out;
}

export function emptyCountryPrice(def: PhCountryDef): PhCountryPrice {
  return {
    currency: def.currency,
    vat_rate: def.vat,
    input_mode: 'net',
    public: false,
    uvp: null,
    vk_min_mode: 'fixed',
    vk_min_value: null,
    vk_max_mode: 'fixed',
    vk_max_value: null,
    promo_active: false,
    promo_name: '',
    rent_active: false,
    rent_public: false,
    rent_base: 'vk_min',
    rent_terms: emptyRentTerms(),
    rent_note: '',
  };
}


export function readCountryPrice(all: any, def: PhCountryDef): PhCountryPrice {
  const raw = (all && typeof all === 'object' ? all[def.code] : null) || {};
  const base = emptyCountryPrice(def);
  return {
    ...base,
    ...raw,
    currency: raw.currency || base.currency,
    vat_rate: raw.vat_rate ?? base.vat_rate,
    input_mode: raw.input_mode === 'gross' ? 'gross' : 'net',
    public: raw.public === true,
    promo_active: raw.promo_active === true,
    promo_name: raw.promo_name || '',
    vk_min_mode: raw.vk_min_mode === 'percent' ? 'percent' : 'fixed',
    vk_max_mode: raw.vk_max_mode === 'percent' ? 'percent' : 'fixed',
    rent_active: raw.rent_active === true,
    rent_public: raw.rent_public === true,
    rent_base: raw.rent_base === 'vk_max' || raw.rent_base === 'uvp' ? raw.rent_base : 'vk_min',
    rent_note: raw.rent_note || '',
    rent_terms: (() => {
      const out = emptyRentTerms();
      const src = raw.rent_terms && typeof raw.rent_terms === 'object' ? raw.rent_terms : {};
      for (const t of PH_RENT_TERMS) {
        const r = src[String(t)] || {};
        out[String(t)] = {
          enabled: r.enabled === true,
          mode: r.mode === 'fixed' ? 'fixed' : 'percent',
          value: r.value === null || r.value === undefined || r.value === '' ? null : Number(r.value),
        };
      }
      return out;
    })(),
  };
}

/** Basisbetrag für die Mietberechnung (Platzhalter-Logik, wird später ersetzt). */
export function rentBaseAmount(p: PhCountryPrice): number {
  if (p.rent_base === 'uvp') return Number(p.uvp || 0);
  return effectivePrice(p, p.rent_base === 'vk_max' ? 'max' : 'min');
}

/** Vorläufige Monatsrate je Laufzeit. */
export function rentMonthly(p: PhCountryPrice, term: PhRentTerm): number {
  const cfg = p.rent_terms?.[String(term)];
  if (!cfg || !cfg.enabled) return 0;
  const val = Number(cfg.value || 0);
  if (!val) return 0;
  return cfg.mode === 'fixed' ? val : (rentBaseAmount(p) * val) / 100;
}


/** Rechnet einen eingetragenen Betrag in die gewünschte Anzeigeart um. */
export function convertAmount(
  value: number,
  from: 'net' | 'gross',
  to: 'net' | 'gross',
  vatRate: number,
): number {
  if (from === to || !value) return value;
  const f = 1 + (vatRate || 0) / 100;
  return to === 'gross' ? value * f : value / f;
}

export function effectivePrice(p: PhCountryPrice, which: 'min' | 'max'): number {
  const uvp = Number(p.uvp || 0);
  const mode = which === 'min' ? p.vk_min_mode : p.vk_max_mode;
  const val = Number((which === 'min' ? p.vk_min_value : p.vk_max_value) || 0);
  if (mode !== 'percent') return val;
  // VK Minimal ist immer ein Abschlag vom UVP
  if (which === 'min') return uvp * (1 - Math.abs(val) / 100);
  return uvp * (1 + val / 100);
}

export function formatMoney(value: number, def: PhCountryDef, currency?: string): string {
  if (!value && value !== 0) return '—';
  try {
    return value.toLocaleString(def.locale, {
      style: 'currency',
      currency: currency || def.currency,
      maximumFractionDigits: (currency || def.currency) === 'VND' ? 0 : 2,
    });
  } catch {
    return `${value.toFixed(2)} ${currency || def.currency}`;
  }
}
