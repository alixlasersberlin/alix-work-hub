// ALIX PRODUCT HUB – Englischer Katalog: Audit, Qualitätsstatus und Website-Readiness.
// Rein lesend/aufbereitend; verändert keine technischen Stammdaten.
import { supabase } from '@/integrations/supabase/client';
import type { PhProduct } from './config';
import type { PhTranslation } from './i18n';

const db = supabase as any;

export type PhQaStatus = 'pass' | 'warning' | 'blocked';
export interface PhQaIssue { code: string; level: 'info' | 'warning' | 'blocked'; field?: string; message: string }
export interface PhQaRow {
  product_id: string; locale: string; status: PhQaStatus; score: number;
  issues: PhQaIssue[]; checked_at: string;
}

export const PH_QA_LABEL: Record<PhQaStatus, { label: string; tone: string }> = {
  pass: { label: 'PASS', tone: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  warning: { label: 'WARNING', tone: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  blocked: { label: 'BLOCKED', tone: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export type PhReadiness = 'READY' | 'MAPPING MISSING' | 'TRANSLATION BLOCKED' | 'REVIEW REQUIRED';

export const PH_READINESS_TONE: Record<PhReadiness, string> = {
  'READY': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'MAPPING MISSING': 'bg-sky-500/15 text-sky-500 border-sky-500/30',
  'TRANSLATION BLOCKED': 'bg-destructive/15 text-destructive border-destructive/30',
  'REVIEW REQUIRED': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
};

/** Redaktionelle Pflichtfelder des deutschen Masters für die Vollständigkeitsquote. */
export const PH_AUDIT_FIELDS: { key: string; label: string }[] = [
  { key: 'short_description', label: 'Kurzbeschreibung' },
  { key: 'long_description', label: 'Langbeschreibung' },
  { key: 'highlights', label: 'Highlights' },
  { key: 'applications', label: 'Anwendungen' },
  { key: 'features', label: 'Merkmale' },
  { key: 'benefits', label: 'Vorteile' },
  { key: 'marketing_text', label: 'Marketingtext' },
  { key: 'treatments', label: 'Behandlungsarten' },
  { key: 'seo_title', label: 'SEO Title' },
  { key: 'seo_description', label: 'Meta Description' },
  { key: 'intended_use', label: 'Zweckbestimmung' },
];

const filled = (v: unknown) =>
  Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : !!v;

/** Deutsche Quelle = gepflegte DE-Übersetzung, sonst Masterfelder aus ph_products. */
export function phGermanSource(p: PhProduct, de?: Partial<PhTranslation>) {
  return {
    name: de?.name || p.name,
    short_description: de?.short_description || p.short_description,
    long_description: de?.long_description || p.long_description,
    highlights: de?.highlights?.length ? de.highlights : (Array.isArray(p.features) ? p.features : []),
    benefits: de?.benefits ?? [],
    applications: de?.applications?.length ? de.applications : (p.applications ?? []),
    treatments: de?.treatments ?? [],
    features: de?.features?.length ? de.features : (Array.isArray(p.features) ? p.features : []),
    marketing_text: de?.marketing_text ?? null,
    seo_title: de?.seo_title || p.seo_title,
    seo_description: de?.seo_description || p.seo_description,
    intended_use: de?.intended_use || p.intended_use,
    product_group_label: de?.product_group_label || p.product_group,
  } as Record<string, unknown>;
}

export interface PhAuditRow {
  product: PhProduct;
  hubId: string | null;
  hubIdValid: boolean;
  deStatus: string;
  missing: string[];
  completeness: number;
  en?: PhTranslation;
  enStatus: string;
  qa?: PhQaRow;
  comMapped: boolean;
  readiness: PhReadiness;
  technicalTextValues: string[];
}

export function phBuildAudit(
  products: PhProduct[],
  translations: PhTranslation[],
  qa: PhQaRow[],
  comMap: Set<string>,
  locale = 'en',
): PhAuditRow[] {
  const trByKey = new Map(translations.map(t => [`${t.product_id}:${t.locale}`, t]));
  const qaByKey = new Map(qa.map(q => [`${q.product_id}:${q.locale}`, q]));

  return products.map(p => {
    const de = trByKey.get(`${p.id}:de`);
    const en = trByKey.get(`${p.id}:${locale}`);
    const q = qaByKey.get(`${p.id}:${locale}`);
    const src = phGermanSource(p, de);
    const missing = PH_AUDIT_FIELDS.filter(f => !filled(src[f.key])).map(f => f.label);
    const completeness = Math.round(((PH_AUDIT_FIELDS.length - missing.length) / PH_AUDIT_FIELDS.length) * 100);

    const hubId = p.alix_product_id?.trim() || null;
    // Eine echte Hub-ID ist eine sprechende ALIX-Kennung, keine übernommene Fremd-UUID.
    const hubIdValid = !!hubId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hubId);

    const comMapped = comMap.has(p.id);
    const enStatus = en?.status ?? 'missing';

    // Sprachabhängige technische Textwerte
    const technicalTextValues: string[] = [];
    if (typeof p.intended_use === 'string' && /[a-zA-ZäöüÄÖÜß]{4,}/.test(p.intended_use)) technicalTextValues.push('Zweckbestimmung');
    if (typeof p.product_group === 'string' && /[a-zA-ZäöüÄÖÜß]{4,}/.test(p.product_group || '')) technicalTextValues.push('Kategoriebezeichnung');
    if (typeof p.cooling === 'string' && /[a-zA-ZäöüÄÖÜß]{4,}/.test(p.cooling || '')) technicalTextValues.push('Kühlung');

    let readiness: PhReadiness;
    if (q?.status === 'blocked') readiness = 'TRANSLATION BLOCKED';
    else if (!comMapped) readiness = 'MAPPING MISSING';
    else if (!en || !['approved', 'published'].includes(enStatus)) readiness = 'REVIEW REQUIRED';
    else readiness = 'READY';

    return {
      product: p, hubId, hubIdValid, deStatus: p.status, missing, completeness,
      en, enStatus, qa: q, comMapped, readiness, technicalTextValues,
    };
  });
}

export async function phLoadQa(locale = 'en'): Promise<PhQaRow[]> {
  const { data, error } = await db.from('ph_translation_qa').select('*').eq('locale', locale);
  if (error) throw error;
  return (data ?? []) as PhQaRow[];
}

/** Zielsite je Sprache: EN/ES/RU → alix-lasers.com, AR → alix-lasers.ae */
export const PH_LOCALE_SITE: Record<string, string> = { en: 'com', es: 'com', ru: 'com', ar: 'ae' };

export async function phLoadComMap(site = 'com'): Promise<Set<string>> {
  const { data } = await db.from('ph_lang_sync_map').select('product_id,site_code').eq('site_code', site);
  return new Set((data ?? []).map((r: any) => r.product_id));
}

export async function phLoadTranslationsAllFields(locales: string[]): Promise<PhTranslation[]> {
  const { data, error } = await db.from('ph_product_translations').select('*').in('locale', locales);
  if (error) throw error;
  return (data ?? []) as PhTranslation[];
}
