import { supabase } from '@/integrations/supabase/client';

export const PLM_BUCKET = 'plm-media';

/** Lädt eine Datei in den privaten PLM-Speicher und gibt den Objektpfad zurück. */
export async function uploadPlmFile(file: File, folder = 'allgemein'): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PLM_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function deletePlmFile(path: string) {
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return;
  await supabase.storage.from(PLM_BUCKET).remove([path]);
}

const cache = new Map<string, string>();

/** Wandelt einen gespeicherten Wert (Objektpfad oder Alt-URL) in eine anzeigbare URL um. */
export async function resolvePlmUrl(value?: string | null): Promise<string> {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (/^(https?:|data:|blob:)/i.test(v)) return v;
  if (cache.has(v)) return cache.get(v)!;
  const { data } = await supabase.storage.from(PLM_BUCKET).createSignedUrl(v, 60 * 60 * 24);
  const url = data?.signedUrl ?? '';
  if (url) cache.set(v, url);
  return url;
}
