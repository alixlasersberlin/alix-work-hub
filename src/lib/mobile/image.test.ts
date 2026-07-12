import { describe, it, expect } from 'vitest';
import { compressImage } from './image';

// Minimal JPEG (10x10 red) header to satisfy createImageBitmap in jsdom.
// jsdom does not implement createImageBitmap → fallback returns file unchanged.
describe('compressImage', () => {
  it('returns the original file when the browser cannot decode it', async () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const file = new File([bytes], 'x.jpg', { type: 'image/jpeg' });
    const out = await compressImage(file, { maxEdge: 512 });
    expect(out).toBeInstanceOf(File);
    // In jsdom the fallback keeps the original name.
    expect(out.name).toBe('x.jpg');
  });

  it('does not touch non-image files', async () => {
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    const out = await compressImage(file);
    expect(out).toBe(file);
  });
});
