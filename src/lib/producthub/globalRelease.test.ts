import { expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { pushGlobalProduct } from './globalRelease';

it('shows missing mapping as a caught failed release without retry or successful publication', async () => {
  invoke.mockResolvedValue({ data: { ok: false, online: false, offline: false, error: 'Bestätigte GLOBAL-Gerätezuordnung fehlt' }, error: null });
  await expect(pushGlobalProduct('device', 'com')).rejects.toThrow('Bestätigte GLOBAL-Gerätezuordnung fehlt');
  expect(invoke).toHaveBeenCalledOnce();
});