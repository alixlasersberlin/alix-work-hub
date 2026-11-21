import { describe, it, expect } from 'vitest';
import { isValidDeIdentity } from './DeIdentityField';
describe('isValidDeIdentity', () => {
  it('akzeptiert eine Webseiten-Kennung', () => expect(isValidDeIdentity(' fc4288b6-fe95-4354-84c6-c28ef66e6d54 ')).toBe(true));
  it('lehnt Namen und Teilwerte ab', () => { expect(isValidDeIdentity('Alix Apex')).toBe(false); expect(isValidDeIdentity('fc4288b6')).toBe(false); });
});
