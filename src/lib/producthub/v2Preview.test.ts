import { describe, it, expect } from 'vitest';
import { previewState, newestLogs, type QueueLog } from './v2Preview';
const p = { id: 'p', name: 'Test', alix_product_id: 'hub', slug: 'test', status: 'published', active_de: true, hero_image_url: 'https://example.invalid/a.jpg' };
const now = Date.parse('2026-11-27T07:00:00Z');
const log: QueueLog = { id: 'e', product_id: 'p', channel_code: 'de', status: 'website_confirmed', created_at: '', payload: {
  signal: { event_id: 'e', version: 'v1', desired: 'ONLINE' }, receipt: { event_id: 'e', channel: 'de', product_id: 'hub', version: 'v1', state: 'ONLINE', observed_at: new Date(now).toISOString(), public_url: 'https://alix-lasers.de/devices/test' },
} };
describe('Product Hub 2.0 test controls', () => {
  it('never treats a local on-switch as publication', () => expect(previewState(p, 'de', false).state).toBe('unknown'));
  it('only a current matching website receipt is green', () => expect(previewState(p, 'de', false, log, undefined, now).state).toBe('online'));
  it('stale proof remains unknown', () => expect(previewState(p, 'de', false, log, undefined, now + 300001).state).toBe('unknown'));
  it('a sent command remains pending', () => expect(previewState(p, 'de', false, { ...log, status: 'awaiting_receipt' }).state).toBe('pending'));
  it('test changes never claim online', () => expect(previewState(p, 'de', false, log, true).state).toBe('pending'));
  it('holds remain locked even during tests', () => expect(previewState(p, 'de', true, log, true).state).toBe('locked'));
  it('US remains excluded', () => expect(previewState(p, 'usa', false, log, true).state).toBe('locked'));
  it('missing public image prevents simulated activation', () => expect(previewState({ ...p, hero_image_url: '' }, 'de', false, undefined, true).state).toBe('error'));
  it('newest product version wins independent of creation order', () => expect(newestLogs([log, { ...log, id: 'new', payload: { signal: { version: 'v2' } } }])['p:de'].id).toBe('new'));
});