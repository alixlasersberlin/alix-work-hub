/**
 * Client-side Bild-Kompression für den Foto-Offline-Upload.
 * Rendert das Bild auf Canvas → JPEG (qualität konfigurierbar),
 * skaliert auf max. Kantenlänge und liefert einen neuen File.
 *
 * Hinweis: EXIF-Rotation wird via `createImageBitmap({ imageOrientation: 'from-image' })`
 * berücksichtigt, GPS/EXIF-Metadaten gehen bewusst verloren (Datenschutz + kleinere Files).
 */
export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; maxBytes?: number } = {},
): Promise<File> {
  const maxEdge = opts.maxEdge ?? 1920;
  const quality = opts.quality ?? 0.82;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024; // 2 MB Ziel
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= maxBytes && !opts.maxEdge) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any).catch(() => createImageBitmap(file));
    const ratio = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * ratio);
    const h = Math.round(bmp.height * ratio);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = (canvas as any).getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob: Blob = 'convertToBlob' in canvas
      ? await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality })
      : await new Promise((res) => (canvas as HTMLCanvasElement).toBlob((b) => res(b as Blob), 'image/jpeg', quality));
    if (blob.size >= file.size) return file;
    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
