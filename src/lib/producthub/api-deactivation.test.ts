import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), upsert: vi.fn(), update: vi.fn(), before: { id: 'device', active_com: true, active_de: true }, success: vi.fn(), warning: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
  functions: { invoke: mocks.invoke },
  from: () => ({ upsert: mocks.upsert, update: (patch: unknown) => { mocks.update(patch); return { eq: async () => ({ error: null }) }; }, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.before, error: null }) }) }) }),
} }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, warning: mocks.warning } }));
import { phUpdateProduct, phUpsertChannel } from './api';

describe('gespeicherte Deaktivierung und automatischer Versand', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.upsert.mockResolvedValue({ error: null }); mocks.invoke.mockResolvedValue({ data: { ok: true, offline: true, status: 'OFFLINE' }, error: null }); });
  it('COM-Abwahl speichert zuerst und sendet nur COM', async () => {
    await phUpdateProduct('device', { active_com: false });
    expect(mocks.update).toHaveBeenCalledWith({ active_com: false, updated_by: 'actor' });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'com', action: 'deactivate' } });
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.invoke.mock.invocationCallOrder[0]);
  });
  it('Zurückhalten sendet den DE-Abschaltauftrag', async () => {
    expect(await phUpsertChannel('device', 'de', { hold: true })).toEqual({ offline: true, note: 'Abschaltung auf der Webseite bestätigt' });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'de', action: 'deactivate' } });
  });
  it('fehlende Remote-Bestätigung erhält die lokale Deaktivierung ohne Neuversand', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: false, offline: false, error: 'Transport unklar' }, error: null });
    const result = await phUpsertChannel('device', 'com', { status: 'inactive', hold: true });
    expect(mocks.upsert).toHaveBeenCalledOnce();
    expect(mocks.invoke).toHaveBeenCalledOnce();
    expect(result?.offline).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('AT und US erhalten niemals den COM/DE-Abschaltauftrag', async () => {
    await phUpsertChannel('device', 'at', { hold: true });
    await phUpsertChannel('device', 'usa', { hold: true });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('Beauty-Zurückhalten verwendet beautyco und den eigenen OFFLINE-Antwortvertrag', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, offline: true, state: 'OFFLINE' }, error: null });
    expect((await phUpsertChannel('device', 'beautyco', { hold: true }))?.offline).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'beautyco', action: 'deactivate' } });
  });
});