import { beforeEach, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { pushGlobalProduct } from './globalRelease';
beforeEach(() => invoke.mockReset());

it('shows missing mapping as a caught failed release without retry or successful publication', async () => {
  invoke.mockResolvedValue({ data: { ok: false, online: false, offline: false, error: 'Bestätigte GLOBAL-Gerätezuordnung fehlt' }, error: null });
  await expect(pushGlobalProduct('device', 'com')).rejects.toThrow('Bestätigte GLOBAL-Gerätezuordnung fehlt');
  expect(invoke).toHaveBeenCalledOnce();
});

it('Beauty uses its own channel and accepts only its confirmed online response', async () => {
  invoke.mockResolvedValue({ data: { ok: true, online: true, state: 'online', dry_run: false, channel: 'beautyco', publication_id: 'beauty-id', version: 'exact-version' }, error: null });
  const receipt = await pushGlobalProduct('device', 'beautyco');
  expect(invoke).toHaveBeenCalledWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'beautyco', dry_run: false } });
  expect(receipt.publish_id).toBe('beauty-id');
  expect(receipt.source_version).toBe('exact-version');
});
it('Beauty validation or a different channel never counts as online publication', async () => {
  invoke.mockResolvedValue({ data: { ok: true, online: false, state: 'validated', dry_run: true, channel: 'beautyco' }, error: null });
  await expect(pushGlobalProduct('device', 'beautyco')).rejects.toThrow();
  invoke.mockResolvedValue({ data: { ok: true, online: true, state: 'online', dry_run: false, channel: 'de' }, error: null });
  await expect(pushGlobalProduct('device', 'beautyco')).rejects.toThrow();
  expect(invoke).toHaveBeenCalledTimes(2);
});