import { Blob as NodeBlob } from 'node:buffer';
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import JSZip from 'jszip';
import { buildDownload } from './file-download';

describe('Bild-Downloads', () => {
  beforeAll(() => vi.stubGlobal('Blob', NodeBlob));
  afterAll(() => vi.unstubAllGlobals());
  it('enthält beide Bilder auch bei identischen Dateinamen', async () => {
    const blob = await buildDownload([
      { name: 'foto.jpg', load: async () => new Blob(['bild-1']) },
      { name: 'foto.jpg', load: async () => new Blob(['bild-2']) },
    ], true);
    const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(zip.files)).toEqual(['001-foto.jpg', '002-foto.jpg']);
    expect(await zip.file('001-foto.jpg')?.async('string')).toBe('bild-1');
    expect(await zip.file('002-foto.jpg')?.async('string')).toBe('bild-2');
  });
  it('liefert ein einzelnes Bild unverändert', async () => {
    const original = new Blob(['original'], { type: 'image/png' });
    expect(await buildDownload([{ name: 'foto.png', load: async () => original }], false)).toBe(original);
  });
  it('bietet kein unvollständiges ZIP bei Ladefehlern an', async () => {
    await expect(buildDownload([
      { name: 'ok.jpg', load: async () => new Blob(['ok']) },
      { name: 'fehlt.jpg', load: async () => { throw new Error('Nicht verfügbar'); } },
    ], true)).rejects.toThrow('Nicht verfügbar');
  });
});