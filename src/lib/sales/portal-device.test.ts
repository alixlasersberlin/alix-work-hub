import { it, expect } from 'vitest';
import { canInstallSalesPortal } from './portal-device';

it('only enables home-screen support for active users with roles and an approved unblocked registered device', () => {
  const device = { approval_status: 'approved', revoked_at: null, blocked_at: null };
  expect(canInstallSalesPortal(true, ['Vertrieb'], device)).toBe(true);
  expect(canInstallSalesPortal(false, ['Vertrieb'], device)).toBe(false);
  expect(canInstallSalesPortal(true, [], device)).toBe(false);
  expect(canInstallSalesPortal(true, ['Vertrieb'], null)).toBe(false);
  expect(canInstallSalesPortal(true, ['Vertrieb'], { ...device, approval_status: 'pending' })).toBe(false);
  expect(canInstallSalesPortal(true, ['Vertrieb'], { ...device, blocked_at: '2026-11-03' })).toBe(false);
  expect(canInstallSalesPortal(true, ['Vertrieb'], { ...device, revoked_at: '2026-11-03' })).toBe(false);
});