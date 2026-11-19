import { expect, it } from 'vitest';
import { manualPaymentError } from './manual-payment';
it('requires a payment evidence reference', () => {
  expect(manualPaymentError(100, 348.33, '2026-11-19', '', '2026-11-19')).not.toBeNull();
  expect(manualPaymentError(100, 348.33, '2026-11-19', 'Kontoauszug 17, Zeile 4', '2026-11-19')).toBeNull();
});
it('rejects amounts exceeding the outstanding balance', () => {
  expect(manualPaymentError(348.34, 348.33, '2026-11-19', 'Beleg 123', '2026-11-19')).not.toBeNull();
  expect(manualPaymentError(0, 348.33, '2026-11-19', 'Beleg 123', '2026-11-19')).not.toBeNull();
});
it('requires an actual payment date not a future date', () => {
  expect(manualPaymentError(100, 348.33, '', 'Beleg 123', '2026-11-19')).not.toBeNull();
  expect(manualPaymentError(100, 348.33, '2026-11-20', 'Beleg 123', '2026-11-19')).not.toBeNull();
});