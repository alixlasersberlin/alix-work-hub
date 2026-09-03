/**
 * ALIX AI – Client-Anbindung (Prompt 5).
 * Alle Modellaufrufe laufen ausschliesslich serverseitig über die Edge Function
 * `analyze-conversation`. Es gibt keine AI-Keys im Frontend und keinen
 * automatischen Kundenversand – die KI liefert nur Vorschläge.
 */
import { supabase } from '@/integrations/supabase/client';

export type AiAnalysisType =
  | 'CLASSIFICATION' | 'REPLY' | 'SUMMARY' | 'QUESTIONS'
  | 'TRANSLATE' | 'ASK' | 'TICKET_SUMMARY';

export type AiClassification = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  classification_type: string;
  category: string | null;
  priority: string | null;
  confidence: number | null;
  detected_customer_id: string | null;
  detected_device_id: string | null;
  detected_serial_number: string | null;
  detected_ticket_id: string | null;
  summary: string | null;
  reasoning_summary: string | null;
  suggested_action: string | null;
  model_name: string | null;
  prompt_version: string | null;
  status: string;
  created_at: string;
  metadata: any;
};

export const TONES = [
  'PROFESSIONELL', 'FREUNDLICH', 'KURZ', 'TECHNISCH', 'VERKAUFSORIENTIERT', 'DEESKALIEREND',
] as const;
export type AiTone = typeof TONES[number];

export type AiFlags = {
  ai_enabled: boolean;
  ai_classification_enabled: boolean;
  ai_reply_enabled: boolean;
  ai_summary_enabled: boolean;
  ai_device_detection_enabled: boolean;
  ai_ticket_detection_enabled: boolean;
  ai_translation_enabled: boolean;
  ai_sales_enabled: boolean;
  ai_technical_triage_enabled: boolean;
  ai_auto_routing_enabled: boolean;
  ai_auto_priority_enabled: boolean;
};

export const AI_FLAG_KEYS: (keyof AiFlags)[] = [
  'ai_enabled', 'ai_classification_enabled', 'ai_reply_enabled', 'ai_summary_enabled',
  'ai_device_detection_enabled', 'ai_ticket_detection_enabled', 'ai_translation_enabled',
  'ai_sales_enabled', 'ai_technical_triage_enabled', 'ai_auto_routing_enabled', 'ai_auto_priority_enabled',
];

export async function fetchAiFlags(): Promise<AiFlags> {
  const { data } = await (supabase as any).from('app_settings').select('key, value').in('key', AI_FLAG_KEYS);
  const map = new Map<string, string>((data || []).map((r: any) => [r.key, String(r.value)]));
  const out = {} as AiFlags;
  for (const k of AI_FLAG_KEYS) out[k] = (map.get(k) || '').toLowerCase() === 'true';
  return out;
}

export async function setAiFlag(key: keyof AiFlags | 'ai_min_confidence' | 'ai_analysis_debounce_seconds', value: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from('app_settings')
    .upsert({ key, value, updated_by: auth?.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

/** Letzte gespeicherte Klassifizierung (Cache – vermeidet unnötige AI-Requests). */
export async function fetchLatestClassification(conversationId: string): Promise<AiClassification | null> {
  const { data } = await (supabase as any)
    .from('ai_classifications')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('classification_type', 'CLASSIFICATION')
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  return (data as AiClassification) ?? null;
}

type RunOpts = {
  conversationId: string;
  type: AiAnalysisType;
  tone?: AiTone;
  language?: string | null;
  question?: string;
  force?: boolean;
};

export async function runAnalysis<T = any>(opts: RunOpts): Promise<{ ok: boolean; error?: string; code?: string; data?: T; classification?: AiClassification; cached?: boolean }> {
  const { data, error } = await supabase.functions.invoke('analyze-conversation', {
    body: {
      conversation_id: opts.conversationId,
      analysis_type: opts.type,
      tone: opts.tone,
      language: opts.language,
      question: opts.question,
      force: opts.force ?? false,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || 'ALIX AI derzeit nicht verfügbar.', code: data?.code };
  return { ok: true, data: (data.result ?? null) as T, classification: data.classification, cached: data.cached };
}

/** Mitarbeiter-Feedback zur Qualitätsauswertung (kein sofortiges Modelltraining). */
export async function saveAiFeedback(opts: {
  classificationId: string;
  feedbackType: 'ACCEPTED' | 'CORRECTED' | 'REJECTED' | 'HELPFUL' | 'NOT_HELPFUL';
  original?: unknown;
  corrected?: unknown;
  comment?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  await (supabase as any).from('ai_feedback').insert({
    classification_id: opts.classificationId,
    user_id: auth?.user?.id ?? null,
    feedback_type: opts.feedbackType,
    original_value: (opts.original ?? null) as any,
    corrected_value: (opts.corrected ?? null) as any,
    comment: opts.comment ?? null,
  });
  const status = opts.feedbackType === 'CORRECTED' ? 'CORRECTED'
    : opts.feedbackType === 'REJECTED' ? 'DISMISSED'
    : opts.feedbackType === 'ACCEPTED' ? 'ACCEPTED' : null;
  if (status) {
    await (supabase as any).from('ai_classifications').update({
      status, reviewed_at: new Date().toISOString(), reviewed_by_user_id: auth?.user?.id ?? null,
    }).eq('id', opts.classificationId);
  }
}

export function confidencePct(c: number | null | undefined): number | null {
  if (typeof c !== 'number' || !Number.isFinite(c)) return null;
  return Math.round((c > 1 ? c / 100 : c) * 100);
}
