// ALIX PRODUCT HUB – Mehrsprachigkeit (Master = Deutsch)
// Technische Stammdaten bleiben sprachneutral; hier ausschließlich redaktionelle Inhalte.
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const PH_LOCALES = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', rtl: false, master: true },
  { code: 'en', label: 'English', flag: '🇬🇧', rtl: false, master: false },
  { code: 'es', label: 'Español', flag: '🇪🇸', rtl: false, master: false },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', rtl: false, master: false },
  { code: 'ar', label: 'العربية', flag: '🇦🇪', rtl: true, master: false },
] as const;

export type PhLocale = typeof PH_LOCALES[number]['code'];
export const PH_TARGET_LOCALES: PhLocale[] = ['en', 'es', 'ru', 'ar'];
export const phIsRtl = (l: string) => l === 'ar';

export type PhTrStatus = 'missing' | 'ai_draft' | 'review' | 'approved' | 'published' | 'outdated';

export const PH_TR_STATUS: Record<PhTrStatus, { label: string; tone: string; icon: string }> = {
  missing: { label: 'Nicht vorhanden', tone: 'bg-muted text-muted-foreground', icon: '—' },
  ai_draft: { label: 'KI-Entwurf', tone: 'bg-sky-500/15 text-sky-500', icon: '✨' },
  review: { label: 'Prüfung erforderlich', tone: 'bg-amber-500/15 text-amber-500', icon: '⚠' },
  approved: { label: 'Freigegeben', tone: 'bg-emerald-500/15 text-emerald-500', icon: '✓' },
  published: { label: 'Veröffentlicht', tone: 'bg-emerald-600/20 text-emerald-400', icon: '✓' },
  outdated: { label: 'Übersetzung möglicherweise veraltet', tone: 'bg-destructive/15 text-destructive', icon: '⚠' },
};

/** Redaktionelle, übersetzbare Felder – alles andere bleibt sprachneutral. */
export const PH_TR_TEXT_FIELDS: { key: string; label: string; area?: boolean; rows?: number }[] = [
  { key: 'name', label: 'Produktname (sprachabhängig)' },
  { key: 'short_description', label: 'Kurzbeschreibung', area: true, rows: 3 },
  { key: 'long_description', label: 'Ausführliche Beschreibung', area: true, rows: 8 },
  { key: 'marketing_text', label: 'Marketingtext', area: true, rows: 5 },
  { key: 'notices', label: 'Hinweise / Sicherheitstexte', area: true, rows: 4 },
  { key: 'intended_use', label: 'Zweckbestimmung (sprachabhängiger technischer Textwert)', area: true, rows: 3 },
  { key: 'product_group_label', label: 'Kategoriebezeichnung (sprachabhängig)' },
];

export const PH_TR_LIST_FIELDS: { key: string; label: string }[] = [
  { key: 'highlights', label: 'Highlights' },
  { key: 'benefits', label: 'Vorteile' },
  { key: 'applications', label: 'Einsatzgebiete' },
  { key: 'treatments', label: 'Behandlungen' },
  { key: 'features', label: 'Funktionsbeschreibungen' },
];

export const PH_TR_SEO_FIELDS: { key: string; label: string; area?: boolean }[] = [
  { key: 'seo_title', label: 'SEO Titel' },
  { key: 'seo_description', label: 'Meta Description', area: true },
  { key: 'slug', label: 'Slug (nur Anzeige-URL, nie Produktschlüssel)' },
];

export interface PhTranslation {
  id?: string;
  product_id: string;
  locale: PhLocale;
  name?: string | null;
  short_description?: string | null;
  long_description?: string | null;
  marketing_text?: string | null;
  notices?: string | null;
  highlights?: string[];
  benefits?: string[];
  applications?: string[];
  treatments?: string[];
  features?: string[];
  faq?: { q: string; a: string }[];
  alt_texts?: Record<string, string>;
  seo_title?: string | null;
  seo_description?: string | null;
  slug?: string | null;
  status: PhTrStatus;
  translated_at?: string | null;
  translation_source?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export async function phLoadTranslations(productId: string): Promise<PhTranslation[]> {
  const { data, error } = await db.from('ph_product_translations').select('*').eq('product_id', productId);
  if (error) throw error;
  return (data ?? []) as PhTranslation[];
}

export async function phLoadAllTranslations(): Promise<PhTranslation[]> {
  const { data, error } = await db.from('ph_product_translations')
    .select('product_id,locale,status,updated_at');
  if (error) throw error;
  return (data ?? []) as PhTranslation[];
}

export async function phSaveTranslation(row: Partial<PhTranslation> & { product_id: string; locale: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await db.from('ph_product_translations')
    .upsert({ ...row, updated_by: user?.id ?? null }, { onConflict: 'product_id,locale' });
  if (error) throw error;
}

export async function phApproveTranslation(productId: string, locale: string, status: 'approved' | 'published' | 'review') {
  const { data: { user } } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { status, updated_by: user?.id ?? null };
  if (status === 'approved' || status === 'published') {
    patch.approved_by = user?.id ?? null;
    patch.approved_at = new Date().toISOString();
  }
  const { error } = await db.from('ph_product_translations')
    .update(patch).eq('product_id', productId).eq('locale', locale);
  if (error) throw error;
}

/** KI-Übersetzung anstoßen (Deutsch → Zielsprachen). */
export async function phTranslate(opts: {
  productIds: string[]; locales: string[]; overwrite?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke('ph-translate', { body: opts });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.results ?? []) as any[];
}

// ---- Glossar ----
export interface PhGlossaryTerm {
  id?: string;
  term: string;
  mode: 'protected' | 'fixed';
  translations: Record<string, string>;
  note?: string | null;
  active: boolean;
}

export async function phLoadGlossary(): Promise<PhGlossaryTerm[]> {
  const { data, error } = await db.from('ph_glossary').select('*').order('term');
  if (error) throw error;
  return (data ?? []) as PhGlossaryTerm[];
}

export async function phSaveGlossaryTerm(row: Partial<PhGlossaryTerm>) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await db.from('ph_glossary')
    .upsert({ ...row, updated_by: user?.id ?? null }, { onConflict: 'term' });
  if (error) throw error;
}

export async function phDeleteGlossaryTerm(id: string) {
  const { error } = await db.from('ph_glossary').delete().eq('id', id);
  if (error) throw error;
}
