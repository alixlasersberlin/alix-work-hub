// Export / Import aller Product-Hub-Preise (CSV & PDF)

import {
  PH_PRICE_COUNTRIES, PH_RENT_TERMS, readCountryPrice, effectivePrice,
  rentMonthly, depositAmount, type PhCountryDef, type PhCountryPrice,
} from './countryPricing';

export interface PhPriceRow {
  [key: string]: string | number;
}

const num = (v: any) => (v === null || v === undefined || v === '' ? '' : Number(v));
const bool = (v: any) => (v === true ? 'ja' : 'nein');

export const PH_PRICE_COLUMNS = [
  'product_id', 'alix_product_id', 'name', 'model', 'sku',
  'land', 'land_code', 'waehrung', 'steuersatz', 'eingabe_modus', 'sichtbar_webseite',
  'uvp', 'vk_min_modus', 'vk_min_wert', 'vk_min_effektiv',
  'vk_max_modus', 'vk_max_wert', 'vk_max_effektiv',
  'aktion_aktiv', 'aktion_name',
  'miete_aktiv', 'miete_sichtbar', 'miete_basis',
  ...PH_RENT_TERMS.flatMap(t => [`miete_${t}m_aktiv`, `miete_${t}m_modus`, `miete_${t}m_wert`, `miete_${t}m_monat`]),
  'miete_hinweis',
  'kaution_aktiv', 'kaution_modus', 'kaution_wert', 'kaution_betrag', 'kaution_hinweis',
  'staffel_leistung_json',
];

export function priceRow(product: any, def: PhCountryDef): PhPriceRow {
  const p: PhCountryPrice = readCountryPrice(product.price_countries, def);
  const row: PhPriceRow = {
    product_id: product.id,
    alix_product_id: product.alix_product_id || '',
    name: product.name || '',
    model: product.model || '',
    sku: product.sku || '',
    land: def.label,
    land_code: def.code,
    waehrung: p.currency,
    steuersatz: num(p.vat_rate),
    eingabe_modus: p.input_mode,
    sichtbar_webseite: bool(p.public),
    uvp: num(p.uvp),
    vk_min_modus: p.vk_min_mode,
    vk_min_wert: num(p.vk_min_value),
    vk_min_effektiv: Math.round(effectivePrice(p, 'min') * 100) / 100,
    vk_max_modus: p.vk_max_mode,
    vk_max_wert: num(p.vk_max_value),
    vk_max_effektiv: Math.round(effectivePrice(p, 'max') * 100) / 100,
    aktion_aktiv: bool(p.promo_active),
    aktion_name: p.promo_name || '',
    miete_aktiv: bool(p.rent_active),
    miete_sichtbar: bool(p.rent_public),
    miete_basis: p.rent_base,
    miete_hinweis: p.rent_note || '',
    kaution_aktiv: bool(p.deposit_active),
    kaution_modus: p.deposit_mode,
    kaution_wert: num(p.deposit_value),
    kaution_betrag: Math.round(depositAmount(p) * 100) / 100,
    kaution_hinweis: p.deposit_note || '',
    staffel_leistung_json: JSON.stringify((p as any).power_tiers || {}),
  };
  for (const t of PH_RENT_TERMS) {
    const cfg = p.rent_terms?.[String(t)] || { enabled: false, mode: 'percent', value: null };
    row[`miete_${t}m_aktiv`] = bool(cfg.enabled);
    row[`miete_${t}m_modus`] = cfg.mode;
    row[`miete_${t}m_wert`] = num(cfg.value);
    row[`miete_${t}m_monat`] = Math.round(rentMonthly(p, t) * 100) / 100;
  }
  return row;
}

export function buildPriceRows(products: any[], countries = PH_PRICE_COUNTRIES): PhPriceRow[] {
  const out: PhPriceRow[] = [];
  for (const prod of products) for (const def of countries) out.push(priceRow(prod, def));
  return out;
}

/* ------------------------- CSV ------------------------- */

const esc = (v: any) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCsv(rows: PhPriceRow[]): string {
  const head = PH_PRICE_COLUMNS.join(';');
  const body = rows.map(r => PH_PRICE_COLUMNS.map(c => esc(r[c])).join(';'));
  return '\uFEFF' + [head, ...body].join('\n');
}

/** Einfacher CSV-Parser (Trennzeichen ; oder ,) mit Quote-Unterstützung. */
export function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const delim = (clean.split('\n')[0].match(/;/g) || []).length >= (clean.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let cur: string[] = [], field = '', q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { cur.push(field); field = ''; }
    else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else field += ch;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  const [head, ...body] = rows.filter(r => r.some(c => c.trim() !== ''));
  if (!head) return [];
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const toNum = (v: string) => {
  if (v === undefined || v === null || v.trim() === '') return null;
  const n = Number(v.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const toBool = (v: string) => ['ja', 'true', '1', 'yes', 'x'].includes((v || '').toLowerCase());

/** Baut aus einer CSV-Zeile das Preisobjekt für ein Land. */
export function csvRowToCountryPrice(row: Record<string, string>, def: PhCountryDef, existing: any): PhCountryPrice {
  const base = readCountryPrice(existing, def);
  const terms: Record<string, any> = { ...base.rent_terms };
  for (const t of PH_RENT_TERMS) {
    terms[String(t)] = {
      enabled: toBool(row[`miete_${t}m_aktiv`]),
      mode: row[`miete_${t}m_modus`] === 'fixed' ? 'fixed' : 'percent',
      value: toNum(row[`miete_${t}m_wert`]),
    };
  }
  let tiers = (base as any).power_tiers || {};
  if (row.staffel_leistung_json) {
    try { tiers = JSON.parse(row.staffel_leistung_json); } catch { /* Wert unverändert lassen */ }
  }
  return {
    ...base,
    currency: (row.waehrung || base.currency).toUpperCase(),
    vat_rate: toNum(row.steuersatz) ?? base.vat_rate,
    input_mode: row.eingabe_modus === 'gross' ? 'gross' : 'net',
    public: toBool(row.sichtbar_webseite),
    uvp: toNum(row.uvp),
    vk_min_mode: row.vk_min_modus === 'percent' ? 'percent' : 'fixed',
    vk_min_value: toNum(row.vk_min_wert),
    vk_max_mode: row.vk_max_modus === 'percent' ? 'percent' : 'fixed',
    vk_max_value: toNum(row.vk_max_wert),
    promo_active: toBool(row.aktion_aktiv),
    promo_name: row.aktion_name || '',
    rent_active: toBool(row.miete_aktiv),
    rent_public: toBool(row.miete_sichtbar),
    rent_base: (['vk_min', 'vk_max', 'uvp'].includes(row.miete_basis) ? row.miete_basis : base.rent_base) as any,
    rent_terms: terms,
    rent_note: row.miete_hinweis || '',
    deposit_active: toBool(row.kaution_aktiv),
    deposit_mode: row.kaution_modus === 'fixed' ? 'fixed' : 'percent',
    deposit_value: toNum(row.kaution_wert),
    deposit_note: row.kaution_hinweis || '',
    ...(Object.keys(tiers).length ? { power_tiers: tiers } : {}),
  } as PhCountryPrice;
}

export function downloadFile(content: BlobPart, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
