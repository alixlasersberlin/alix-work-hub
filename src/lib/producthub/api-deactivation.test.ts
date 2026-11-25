import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), upsert: vi.fn(), update: vi.fn(), before: { id: 'device', active_com: true, active_de: true, active_dubai: true }, success: vi.fn(), warning: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
  functions: { invoke: mocks.invoke },
  from: () => ({ upsert: mocks.upsert, update: (patch: unknown) => { mocks.update(patch); return { eq: async () => ({ error: null }) }; }, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.before, error: null }) }) }) }),
} }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, warning: mocks.warning } }));
import { phUpdateProduct, phUpsertChannel, phSendDeactivation } from './api';

describe('gespeicherte Deaktivierung und automatischer Versand', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.upsert.mockResolvedValue({ error: null }); mocks.invoke.mockResolvedValue({ data: { ok: true, offline: true, status: 'OFFLINE' }, error: null }); });
  it('AE-Abwahl speichert zuerst und sendet genau einmal an dubai', async () => {
    await phUpdateProduct('device', { active_dubai: false });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ active_dubai: false, updated_by: 'actor' });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'dubai', action: 'deactivate' } });
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.invoke.mock.invocationCallOrder[0]);
  });
  it('COM-Abwahl speichert zuerst und sendet nur COM', async () => {
    await phUpdateProduct('device', { active_com: false });
    expect(mocks.update).toHaveBeenCalledWith({ active_com: false, updated_by: 'actor' });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'com', action: 'deactivate' } });
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.invoke.mock.invocationCallOrder[0]);
  });
  it('Zurückhalten sendet den DE-Abschaltauftrag', async () => {
    expect(await phUpsertChannel('device', 'de', { hold: true })).toEqual({ offline: true, note: 'Abschaltung auf der Webseite bestätigt', receipt: { ok: true, offline: true, status: 'OFFLINE' } });
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'de', action: 'deactivate' } });
  });
  it('separater Skin Master Mini DE-Versand verändert weder COM noch lokale Freigaben', async () => {
    const productId = '03701a94-e0b3-4d56-8ce2-17a0ab79d720';
    expect((await phSendDeactivation(productId, 'de')).offline).toBe(true);
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: productId, channel: 'de', action: 'deactivate' } });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('separater DE-Versand wiederholt unklaren Abschaltstand nicht', async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: false, offline: false, error: 'GLOBAL-Vorgang läuft oder ist unklar' }, error: null });
    expect((await phSendDeactivation('03701a94-e0b3-4d56-8ce2-17a0ab79d720', 'de')).offline).toBe(false);
    expect(mocks.invoke).toHaveBeenCalledOnce();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it('DE-Kartenergebnis wird getrennt gemeldet, ohne den Abschaltbefehl zu wiederholen', async () => {
    const event = vi.fn();
    window.addEventListener('ph-de-card-check', event);
    mocks.invoke.mockResolvedValue({ error: null, data: { ok: true, offline: true, status: 'OFFLINE', card_check: {
      state: 'visible', product_id: 'device', checked_at: '2026-11-25T05:19:00Z', message: 'DE-Karte weiterhin sichtbar',
    } } });
    try {
      expect((await phSendDeactivation('device', 'de')).offline).toBe(true);
      expect(event).toHaveBeenCalledOnce();
      expect(mocks.warning).toHaveBeenCalledWith('DE: DE-Karte weiterhin sichtbar');
      expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('ph-global-publish-device', { body: { product_id: 'device', channel: 'de', action: 'deactivate' } });
    } finally { window.removeEventListener('ph-de-card-check', event); }
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