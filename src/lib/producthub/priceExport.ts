// Export / Import aller Product-Hub-Preise (CSV & PDF)

import {
  PH_PRICE_COUNTRIES, PH_RENT_TERMS, readCountryPrice, effectivePrice,
  rentMonthly, depositAmount, type PhCountryDef, type PhCountryPrice,
  uvpForPower, readPowerTier,
} from './countryPricing';
import { PH_DEFAULT_POWERS } from './deviceConfig';

export interface PhPriceRow {
  [key: string]: string | number;
}

const num = (v: any) => (v === null || v === undefined || v === '' ? '' : Number(v));
const bool = (v: any) => (v === true ? 'ja' : 'nein');

export const PH_POWER_COLUMNS = PH_DEFAULT_POWERS.map(p => ({ power: p as string, column: p.replace(/\s+/g, '') }));

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

/** Reduzierte Spalten fuer den Export: nur Geraetename, UVP, VK Min/Max und Leistungsstaffel.
 *  product_id/land_code bleiben als technische Zuordnung fuer den Re-Import erhalten. */
export const PH_EXPORT_COLUMNS = [
  'product_id', 'land_code', 'name',
  'uvp',
  'vk_min_modus', 'vk_min_wert', 'vk_min_effektiv',
  'vk_max_modus', 'vk_max_wert', 'vk_max_effektiv',
  ...PH_POWER_COLUMNS.map(c => c.column),
  'staffel_leistung', 'staffel_leistung_json',
];

/** Staffelspalten je Lasermodul-Leistung: Spaltenname = Leistung (z. B. "1600W"),
 *  Wert = UVP fuer diese Leistung. */

const TIER_LABEL: Record<string, string> = {
  surcharge_percent: 'Aufschlag %',
  surcharge_fixed: 'Aufschlag fix',
  price_fixed: 'eigener UVP',
};

/** Lesbare Darstellung der Leistungsstaffel. */
export function powerTiersText(p: PhCountryPrice): string {
  const tiers = ((p as any).power_tiers || {}) as Record<string, any>;
  return Object.entries(tiers)
    .filter(([, t]) => t && t.enabled && t.value !== null && t.value !== undefined && t.value !== '')
    .map(([power, t]) => `${power}: ${TIER_LABEL[t.mode] || t.mode} ${t.value}`)
    .join(' | ');
}

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
    staffel_leistung: powerTiersText(p),
  };
  for (const { power, column } of PH_POWER_COLUMNS) {
    // Nur exportieren, wenn für die Stufe wirklich ein Staffelpreis gepflegt ist
    const t = readPowerTier(p, power);
    row[column] = t.enabled ? Math.round(uvpForPower(p, power) * 100) / 100 : '';
  }
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

/** Jedes Feld wird gequotet, damit Excel niemals an Leerzeichen/Trennzeichen zerlegt.
 *  Zahlen werden mit deutschem Dezimalkomma ausgegeben. */
const esc = (v: any) => {
  if (v === null || v === undefined) return '""';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

export function rowsToCsv(rows: PhPriceRow[], columns: string[] = PH_EXPORT_COLUMNS): string {
  const head = columns.map(esc).join(';');
  const body = rows.map(r => columns.map(c => esc(r[c])).join(';'));
  // Kein "sep=;"-Prefix: Excel ignoriert sonst die UTF-8-Kennung (BOM) und zerstoert Umlaute.
  return '\uFEFF' + [head, ...body].join('\r\n') + '\r\n';
}

/** Einfacher CSV-Parser (Trennzeichen ; oder ,) mit Quote-Unterstützung. */
export function parseCsv(text: string): Record<string, string>[] {
  let clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (/^sep=.\s*$/i.test(clean.split('\n')[0] || '')) clean = clean.split('\n').slice(1).join('\n');
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

/** Baut aus einer CSV-Zeile das Preisobjekt für ein Land.
 *  Wichtig: Nur Spalten, die in der Datei tatsächlich vorhanden sind, werden übernommen.
 *  Alles andere (Miete, Kaution, Sonderaktion, Netto/Brutto, Webseiten-Freigabe) bleibt unverändert. */
export function csvRowToCountryPrice(row: Record<string, string>, def: PhCountryDef, existing: any): PhCountryPrice {
  const base = readCountryPrice(existing, def);
  const has = (k: string) => Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined;
  const out: any = { ...base };

  if (has('waehrung') && row.waehrung) out.currency = row.waehrung.toUpperCase();
  if (has('steuersatz')) out.vat_rate = toNum(row.steuersatz) ?? base.vat_rate;
  if (has('eingabe_modus') && row.eingabe_modus) out.input_mode = row.eingabe_modus === 'gross' ? 'gross' : 'net';
  if (has('sichtbar_webseite')) out.public = toBool(row.sichtbar_webseite);
  if (has('uvp')) out.uvp = toNum(row.uvp);
  if (has('vk_min_modus') && row.vk_min_modus) out.vk_min_mode = row.vk_min_modus === 'percent' ? 'percent' : 'fixed';
  if (has('vk_min_wert')) out.vk_min_value = toNum(row.vk_min_wert);
  if (has('vk_max_modus') && row.vk_max_modus) out.vk_max_mode = row.vk_max_modus === 'percent' ? 'percent' : 'fixed';
  if (has('vk_max_wert')) out.vk_max_value = toNum(row.vk_max_wert);
  if (has('aktion_aktiv')) out.promo_active = toBool(row.aktion_aktiv);
  if (has('aktion_name')) out.promo_name = row.aktion_name || '';
  if (has('miete_aktiv')) out.rent_active = toBool(row.miete_aktiv);
  if (has('miete_sichtbar')) out.rent_public = toBool(row.miete_sichtbar);
  if (has('miete_basis') && ['vk_min', 'vk_max', 'uvp'].includes(row.miete_basis)) out.rent_base = row.miete_basis;
  if (has('miete_hinweis')) out.rent_note = row.miete_hinweis || '';
  if (has('kaution_aktiv')) out.deposit_active = toBool(row.kaution_aktiv);
  if (has('kaution_modus') && row.kaution_modus) out.deposit_mode = row.kaution_modus === 'fixed' ? 'fixed' : 'percent';
  if (has('kaution_wert')) out.deposit_value = toNum(row.kaution_wert);
  if (has('kaution_hinweis')) out.deposit_note = row.kaution_hinweis || '';

  const terms: Record<string, any> = { ...(base.rent_terms || {}) };
  let termsTouched = false;
  for (const t of PH_RENT_TERMS) {
    const k = `miete_${t}m`;
    if (!has(`${k}_aktiv`) && !has(`${k}_modus`) && !has(`${k}_wert`)) continue;
    const cur = terms[String(t)] || { enabled: false, mode: 'percent', value: null };
    terms[String(t)] = {
      enabled: has(`${k}_aktiv`) ? toBool(row[`${k}_aktiv`]) : cur.enabled,
      mode: has(`${k}_modus`) && row[`${k}_modus`] ? (row[`${k}_modus`] === 'fixed' ? 'fixed' : 'percent') : cur.mode,
      value: has(`${k}_wert`) ? toNum(row[`${k}_wert`]) : cur.value,
    };
    termsTouched = true;
  }
  if (termsTouched) out.rent_terms = terms;

  if (has('staffel_leistung_json') && row.staffel_leistung_json) {
    try {
      const tiers = JSON.parse(row.staffel_leistung_json);
      if (tiers && typeof tiers === 'object') out.power_tiers = tiers;
    } catch { /* Wert unveraendert lassen */ }
  }

  for (const { power, column } of PH_POWER_COLUMNS) {
    if (!has(column)) continue;
    const n = toNum(row[column]);
    const tiers: Record<string, any> = { ...((out.power_tiers || {}) as Record<string, any>) };
    if (n === null) tiers[power] = { ...(tiers[power] || {}), enabled: false, mode: tiers[power]?.mode || 'price_fixed', value: tiers[power]?.value ?? null };
    else tiers[power] = { enabled: true, mode: 'price_fixed', value: n };
    out.power_tiers = tiers;
  }

  return out as PhCountryPrice;
}

export function downloadFile(content: BlobPart, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Liest eine Excel-Datei (.xlsx/.xls) und liefert Zeilen wie parseCsv. */
export async function parseXlsx(file: File | ArrayBuffer): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false });
  return raw.map(r => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) out[String(k).trim()] = v === null || v === undefined ? '' : String(v).trim();
    return out;
  }).filter(r => Object.values(r).some(v => v !== ''));
}

/** Liest CSV oder XLSX anhand der Dateiendung. */
export async function parseImportFile(file: File): Promise<Record<string, string>[]> {
  return /\.(xlsx|xlsm|xls)$/i.test(file.name) ? parseXlsx(file) : parseCsv(await file.text());
}
