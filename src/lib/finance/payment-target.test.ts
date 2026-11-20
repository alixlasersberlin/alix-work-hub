import { expect, it } from 'vitest';
import { paymentTargetReason } from './payment-target';

const invoice = { id: 'a', due_date: '2027-05-21', balance: 100, status: 'sent' };
it('includes dates strictly beyond six calendar months from 20 November 2026', () => {
  expect(paymentTargetReason(invoice, undefined, '2026-11-20')).toBe('Mehr als 6 Monate');
  expect(paymentTargetReason({ ...invoice, due_date: '2027-05-20' }, undefined, '2026-11-20')).toBeNull();
});
it('includes the previously shown postponed invoice even within six months', () => {
  expect(paymentTargetReason({ ...invoice, due_date: '2027-03-05' }, { invoice_id: 'a', metadata: { old_due_date: '2025-12-08', new_due_date: '2027-03-05' } }, '2026-11-20')).toBe('Fälligkeit verschoben');
});
it('does not classify earlier changes or stale audit dates as postponements', () => {
  expect(paymentTargetReason({ ...invoice, due_date: '2027-03-05' }, { invoice_id: 'a', metadata: { old_due_date: '2027-04-01', new_due_date: '2027-03-05' } }, '2026-11-20')).toBeNull();
  expect(paymentTargetReason({ ...invoice, due_date: '2027-03-05' }, { invoice_id: 'a', metadata: { old_due_date: '2025-12-08', new_due_date: '2027-03-06' } }, '2026-11-20')).toBeNull();
});
it('excludes paid invoices and drafts', () => {
  expect(paymentTargetReason({ ...invoice, balance: 0 }, undefined, '2026-11-20')).toBeNull();
  expect(paymentTargetReason({ ...invoice, status: 'draft' }, undefined, '2026-11-20')).toBeNull();
});