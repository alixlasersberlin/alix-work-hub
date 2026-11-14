import { describe, expect, it } from 'vitest';
import { offerFinancePreview } from './offer-finance-preview';

describe('offer finance preview', () => {
  it('uses device price minus discount as purchase price, not minus deposit', () => {
    expect(offerFinancePreview(16900, 5900, 2000, 36)).toEqual({ total: 11000, downPayment: 2000, remaining: 9000, term: 36 });
  });
  it('rejects invalid financing rather than creating negative preview amounts', () => {
    expect(offerFinancePreview(100, 0, 101, 24)).toBeNull();
    expect(offerFinancePreview(100, 101, 0, 24)).toBeNull();
    expect(offerFinancePreview(100, 0, 0, 0)).toBeNull();
    expect(offerFinancePreview(NaN, 0, 0, 24)).toBeNull();
  });
});