import { describe, it, expect } from 'vitest';
import { releaseDashboard } from './phReleaseDashboard';

describe('releaseDashboard', () => {
  it('marks every missing proof as Nicht geprüft and keeps stop/production locked', () => {
    const d = releaseDashboard('de', { emergency_stopped: true, channels: { de: { mode: 'blocked' } } }, []);
    expect(d['Vollsicherung'].text).toBe('Nicht geprüft');
    expect(d['Wiederherstellungstest'].state).toBe('fail');
    expect(d['API-Version'].text).toBe('Nicht geprüft');
    expect(d['Notstopp'].text).toBe('Aktiv');
    expect(d['Produktivfreigabe'].text).toBe('Gesperrt');
  });
  it('uses only the matching channel bundle evidence', () => {
    const logs = [{ operation: 'ph2_release_proof', channel_code: 'com', created_at: '2026-11-28T01:00:00Z', payload: { kind: 'bundle', passed: true, contract: '1.3', online: 20, offline: 24, duplicates: [], overlap: [], compatible_v12: true } }];
    expect(releaseDashboard('de', {}, logs)['Anzahl Online-Geräte'].text).toBe('Nicht geprüft');
    const c = releaseDashboard('com', {}, logs);
    expect(c['API-Version']).toEqual({ state: 'ok', text: 'v1.3' });
    expect(c['Dublettenprüfung'].state).toBe('ok');
  });
  it('a failed backup proof is not shown as passed', () => {
    const d = releaseDashboard('de', { backup_verified: false, backup_proof: { at: '2026-11-28T01:00:00Z' } }, []);
    expect(d['Vollsicherung'].state).toBe('fail');
  });
  it('memory-only restore can never provide an isolated release proof', () => {
    const d = releaseDashboard('de', { restore_verified: true, restore_proof: { isolated: false } }, []);
    expect(d['Wiederherstellungstest'].state).toBe('fail');
  });
  it('COM communication cannot satisfy DE evidence', () => {
    const logs = [{ operation: 'ph2_release_proof', channel_code: 'com', created_at: '2026-11-28T01:00:00Z', payload: { kind: 'communication', passed: true } }];
    expect(releaseDashboard('de', {}, logs)['Kommunikationsnachweis'].state).toBe('none');
    expect(releaseDashboard('com', {}, logs)['Kommunikationsnachweis'].state).toBe('ok');
  });
  it('proofs expire after 24 hours, not at exactly 24 hours', () => {
    const logs = [{ operation: 'ph2_release_proof', channel_code: 'de', created_at: '2026-11-28T00:00:00Z', payload: { kind: 'communication', passed: true } }];
    expect(releaseDashboard('de', {}, logs, undefined, Date.parse('2026-11-29T00:00:00Z'))['Kommunikationsnachweis'].state).toBe('ok');
    expect(releaseDashboard('de', {}, logs, undefined, Date.parse('2026-11-29T00:00:01Z'))['Kommunikationsnachweis'].state).toBe('fail');
  });
});
