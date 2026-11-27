import { describe, it, expect } from 'vitest';
import { allReady, isAccepted, failureCause } from './phAcceptance';
const ok = { http_get: 405, http_signed: 202, signature: 'verified', receipt: true, result: 'accepted', test_id: 'x' };
describe('PRODUCT HUB acceptance', () => {
  it('ready only when both sites pass', () => {
    expect(allReady(['de', 'com'], { de: ok, com: ok })).toBe(true);
    expect(allReady(['de', 'com'], { de: ok })).toBe(false);
    expect(allReady(['de', 'com'], { de: ok, com: { ...ok, receipt: false } })).toBe(false);
  });
  it('names the failing check', () => {
    expect(isAccepted({ ...ok, signature: 'rejected', result: 'error', message: 'Schlüssel' })).toBe(false);
    expect(failureCause({ ...ok, signature: 'rejected', result: 'error', message: 'Schlüssel' })).toContain('Signaturprüfung');
    expect(failureCause(ok)).toBeNull();
  });
});
