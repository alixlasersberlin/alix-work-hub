import { describe, expect, it } from 'vitest';
import { loadAllPages } from './load-all-pages';

describe('all media packages', () => {
  it('includes packages after the previous 500-row limit', async () => {
    const packages = Array.from({ length: 1201 }, (_, id) => ({ id, status: id === 1200 ? 'completed' : 'in_progress' }));
    const rows = await loadAllPages(async (from, to) => ({ data: packages.slice(from, to + 1), error: null }));
    expect(rows).toEqual(packages);
    expect(rows[1200]).toEqual({ id: 1200, status: 'completed' });
  });

  it('does not treat a failed page as an empty complete result', async () => {
    await expect(loadAllPages(async () => ({ data: null, error: { message: 'Zugriff verweigert' } }))).rejects.toThrow('Zugriff verweigert');
  });
});