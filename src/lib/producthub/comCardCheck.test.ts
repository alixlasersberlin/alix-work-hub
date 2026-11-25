import { describe, expect, it } from 'vitest';
import { isComCardCheck } from './comCardCheck';

describe('COM cards have a separate verified state from shutdown receipts', () => {
  it('an OFFLINE receipt alone does not confirm card absence', () => {
    expect(isComCardCheck({ ok: true, offline: true, status: 'OFFLINE' })).toBe(false);
  });
  it('accepts explicit public visibility even after receiver shutdown', () => {
    expect(isComCardCheck({ state: 'visible', checked_at: '2026-11-25T05:06:00Z', product_id: 'device', message: 'Visible in public catalog' })).toBe(true);
  });
  it('rejects unrecognized success flags', () => {
    expect(isComCardCheck({ state: 'OFFLINE', checked_at: '2026-11-25T05:06:00Z', product_id: 'device', message: 'OFFLINE' })).toBe(false);
  });
});