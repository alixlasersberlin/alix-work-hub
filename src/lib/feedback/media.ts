import { supabase } from '@/integrations/supabase/client';

export const SURVEY_MEDIA_BUCKET = 'survey-media';

/** Lädt eine Datei in die Umfrage-Mediathek und gibt den Objektpfad zurück. */
export async function uploadSurveyMedia(file: File, folder = 'general'): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(SURVEY_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function listSurveyMedia(folder = ''): Promise<{ path: string; name: string }[]> {
  const { data, error } = await supabase.storage.from(SURVEY_MEDIA_BUCKET).list(folder || undefined, {
    limit: 100, sortBy: { column: 'created_at', order: 'desc' },
  });
  if (error) return [];
  return (data ?? [])
    .filter(f => f.id)
    .map(f => ({ path: folder ? `${folder}/${f.name}` : f.name, name: f.name }));
}

export async function deleteSurveyMedia(path: string) {
  await supabase.storage.from(SURVEY_MEDIA_BUCKET).remove([path]);
}

const cache = new Map<string, string>();

/** Wandelt einen gespeicherten Wert (URL oder Objektpfad) in eine anzeigbare URL um. */
export async function resolveMediaUrl(value?: string | null): Promise<string> {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (/^(https?:|data:|blob:)/i.test(v)) return v;
  if (cache.has(v)) return cache.get(v)!;
  const { data } = await supabase.storage.from(SURVEY_MEDIA_BUCKET).createSignedUrl(v, 60 * 60 * 24);
  const url = data?.signedUrl ?? '';
  if (url) cache.set(v, url);
  return url;
}
