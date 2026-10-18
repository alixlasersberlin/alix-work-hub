import JSZip from 'jszip';

export interface DownloadSource {
  name: string;
  load: () => Promise<Blob>;
}

export function safeDownloadName(name: string) {
  return name.replace(/[\\/<>:"|?*\x00-\x1f]/g, '_').trim() || 'datei';
}

export async function buildDownload(sources: DownloadSource[], zip: boolean, onProgress?: (done: number) => void): Promise<Blob> {
  if (!sources.length) throw new Error('Keine Dateien vorhanden');
  const archive = new JSZip();
  for (let i = 0; i < sources.length; i++) {
    const blob = await sources[i].load();
    if (!blob.size) throw new Error(`Datei ist leer: ${sources[i].name}`);
    if (!zip) return blob;
    archive.file(`${String(i + 1).padStart(3, '0')}-${safeDownloadName(sources[i].name)}`, new Uint8Array(await blob.arrayBuffer()));
    onProgress?.(i + 1);
  }
  return archive.generateAsync({ type: 'blob', compression: 'STORE' });
}

export async function deliverDownload(blob: Blob, filename: string) {
  const name = safeDownloadName(filename);
  const file = new File([blob], name, { type: blob.type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}