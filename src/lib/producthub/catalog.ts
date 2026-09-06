// ALIXWORK PRODUCT HUB · Preislisten & Kataloge
// Additiv: nutzt ausschließlich vorhandene Product-Hub-Produkte als Datenquelle.

import { supabase } from '@/integrations/supabase/client';
import {
  PH_PRICE_COUNTRIES, formatMoney, readCountryPrice, effectivePriceForPower,
  uvpForPower, rentMonthly, depositAmount, convertAmount, readPowerTier, type PhCountryDef,
} from './countryPricing';
import { PH_DEFAULT_POWERS } from './deviceConfig';

const db = supabase as any;

export const PH_CATALOG_BUCKET = 'ph-catalog-media';

export const PH_CATALOG_STATUS = [
  { key: 'draft', label: 'Entwurf' },
  { key: 'review', label: 'Freigabe' },
  { key: 'published', label: 'Veröffentlicht' },
  { key: 'archived', label: 'Archiviert' },
] as const;

export const PH_CATALOG_VARIANTS = [
  { key: 'endkunde', label: 'Endkunden-Preisliste' },
  { key: 'haendler', label: 'Händlerpreisliste' },
  { key: 'distributor', label: 'Distributor' },
  { key: 'miete', label: 'Mietpreisliste' },
  { key: 'messe', label: 'Messekatalog' },
  { key: 'medical', label: 'ALIX Medical' },
] as const;

export type PhPriceKind =
  | 'uvp' | 'vk' | 'promo' | 'fair' | 'dealer' | 'distributor' | 'purchase'
  | 'rent' | 'leasing' | 'installment' | 'special' | 'custom' | 'deposit'
  | `power_${string}`;

/** Preisarten für die Staffelung nach „Leistung Lasermodul“ */
export const PH_POWER_PRICE_KINDS: { key: PhPriceKind; label: string; power: string; auto: true }[] =
  PH_DEFAULT_POWERS.map(pw => ({
    key: `power_${pw.replace(/\s+/g, '')}` as PhPriceKind,
    label: `Preis ${pw}`,
    power: pw,
    auto: true as const,
  }));

export const powerOfPriceKind = (kind: string): string | null =>
  PH_POWER_PRICE_KINDS.find(k => k.key === kind)?.power || null;

export const PH_PRICE_KINDS: { key: PhPriceKind; label: string; auto?: boolean }[] = [
  { key: 'uvp', label: 'UVP', auto: true },
  { key: 'vk', label: 'Verkaufspreis', auto: true },
  { key: 'promo', label: 'Aktionspreis' },
  { key: 'fair', label: 'Messepreis' },
  { key: 'dealer', label: 'Händlerpreis' },
  { key: 'distributor', label: 'Distributorpreis' },
  { key: 'purchase', label: 'Einkaufspreis' },
  { key: 'rent', label: 'Miete monatlich', auto: true },
  { key: 'leasing', label: 'Leasingrate' },
  { key: 'installment', label: 'Ratenkauf' },
  { key: 'deposit', label: 'Kaution', auto: true },
  { key: 'special', label: 'Sonderpreis' },
  { key: 'custom', label: 'Katalogpreis' },
  ...PH_POWER_PRICE_KINDS.map(k => ({ key: k.key, label: k.label, auto: true })),
];

export const PH_PRICE_DISPLAY = [
  { key: 'show', label: 'Preis anzeigen' },
  { key: 'strike', label: 'durchgestrichen' },
  { key: 'from', label: '„ab“ verwenden' },
  { key: 'request', label: 'auf Anfrage' },
  { key: 'hidden', label: 'Preis verstecken' },
] as const;

export const PH_LAYOUTS = [
  { key: 'layout1', label: 'Bild links · Text & Preis rechts' },
  { key: 'layout2', label: 'Bild oben · Technik unten' },
  { key: 'layout3', label: 'Luxury · großes Bild, großer Preis' },
  { key: 'layout4', label: 'Technical · Datentabelle' },
  { key: 'layout5', label: 'Preislisten-Kachel' },
];

export const PH_PAGE_TYPES = [
  { key: 'cover', label: 'Cover' },
  { key: 'toc', label: 'Inhaltsverzeichnis' },
  { key: 'category', label: 'Kategorie-Seite' },
  { key: 'products', label: 'Produktseiten' },
  { key: 'overview', label: 'Produktübersicht' },
  { key: 'pricelist', label: 'Preislistenansicht' },
  { key: 'content', label: 'Freie Inhaltsseite' },
  { key: 'back', label: 'Rückseite' },
];

export const PH_BADGES = [
  'NEU', 'TOP SELLER', 'AKTION', 'MESSEPREIS', 'MADE IN GERMANY', 'SMART KI', 'MDR CE', 'LIMITIERT',
];

export const PH_PRODUCT_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Produktname' },
  { key: 'image', label: 'Produktbild' },
  { key: 'short_description', label: 'Kurzbeschreibung' },
  { key: 'features', label: 'Highlights' },
  { key: 'wavelengths', label: 'Wellenlängen' },
  { key: 'power', label: 'Leistung' },
  { key: 'cooling', label: 'Kühlung' },
  { key: 'spot_sizes', label: 'Spotgrößen' },
  { key: 'laser_class', label: 'Laserklasse' },
  { key: 'model', label: 'Modell' },
  { key: 'warranty', label: 'Garantie' },
  { key: 'delivery_time', label: 'Lieferzeit' },
  { key: 'qr', label: 'QR-Code' },
  { key: 'contact', label: 'Kontakt' },
];

export const PH_DEFAULT_LEGAL =
  'Alle Preise verstehen sich, soweit nicht anders angegeben, zzgl. gesetzlicher Mehrwertsteuer. ' +
  'Irrtümer, Preisänderungen und Zwischenverkauf vorbehalten.';

export interface PhCatalogSettings {
  priceKinds: PhPriceKind[];
  priceDisplay: Record<string, string>;
  vatMode: 'net' | 'gross';
  vatNote: string;
  showSavings: boolean;
  priceRule: { mode: 'hub' | 'discount' | 'surcharge' | 'fixed'; base: 'uvp' | 'vk_min' | 'vk_max'; value: number | null };
  fields: Record<string, boolean>;
  layout: string;
  header: { enabled: boolean; logo: boolean; title: string; contact: string; website: string; qr: boolean };
  footer: { enabled: boolean; company: string; address: string; phone: string; email: string; website: string; pageNumbers: boolean };
  legal: string;
  theme: { bg: string; text: string; accent: string };
  pdf: { orientation: 'portrait' | 'landscape'; toc: boolean; cover: boolean; back: boolean; print: boolean };
}

export interface PhCatalogCover {
  image?: string | null;
  logo?: boolean;
  title?: string;
  subtitle?: string;
  claim?: string;
  promoNote?: string;
  validity?: string;
  bg?: string;
  color?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  imagePosition?: 'cover' | 'contain' | 'right' | 'left';
  overlay?: number;
  qr?: boolean;
  button?: string;
}

export function defaultSettings(partial?: Partial<PhCatalogSettings>): PhCatalogSettings {
  return {
    priceKinds: ['uvp', 'promo', 'rent'],
    priceDisplay: {},
    vatMode: 'net',
    vatNote: 'zzgl. MwSt.',
    showSavings: true,
    priceRule: { mode: 'hub', base: 'uvp', value: null },
    fields: Object.fromEntries(PH_PRODUCT_FIELDS.map(f => [f.key, true])),
    layout: 'layout1',
    header: { enabled: true, logo: true, title: '', contact: '', website: 'www.alix-lasers.com', qr: false },
    footer: {
      enabled: true, company: 'Alix Lasers GmbH', address: '', phone: '', email: '',
      website: 'www.alix-lasers.com', pageNumbers: true,
    },
    legal: PH_DEFAULT_LEGAL,
    theme: { bg: '#0b0b0d', text: '#f5f5f5', accent: '#c9a227' },
    pdf: { orientation: 'portrait', toc: true, cover: true, back: true, print: false },
    ...(partial || {}),
  };
}

export function defaultCover(partial?: Partial<PhCatalogCover>): PhCatalogCover {
  return {
    image: null, logo: true,
    title: 'ALIX LASERS', subtitle: 'PRODUCT CATALOG 2026 / 2027',
    claim: 'Leading AI. Shaping the Future of Beauty Technology.',
    promoNote: '', validity: '',
    bg: '#0b0b0d', color: '#ffffff', fontSize: 56, align: 'left',
    imagePosition: 'cover', overlay: 45, qr: false, button: '',
    ...(partial || {}),
  };
}

export const phCatalogSlug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function countryDef(code: string): PhCountryDef {
  return PH_PRICE_COUNTRIES.find(c => c.code === code) || PH_PRICE_COUNTRIES[0];
}

/** Automatisch aus dem Product Hub abgeleitete Preise – der Master bleibt unverändert. */
export function hubPrices(product: any, country: string, power?: string | null) {
  const def = countryDef(country);
  const p = readCountryPrice(product?.price_countries, def);
  const uvp = uvpForPower(p, power);
  const vk = effectivePriceForPower(p, 'min', power);
  const rentTerms = [12, 24, 36]
    .map(t => ({ term: t, amount: rentMonthly({ ...p, uvp } as any, t as any) }))
    .filter(r => r.amount > 0);
  return {
    def, raw: p, uvp, vk,
    rent: rentTerms.length ? Math.min(...rentTerms.map(r => r.amount)) : 0,
    rentTerms,
    deposit: depositAmount({ ...p, uvp } as any),
    inputMode: p.input_mode,
  };
}

/** Preis einer Leistungsstufe – 0, wenn für die Stufe nichts gepflegt ist. */
export function powerTierPrice(product: any, country: string, power: string, which: 'uvp' | 'vk' = 'vk') {
  const def = countryDef(country);
  const p = readCountryPrice(product?.price_countries, def);
  const tier = readPowerTier(p, power);
  if (!tier.enabled) return 0;
  return which === 'uvp' ? uvpForPower(p, power) : effectivePriceForPower(p, 'min', power);
}

/** Wendet die katalogweite Preisregel an (verändert nie den Masterpreis). */
export function applyPriceRule(base: number, rule: PhCatalogSettings['priceRule']): number {
  const v = Number(rule?.value || 0);
  if (!base && rule?.mode !== 'fixed') return base;
  switch (rule?.mode) {
    case 'discount': return base * (1 - Math.abs(v) / 100);
    case 'surcharge': return base * (1 + Math.abs(v) / 100);
    case 'fixed': return v || base;
    default: return base;
  }
}

export function catalogMoney(value: number, country: string, currency?: string, mode: 'net' | 'gross' = 'net', srcMode: 'net' | 'gross' = 'net') {
  const def = countryDef(country);
  const v = convertAmount(value, srcMode, mode, def.vat);
  return formatMoney(v, def, currency || def.currency);
}

/* ------------------------------ API ------------------------------ */

export async function catList() {
  const { data, error } = await db.from('ph_catalogs').select('*').order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function catGet(idOrSlug: string) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data, error } = await db.from('ph_catalogs').select('*')
    .eq(isUuid ? 'id' : 'slug', idOrSlug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function catCreate(row: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await db.from('ph_catalogs')
    .insert({ ...row, created_by: user?.id ?? null, updated_by: user?.id ?? null })
    .select('*').single();
  if (error) throw error;
  return data;
}

export async function catUpdate(id: string, patch: Record<string, any>) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await db.from('ph_catalogs')
    .update({ ...patch, updated_by: user?.id ?? null }).eq('id', id);
  if (error) throw error;
}

export async function catDelete(id: string) {
  const { error } = await db.from('ph_catalogs').delete().eq('id', id);
  if (error) throw error;
}

export async function catItems(catalogId: string) {
  const { data, error } = await db.from('ph_catalog_items')
    .select('*').eq('catalog_id', catalogId).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function catItemUpsert(row: Record<string, any>) {
  const { error } = await db.from('ph_catalog_items')
    .upsert(row, { onConflict: 'catalog_id,product_id' });
  if (error) throw error;
}

export async function catItemUpdate(id: string, patch: Record<string, any>) {
  const { error } = await db.from('ph_catalog_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function catItemRemove(catalogId: string, productId: string) {
  const { error } = await db.from('ph_catalog_items')
    .delete().eq('catalog_id', catalogId).eq('product_id', productId);
  if (error) throw error;
}

export async function catPages(catalogId: string) {
  const { data, error } = await db.from('ph_catalog_pages')
    .select('*').eq('catalog_id', catalogId).order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function catPageInsert(row: Record<string, any>) {
  const { data, error } = await db.from('ph_catalog_pages').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function catPageUpdate(id: string, patch: Record<string, any>) {
  const { error } = await db.from('ph_catalog_pages').update(patch).eq('id', id);
  if (error) throw error;
}

export async function catPageDelete(id: string) {
  const { error } = await db.from('ph_catalog_pages').delete().eq('id', id);
  if (error) throw error;
}

export async function catMedia(catalogId?: string) {
  let q = db.from('ph_catalog_media').select('*').order('created_at', { ascending: false });
  if (catalogId) q = q.or(`catalog_id.eq.${catalogId},catalog_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function catUploadImage(catalogId: string | null, file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${catalogId || 'library'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PH_CATALOG_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from(PH_CATALOG_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  const url = signed?.signedUrl || path;
  const { data, error: insErr } = await db.from('ph_catalog_media')
    .insert({ catalog_id: catalogId, url, title: file.name, kind: 'upload', created_by: user?.id ?? null })
    .select('*').single();
  if (insErr) throw insErr;
  return data;
}

export async function catVersions(catalogId: string) {
  const { data, error } = await db.from('ph_catalog_versions')
    .select('*').eq('catalog_id', catalogId).order('version', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function catSnapshot(catalog: any) {
  const { data: { user } } = await supabase.auth.getUser();
  const [items, pages] = await Promise.all([catItems(catalog.id), catPages(catalog.id)]);
  const version = Number(catalog.version || 1);
  await db.from('ph_catalog_versions').insert({
    catalog_id: catalog.id, version,
    version_label: catalog.version_label || `${(catalog.country || 'DE').toUpperCase()}-V${version}`,
    snapshot: { catalog, items, pages }, created_by: user?.id ?? null,
  });
}

export async function catTemplates() {
  const { data, error } = await db.from('ph_catalog_templates').select('*').order('is_system', { ascending: false }).order('name');
  if (error) throw error;
  return data || [];
}

export async function catDuplicate(catalog: any, name: string) {
  const [items, pages] = await Promise.all([catItems(catalog.id), catPages(catalog.id)]);
  const copy = await catCreate({
    name,
    internal_name: catalog.internal_name,
    variant: catalog.variant, language: catalog.language, currency: catalog.currency,
    country: catalog.country, valid_from: catalog.valid_from, valid_to: catalog.valid_to,
    contact: catalog.contact, notes: catalog.notes, status: 'draft',
    template_key: catalog.template_key, cover: catalog.cover, settings: catalog.settings,
    slug: `${phCatalogSlug(name)}-${Math.random().toString(36).slice(2, 6)}`,
    version: 1, version_label: null, pdf_stale: true,
  });
  if (items.length) {
    await db.from('ph_catalog_items').insert(items.map((i: any) => ({
      catalog_id: copy.id, product_id: i.product_id, sort_order: i.sort_order, layout: i.layout,
      prices: i.prices, fields: i.fields, image_mode: i.image_mode, image_url: i.image_url,
      badges: i.badges, visible: i.visible,
    })));
  }
  if (pages.length) {
    await db.from('ph_catalog_pages').insert(pages.map((p: any) => ({
      catalog_id: copy.id, sort_order: p.sort_order, page_type: p.page_type, title: p.title, config: p.config,
    })));
  }
  return copy;
}

/** Kataloge, in denen ein Product-Hub-Gerät verwendet wird. */
export async function catalogsForProduct(productId: string) {
  const { data, error } = await db.from('ph_catalog_items')
    .select('catalog_id, ph_catalogs(id, name, status, country, valid_to)')
    .eq('product_id', productId);
  if (error) return [];
  return (data || []).map((r: any) => r.ph_catalogs).filter(Boolean);
}
