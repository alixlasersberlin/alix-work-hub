import { expect, it } from 'vitest';
import { websiteState } from './websiteState';

it('AE uses its own latest receipt for ONLINE/OFFLINE and pending changes invalidate confirmation', () => {
  const receipt = { ok: true, offline: true, status: 'OFFLINE', channel: 'dubai' };
  const row = { remote_snapshot: { ae_direct: receipt } };
  expect(websiteState({ active_dubai: false }, 'dubai', row).confirmed).toBe(true);
  expect(websiteState({ active_dubai: false }, 'dubai', { remote_snapshot: { ae_direct: receipt, ae_pending: {} } }).confirmed).toBe(false);
  expect(websiteState({ active_dubai: true }, 'dubai', { remote_snapshot: { ae_direct: { ok: true, online: true, status: 'ONLINE', channel: 'dubai' } } }).confirmed).toBe(true);
  expect(websiteState({ active_dubai: false }, 'dubai', { remote_snapshot: { ae_direct: { ...receipt, channel: 'de' } } }).confirmed).toBe(false);
});

it('Beauty requires its own ONLINE receipt and unresolved reservations invalidate prior success', () => {
  const row = { status: 'published', remote_snapshot: { beauty_online: { ok: true, online: true, channel: 'beautyco', state: 'online' } } };
  expect(websiteState({}, 'beautyco', row).confirmed).toBe(true);
  expect(websiteState({}, 'beautyco', { ...row, remote_snapshot: { ...row.remote_snapshot, beauty_pending: { publication_id: 'pending' } } }).confirmed).toBe(false);
  expect(websiteState({}, 'beautyco', { ...row, remote_snapshot: { beauty_online: { ...row.remote_snapshot.beauty_online, channel: 'de' } } }).confirmed).toBe(false);
});

it('DE-Freigabe zeigt Aktiv; Zurückhalten hat Vorrang vor dem Aktivflag', () => {
  expect(websiteState({ active_de: true }, 'de').active).toBe(true);
  expect(websiteState({ active_de: true }, 'de', { hold: true }).active).toBe(false);
  expect(websiteState({ active_de: false }, 'de', { status: 'published' }).active).toBe(false);
});
it('eigene Webseite ohne gespeicherte Freigabe oder mit Entwurf bleibt inaktiv', () => {
  expect(websiteState({}, 'beautyco').active).toBe(false);
  expect(websiteState({}, 'beautyco', { status: 'draft' }).active).toBe(false);
  expect(websiteState({}, 'beautyco', { status: 'published' }).active).toBe(true);
});
it('lokale Freigabe ist ohne echten kanalgleichen ONLINE-Nachweis keine bestätigte Veröffentlichung', () => {
  expect(websiteState({ active_de: true }, 'de', { status: 'published' }).confirmed).toBe(false);
  const receipt = { ok: true, online: true, channel: 'com', status: 'ONLINE' };
  expect(websiteState({ active_de: true }, 'de', { remote_snapshot: { global_direct: receipt } }).confirmed).toBe(false);
  expect(websiteState({ active_com: true }, 'com', { remote_snapshot: { global_direct: receipt } }).confirmed).toBe(true);
});
it('ausstehende Änderungen entwerten frühere OFFLINE-Bestätigungen für den angezeigten Stand', () => {
  const row = { remote_snapshot: { global_offline: { ok: true, offline: true, channel: 'de', status: 'OFFLINE' } } };
  expect(websiteState({ active_de: false }, 'de', row).confirmed).toBe(true);
  expect(websiteState({ active_de: false }, 'de', { ...row, has_pending_changes: true }).confirmed).toBe(false);
});