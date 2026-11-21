import { expect, it } from 'vitest';
import { releaseSingleProduct } from './webRelease';
import type { BulkResult } from './bulkPublish';

it('WEB Freigabe betrifft nur den einzelnen Artikel und ausgewählte Webseiten; US bleibt ausgenommen', async () => {
  const writes: string[] = [];
  const results: BulkResult[] = [];
  await releaseSingleProduct({ id: 'article-a', name: 'Artikel A' }, ['de', 'at', 'us'].map(code => ({ code, name: code, is_active: true })),
    ['de', 'us'], [], { updateProduct: async id => { writes.push(id); }, updateChannel: async (_id, code) => { writes.push(code); }, pushCom: async () => {} },
    (_count, result) => results.push(result));
  expect(writes).toEqual(['article-a', 'de']);
  expect(results.map(r => [r.productId, r.site, r.state])).toEqual([['article-a', 'de', 'available']]);
});

it('ohne ausgewählte Webseite erfolgt keine Freigabe', async () => {
  let writes = 0;
  await expect(releaseSingleProduct({ id: 'a', name: 'A' }, [{ code: 'de', name: 'DE', is_active: true }], [], [], {
    updateProduct: async () => { writes++; }, updateChannel: async () => {}, pushCom: async () => {},
  }, () => {})).rejects.toThrow('Bitte mindestens eine Webseite auswählen');
  expect(writes).toBe(0);
});