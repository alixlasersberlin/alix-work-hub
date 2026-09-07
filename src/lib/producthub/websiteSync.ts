// Product Hub → Website-Sprachen synchronisieren (Client-Anbindung).
// Der Hub bleibt Master: es wird ausschliesslich vom Hub zur Website geschrieben.
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export type PhSyncPlanRow = {
  field: string;
  remote_field: string;
  site: string | null;
  hub: string | null;
  action: 'change' | 'unchanged' | 'blocked';
  message?: string;
};

export type PhSyncSummary = {
  source: string; product: string; hub_id: string; locale: string; site: string;
  target_url: string; remote_product_id: string | null; target_found: boolean;
  locale_container: string | null; translation_status: string;
  fields_checked: number; fields_changed: number; fields_unchanged: number; fields_blocked: number;
  fallback_detected: boolean; publish_allowed: boolean;
};

export type PhSyncResponse = {
  runId?: string;
  plan?: PhSyncPlanRow[];
  summary?: PhSyncSummary;
  warnings?: string[];
  errors?: string[];
  endpointProbe?: any;
  error?: string;
  published?: number;
  restored?: { field: string; ok: boolean }[];
  conflicts?: { id: string; created_at: string }[];
};

export const PH_SYNC_FIELD_LABEL: Record<string, string> = {
  name: 'Produktname',
  short_description: 'Kurzbeschreibung',
  long_description: 'Langbeschreibung',
  marketing_text: 'Marketingtext',
  seo_title: 'SEO Title',
  seo_description: 'Meta Description',
  highlights: 'Highlights',
  benefits: 'Vorteile',
  applications: 'Einsatzgebiete',
  treatments: 'Behandlungsarten',
  features: 'Merkmale',
};

async function call(payload: Record<string, unknown>): Promise<PhSyncResponse> {
  const { data, error } = await supabase.functions.invoke('product-hub-lang-sync', { body: payload });
  if (error) {
    const ctx: any = (error as any).context;
    try {
      const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (body) return body as PhSyncResponse;
    } catch { /* ignore */ }
    throw error;
  }
  return data as PhSyncResponse;
}

export const phSyncTargets = (productId?: string) => call({ action: 'targets', productId });
export const phSyncPreview = (productId: string, locale: string) => call({ action: 'preview', productId, locale });
export const phSyncDryRun = (productId: string, locale: string) => call({ action: 'dryrun', productId, locale });
export const phSyncPublish = (productId: string, locale: string) => call({ action: 'publish', productId, locale });
export const phSyncRollback = (productId: string, locale: string, runId: string, force = false) =>
  call({ action: 'rollback', productId, locale, runId, force });

export async function phSyncRuns(productId?: string, limit = 100) {
  let q = db.from('ph_lang_sync_runs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (productId) q = q.eq('product_id', productId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as any[];
}

export async function phSyncRunFields(runId: string) {
  const { data, error } = await db.from('ph_lang_sync_fields').select('*').eq('run_id', runId).order('field');
  if (error) throw error;
  return (data || []) as any[];
}

/** Letzter produktiver Sync je Sprache für ein Gerät (für die Statusanzeige). */
export async function phLastSyncByLocale(productId: string) {
  const { data } = await db.from('ph_lang_sync_runs')
    .select('locale, created_at, result, mode')
    .eq('product_id', productId).eq('mode', 'publish').eq('result', 'ok')
    .order('created_at', { ascending: false });
  const out: Record<string, string> = {};
  (data || []).forEach((r: any) => { if (!out[r.locale]) out[r.locale] = r.created_at; });
  return out;
}
