import { supabase } from '@/integrations/supabase/client';

/**
 * Bild-/Thumbnail-Layer.
 * Erzeugt signierte URLs mit serverseitiger Bildtransformation (WebP-Rendering,
 * skaliert auf die tatsaechlich benoetigte Anzeigegroesse) statt der Originaldatei.
 * Faellt bei Fehlern automatisch auf die untransformierte URL zurueck.
 */
export type ThumbOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: 'cover' | 'contain' | 'fill';
  expiresIn?: number;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp|tiff?)$/i;

export function isImagePath(path?: string | null) {
  return !!path && IMAGE_EXT.test(path);
}

export async function signedThumbUrl(
  bucket: string,
  path: string,
  opts: ThumbOptions = {},
): Promise<string | null> {
  const { width = 400, height, quality = 70, resize = 'contain', expiresIn = 3600 } = opts;

  if (isImagePath(path)) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn, {
        transform: { width, ...(height ? { height } : {}), quality, resize },
      });
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

/** Mehrere Pfade parallel als Thumbnails signieren. Ergebnis: key -> URL. */
export async function signedThumbMap(
  bucket: string,
  entries: { key: string; path: string }[],
  opts: ThumbOptions = {},
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    entries.map(async ({ key, path }) => {
      if (!path) return;
      const url = await signedThumbUrl(bucket, path, opts);
      if (url) out[key] = url;
    }),
  );
  return out;
}
