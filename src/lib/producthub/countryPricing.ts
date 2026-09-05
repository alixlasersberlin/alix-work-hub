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
  };
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
  return mode === 'percent' ? uvp * (1 + val / 100) : val;
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
